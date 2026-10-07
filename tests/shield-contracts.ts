import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,type Database} from '../api/database.ts';
import {validateCommand} from '../api/validation.ts';
import type {Snapshot} from '../src/shared/game-contracts.ts';

let db:Database;
let host:string;
let players:string[];
type Reply={ok:boolean;error?:string;data:any};

before(async()=>{
 db=await openDatabase(':memory:');
 host=(await db.query<{id:string}>("INSERT INTO game.actors(role,token_hash) VALUES('host','host-shield-test') RETURNING id")).rows[0].id;
 players=[];
 for(let i=0;i<6;i++){
  players.push((await db.query<{id:string}>("INSERT INTO game.actors(role,token_hash) VALUES('player',$1) RETURNING id",[`shield-test-${i}`])).rows[0].id);
 }
});

after(async()=>await db.close());

async function cmd(actor:string,code:string,kind:string,payload:object={},key=randomUUID()):Promise<Reply>{
 return (await db.query<{result:Reply}>('SELECT game.command($1,$2,$3,$4,$5) result',[actor,code,kind,JSON.stringify(payload),key])).rows[0].result;
}

async function snap(actor:string,code:string):Promise<{ok:boolean;data:Snapshot}>{
 return (await db.query<{result:{ok:boolean;data:Snapshot}}>('SELECT game.snapshot($1,$2) result',[actor,code])).rows[0].result;
}

async function hostCmd(code:string,kind:string,payload:object={},key=randomUUID()){
 const s=(await snap(host,code)).data;
 return cmd(host,code,kind,{controllerId:'host-tab',controllerEpoch:s.host!.controllerEpoch,expectedVersion:s.room.version,...payload},key);
}

async function setupShieldRoom(code:string){
 await db.query('INSERT INTO game.rooms(code,host_id,capacity) VALUES($1,$2,32)',[code,host]);
 await db.query("INSERT INTO game.groups SELECT $1,i,'กลุ่ม '||i FROM generate_series(1,6) i",[code]);
 // Add 4 players (2 in Group 1, 2 in Group 2)
 assert.equal((await cmd(players[0],code,'join',{nickname:'ตัวแทน บ. 1',groupId:1})).ok,true);
 assert.equal((await cmd(players[1],code,'join',{nickname:'ตัวแทน บ. 2',groupId:1})).ok,true);
 assert.equal((await cmd(players[2],code,'join',{nickname:'ตัวแทน บ. 3',groupId:2})).ok,true);
 assert.equal((await cmd(players[3],code,'join',{nickname:'ตัวแทน บ. 4',groupId:2})).ok,true);

 await cmd(host,code,'acquire',{controllerId:'host-tab'});
 // Switch cue to 11.02
 assert.equal((await hostCmd(code,'cue',{cue:'11.02'})).ok,true);
}

test('Validation rules for shield-move and ready contentVersion', ()=>{
 assert.equal(validateCommand('shield-move',{runId:randomUUID(),phaseToken:randomUUID(),lane:1,normalizedX:0.5,clientTimeMs:1200}),true);
 assert.equal(validateCommand('shield-move',{runId:randomUUID(),phaseToken:randomUUID(),lane:0,normalizedX:0.1,clientTimeMs:1200}),true);
 assert.equal(validateCommand('shield-move',{runId:randomUUID(),phaseToken:randomUUID(),lane:2,normalizedX:0.9,clientTimeMs:1200}),true);
 assert.equal(validateCommand('shield-move',{runId:randomUUID(),phaseToken:randomUUID(),lane:3,normalizedX:0.5,clientTimeMs:1200}),false);
 assert.equal(validateCommand('shield-move',{runId:randomUUID(),phaseToken:randomUUID(),lane:-1,normalizedX:0.5,clientTimeMs:1200}),false);
 assert.equal(validateCommand('shield-move',{runId:randomUUID(),phaseToken:randomUUID(),lane:1,normalizedX:1.5,clientTimeMs:1200}),false);
 assert.equal(validateCommand('shield-move',{runId:randomUUID(),phaseToken:randomUUID(),lane:1,normalizedX:-0.2,clientTimeMs:1200}),false);
 assert.equal(validateCommand('shield-move',{runId:'invalid-uuid',phaseToken:randomUUID(),lane:1,normalizedX:0.5,clientTimeMs:1200}),false);
 assert.equal(validateCommand('ready',{previewId:randomUUID(),contentVersion:'shield-v1'}),true);
 assert.equal(validateCommand('ready',{previewId:randomUUID(),contentVersion:'invalid-shield-v2'}),false);
});

test('Company Shield game flow: Start, Countdown, Intercepts, Movement, Group Scoring, Finish, Replay', async()=>{
 const code='SHLD01';
 await setupShieldRoom(code);

 // 1. PREVIEW mode
 const previewSnap=(await snap(players[0],code)).data;
 assert.equal(previewSnap.room.cue,'11.02');
 assert.equal(previewSnap.shield?.phase,'PREVIEW');
 assert.equal(previewSnap.shield?.revealed,false);
 assert.ok(previewSnap.shield?.contextBanner.includes('Moffatt v. Air Canada'));

 // 2. Players send ready
 for(let i=0;i<4;i++){
  assert.equal((await cmd(players[i],code,'ready',{previewId:previewSnap.room.previewId,contentVersion:'shield-v1'})).ok,true);
 }

 // 3. Host starts game
 const startRes=await hostCmd(code,'start',{timingProfile:'normal'});
 assert.equal(startRes.ok,true,startRes.error);
 const runId=startRes.data.runId as string;

 // Check run state in COUNTDOWN
 let runSnap=(await snap(players[0],code)).data;
 assert.equal(runSnap.run?.status,'RUNNING');
 assert.equal(runSnap.run?.phase,'COUNTDOWN');
 assert.equal(runSnap.run?.contentVersion,'shield-v1');
 assert.equal(runSnap.shield?.packets.length,10);
 assert.deepEqual(runSnap.shield?.packets.map(p=>[p.aimAtSec,p.railAtSec,p.customerAtSec,p.targetLane]),[
  [0,1.6,2.4,1],[2.6,4.2,5,0],[5.2,6.8,7.6,2],[7.8,9.4,10.2,1],[10.4,12,12.8,2],
  [12.6,14.2,15,0],[14.8,16.4,17.2,2],[17,18.6,19.4,1],[19.2,20.8,21.6,0],[21.4,23,23.8,2],
 ]);

 // 4. Advance past countdown (3 seconds) to PLAYING
 await db.query("UPDATE game.runs SET phase_start=phase_start - interval '4 seconds', deadline=deadline - interval '4 seconds' WHERE id=$1",[runId]);
 await db.query("UPDATE game.shield_run_state SET phase_start=phase_start - interval '4 seconds', deadline=deadline - interval '4 seconds' WHERE run_id=$1",[runId]);

 runSnap=(await snap(players[0],code)).data;
 assert.equal(runSnap.run?.phase,'PLAYING');
 assert.equal(runSnap.shield?.phase,'PLAYING');
 const phaseToken=runSnap.run!.phaseToken;

 // Check initial player position: lane 1 (Center), normalizedX 0.5
 assert.equal(runSnap.shield?.myState?.currentLane,1);
 assert.equal(Number(runSnap.shield?.myState?.normalizedX),0.5);

 // 5. Player movements:
 // Schedule details:
 // Packet 1: aim 0.0s, rail 1.6s, target Lane 1 (Center)
 // Packet 2: aim 2.6s, rail 4.2s, target Lane 0 (Left)
 // Packet 3: aim 5.2s, rail 6.8s, target Lane 2 (Right)

 // Player 0: stays in lane 1 for packet 1, then moves to lane 0 at elapsed 3.0s
 // Player 1: moves to lane 0 (Left) early at elapsed 0.5s (will miss packet 1, but block packet 2!)
 // Player 2: stays in lane 1 always
 // Player 3: moves to lane 2 (Right) early at elapsed 0.5s

 // Player 1 move:
 const p1MoveRes=await cmd(players[1],code,'shield-move',{
  runId,
  phaseToken,
  lane:0,
  normalizedX:0.16,
  clientTimeMs:500
 });
 assert.equal(p1MoveRes.ok,true);

 // Player 3 move:
 const p3MoveRes=await cmd(players[3],code,'shield-move',{
  runId,
  phaseToken,
  lane:2,
  normalizedX:0.84,
  clientTimeMs:500
 });
 assert.equal(p3MoveRes.ok,true);

 // Simulate time passing to elapsed = 2.0s (past Packet 1 railAt 1.6s)
 await db.query("UPDATE game.runs SET phase_start=phase_start - interval '2 seconds', deadline=deadline - interval '2 seconds' WHERE id=$1",[runId]);
 await db.query("SELECT game.reconcile($1)",[runId]);

 // Check Packet 1 evaluation:
 // Player 0 never moved -> default lane 1 (Center) -> BLOCKED packet 1 (+50 pts)
 const p0Snap=(await snap(players[0],code)).data;
 assert.equal(p0Snap.shield?.myState?.score,50);
 assert.equal(p0Snap.shield?.myState?.blockedCount,1);
 assert.equal(p0Snap.shield?.myState?.missedCount,0);
 assert.equal(p0Snap.shield?.myState?.intercepts[0]?.status,'BLOCKED');

 // Player 1 moved to lane 0 -> target was lane 1 -> MISSED packet 1 (0 pts)
 const p1Snap=(await snap(players[1],code)).data;
 assert.equal(p1Snap.shield?.myState?.score,0);
 assert.equal(p1Snap.shield?.myState?.blockedCount,0);
 assert.equal(p1Snap.shield?.myState?.missedCount,1);
 assert.equal(p1Snap.shield?.myState?.intercepts[0]?.status,'MISSED');

 // Player 0 now moves to lane 0 (Left) before Packet 2 railAt (4.2s)
 const p0Move2Res=await cmd(players[0],code,'shield-move',{
  runId,
  phaseToken,
  lane:0,
  normalizedX:0.16,
  clientTimeMs:3000
 });
 assert.equal(p0Move2Res.ok,true);

 // Simulate time advancing past 25s arcade duration -> Reconcile to RESULT
 await db.query("UPDATE game.runs SET phase_start=phase_start - interval '26 seconds', deadline=clock_timestamp()-interval '1 second' WHERE id=$1",[runId]);
 await db.query("UPDATE game.shield_run_state SET deadline=clock_timestamp()-interval '1 second' WHERE run_id=$1",[runId]);
 await db.query("SELECT game.reconcile($1)",[runId]);

 // Verify RESULT phase
 const resultSnap=(await snap(players[0],code)).data;
 assert.equal(resultSnap.run?.status,'RESULT');
 assert.equal(resultSnap.shield?.phase,'RESULT');
 assert.equal(resultSnap.shield?.revealed,true);

 // Total evaluated intercepts per player should be exactly 10 (BLOCKED + MISSED = 10)
 const p0Final=(await snap(players[0],code)).data;
 const p0Total=p0Final.shield!.myState!.blockedCount + p0Final.shield!.myState!.missedCount;
 assert.equal(p0Total,10);

 // Player 2 stayed in lane 1 the whole time.
 // Schedule targets: 1, 0, 2, 1, 2, 0, 2, 1, 0, 2
 // Lane 1 targets: Packet 1, 4, 8 (3 packets total).
 // Player 2 should have blocked exactly 3 packets = 150 points!
 const p2Final=(await snap(players[2],code)).data;
 assert.equal(p2Final.shield?.myState?.blockedCount,3);
 assert.equal(p2Final.shield?.myState?.score,150);
 assert.equal(p2Final.shield?.myState?.missedCount,7);

 // Check Group scores:
 const scoresRes=await db.query<{result:any}>('SELECT game.scores($1) result',[runId]);
 const groupScores=scoresRes.rows[0].result;
 assert.equal(groupScores.length,6);
 // Group 1 has 2 players
 assert.equal(groupScores[0].denominator,2);
 // Group 2 has 2 players
 assert.equal(groupScores[1].denominator,2);

 // 6. Finish game -> Cue transitions to 11.03
 const inputDigest=resultSnap.run?.id ? (await db.query<{input_digest:string}>('SELECT input_digest FROM game.runs WHERE id=$1',[runId])).rows[0].input_digest : '';
 const finishRes=await hostCmd(code,'finish',{inputDigest});
 assert.equal(finishRes.ok,true,finishRes.error);

 const postFinishSnap=(await snap(host,code)).data;
 assert.equal(postFinishSnap.room.cue,'11.03'); // "AI IS A TOOL. NOT A SHIELD."
 assert.equal(postFinishSnap.room.activeRunId,null);

 // 7. Replay command -> Cue returns to 11.02 and ready status is reset
 const replayRes=await hostCmd(code,'replay',{reason:'ทบทวนการรับผิดชอบของบริษัท'});
 assert.equal(replayRes.ok,true,replayRes.error);

 const postReplaySnap=(await snap(players[0],code)).data;
 assert.equal(postReplaySnap.room.cue,'11.02');
 assert.equal(Boolean(postReplaySnap.me?.ready),false);
});
