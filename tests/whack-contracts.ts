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
 host=(await db.query<{id:string}>("INSERT INTO game.actors(role,token_hash) VALUES('host','host-whack-test') RETURNING id")).rows[0].id;
 players=[];
 for(let i=0;i<6;i++){
  players.push((await db.query<{id:string}>("INSERT INTO game.actors(role,token_hash) VALUES('player',$1) RETURNING id",[`whack-test-${i}`])).rows[0].id);
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

async function setupWhackRoom(code:string){
 await db.query('INSERT INTO game.rooms(code,host_id,capacity) VALUES($1,$2,32)',[code,host]);
 await db.query("INSERT INTO game.groups SELECT $1,i,'กลุ่ม '||i FROM generate_series(1,6) i",[code]);
 // Add 4 players (2 in Group 1, 2 in Group 2)
 assert.equal((await cmd(players[0],code,'join',{nickname:'หมอตรวจแชต 1',groupId:1})).ok,true);
 assert.equal((await cmd(players[1],code,'join',{nickname:'หมอตรวจแชต 2',groupId:1})).ok,true);
 assert.equal((await cmd(players[2],code,'join',{nickname:'หมอตรวจแชต 3',groupId:2})).ok,true);
 assert.equal((await cmd(players[3],code,'join',{nickname:'หมอตรวจแชต 4',groupId:2})).ok,true);

 await cmd(host,code,'acquire',{controllerId:'host-tab'});
 // Switch cue to 10.02
 assert.equal((await hostCmd(code,'cue',{cue:'10.02'})).ok,true);
}

test('Validation rules for whack-hit and ready contentVersion', ()=>{
 assert.equal(validateCommand('whack-hit',{runId:randomUUID(),phaseToken:randomUUID(),bubbleId:'whack-b01',clientTimeMs:1200}),true);
 assert.equal(validateCommand('whack-hit',{runId:randomUUID(),phaseToken:randomUUID(),bubbleId:'',clientTimeMs:1200}),false);
 assert.equal(validateCommand('whack-hit',{runId:randomUUID(),phaseToken:randomUUID(),bubbleId:'whack-b01',clientTimeMs:-5}),false);
 assert.equal(validateCommand('whack-hit',{runId:'not-a-uuid',phaseToken:randomUUID(),bubbleId:'whack-b01',clientTimeMs:1200}),false);
 assert.equal(validateCommand('ready',{previewId:randomUUID(),contentVersion:'whack-a-mole-v1'}),true);
 assert.equal(validateCommand('ready',{previewId:randomUUID(),contentVersion:'invalid-v1'}),false);
});

test('Chat Whack-a-Mole game flow: Start, Countdown, Privacy fence, Arcade hits, Deduplication, Negative clamp, Group scoring, Finish', async()=>{
 const code='WHCK01';
 await setupWhackRoom(code);

 // In PREVIEW mode
 const previewSnap=(await snap(players[0],code)).data;
 assert.equal(previewSnap.room.cue,'10.02');
 assert.equal(previewSnap.whack?.phase,'PREVIEW');
 assert.equal(previewSnap.whack?.revealed,false);
 assert.ok(previewSnap.whack?.contextBanner.includes('ผู้ใช้ขอคุยกับเจ้าหน้าที่'));

 // Players send ready
 for(let i=0;i<4;i++){
  assert.equal((await cmd(players[i],code,'ready',{previewId:previewSnap.room.previewId,contentVersion:'whack-a-mole-v1'})).ok,true);
 }

 // Host starts the game
 const startRes=await hostCmd(code,'start',{timingProfile:'normal'});
 assert.equal(startRes.ok,true,startRes.error);
 const runId=startRes.data.runId as string;

 // COUNTDOWN Phase
 const snapCount=(await snap(players[0],code)).data;
 assert.equal(snapCount.run?.gameId,'chat-whack-a-mole');
 assert.equal(snapCount.run?.phase,'COUNTDOWN');
 assert.equal(snapCount.whack?.phase,'COUNTDOWN');
 assert.equal(snapCount.whack?.bubbles.length,18);
 // STRICT PRIVACY FENCE: classification and explanation must be NULL
 assert.equal(snapCount.whack?.bubbles[0].classification,null);
 assert.equal(snapCount.whack?.bubbles[0].explanation,null);

 // Advance COUNTDOWN (3s) -> PLAYING
 await db.query("UPDATE game.runs SET phase='PLAYING', phase_start=clock_timestamp(), deadline=clock_timestamp()+interval '25 seconds', phase_token=gen_random_uuid() WHERE id=$1",[runId]);
 await db.query("UPDATE game.whack_run_state SET current_phase='PLAYING', phase_start=clock_timestamp(), arcade_start=clock_timestamp(), deadline=clock_timestamp()+interval '25 seconds' WHERE run_id=$1",[runId]);

 const snapPlay=(await snap(players[0],code)).data;
 assert.equal(snapPlay.run?.phase,'PLAYING');
 assert.equal(snapPlay.whack?.phase,'PLAYING');
 const ptPlay=snapPlay.run!.phaseToken;

 // Bubble 1 ('whack-b01') is STOP: "ไม่ต้องคุยกับเจ้าหน้าที่" (spawn 0.0s, expires 2.4s).
 // Player 0 hits Bubble 1 at elapsed 1.0s (deadline - 24.0s)
 const hitP0B1=await cmd(players[0],code,'whack-hit',{runId,phaseToken:ptPlay,bubbleId:'whack-b01',clientTimeMs:1000});
 assert.equal(hitP0B1.ok,true,hitP0B1.error);
 assert.equal(hitP0B1.data.accepted,true);
 assert.equal(hitP0B1.data.isCorrect,true);

 // Duplicate hit on Bubble 1 by Player 0 -> Idempotent, duplicate acknowledged
 const hitP0B1Dup=await cmd(players[0],code,'whack-hit',{runId,phaseToken:ptPlay,bubbleId:'whack-b01',clientTimeMs:1100});
 assert.equal(hitP0B1Dup.ok,true);
 assert.equal(hitP0B1Dup.data.duplicate,true);

 // Player 1 also hits Bubble 1 at elapsed 1.2s -> Accepted for Player 1
 const hitP1B1=await cmd(players[1],code,'whack-hit',{runId,phaseToken:ptPlay,bubbleId:'whack-b01',clientTimeMs:1200});
 assert.equal(hitP1B1.ok,true);
 assert.equal(hitP1B1.data.isCorrect,true);

 // Simulate time advance to 3.0s elapsed (Bubble 2 'whack-b02' is PASS: "ฉันช่วยติดต่อเจ้าหน้าที่ได้", spawn 2.4s, expires 4.8s)
 await db.query("UPDATE game.runs SET deadline=clock_timestamp()+interval '22 seconds' WHERE id=$1",[runId]);
 await db.query("UPDATE game.whack_run_state SET deadline=clock_timestamp()+interval '22 seconds' WHERE run_id=$1",[runId]);

 // Player 0 accidentally hits Bubble 2 (PASS) -> Wrong hit (-100)
 const hitP0B2=await cmd(players[0],code,'whack-hit',{runId,phaseToken:ptPlay,bubbleId:'whack-b02',clientTimeMs:3000});
 assert.equal(hitP0B2.ok,true);
 assert.equal(hitP0B2.data.isCorrect,false);

 // Player 2 hits Bubble 2 (PASS) with 0 initial score -> Raw score becomes -100!
 const hitP2B2=await cmd(players[2],code,'whack-hit',{runId,phaseToken:ptPlay,bubbleId:'whack-b02',clientTimeMs:3100});
 assert.equal(hitP2B2.ok,true);
 assert.equal(hitP2B2.data.isCorrect,false);

 // Test expired bubble: Player 0 tries to hit Bubble 1 at elapsed 3.0s (expired at 2.4s) -> Rejected
 const hitExpired=await cmd(players[0],code,'whack-hit',{runId,phaseToken:ptPlay,bubbleId:'whack-b01',clientTimeMs:3200});
 assert.equal(hitExpired.ok,false);
 assert.equal(hitExpired.error,'BUBBLE_EXPIRED');

 // Test non-existent bubble -> Rejected
 const hitInvalid=await cmd(players[0],code,'whack-hit',{runId,phaseToken:ptPlay,bubbleId:'whack-fake',clientTimeMs:3200});
 assert.equal(hitInvalid.ok,false);
 assert.equal(hitInvalid.error,'BUBBLE_NOT_FOUND');

 // Advance time past 25s arcade duration -> Reconcile to RESULT
 await db.query("UPDATE game.runs SET deadline=clock_timestamp()-interval '1 second' WHERE id=$1",[runId]);
 await db.query("UPDATE game.whack_run_state SET deadline=clock_timestamp()-interval '1 second' WHERE run_id=$1",[runId]);

 // Trigger reconcile via snap
 const snapResult=(await snap(players[0],code)).data;
 assert.equal(snapResult.run?.status,'RESULT');
 assert.equal(snapResult.run?.phase,'RESULT');
 assert.equal(snapResult.whack?.revealed,true);

 // Check private scores & clamping:
 // Player 0: hit 1 correct (+100) and 1 wrong (-100) = raw score 0 -> final clamped 0
 const snapP0=(await snap(players[0],code)).data;
 assert.equal(snapP0.whack?.myState?.correctHits,1);
 assert.equal(snapP0.whack?.myState?.wrongHits,1);
 assert.equal(snapP0.whack?.myState?.rawScore,0);
 assert.equal(snapP0.whack?.myState?.score,0);

 // Player 1: hit 1 correct (+100) and 0 wrong = raw score 100 -> final clamped 100
 const snapP1=(await snap(players[1],code)).data;
 assert.equal(snapP1.whack?.myState?.correctHits,1);
 assert.equal(snapP1.whack?.myState?.wrongHits,0);
 assert.equal(snapP1.whack?.myState?.rawScore,100);
 assert.equal(snapP1.whack?.myState?.score,100);

 // Player 2: hit 0 correct and 1 wrong (-100) = raw score -100 -> final CLAMPED to 0!
 const snapP2=(await snap(players[2],code)).data;
 assert.equal(snapP2.whack?.myState?.correctHits,0);
 assert.equal(snapP2.whack?.myState?.wrongHits,1);
 assert.equal(snapP2.whack?.myState?.rawScore,-100);
 assert.equal(snapP2.whack?.myState?.score,0); // Clamped to 0!

 // Privacy fence lifted in RESULT: classifications and explanations revealed!
 assert.equal(snapResult.whack?.bubbles[0].classification,'STOP');
 assert.ok(snapResult.whack?.bubbles[0].explanation?.length! > 0);
 assert.equal(snapResult.whack?.bubbles[1].classification,'PASS');
 assert.ok(snapResult.whack?.bubbles[1].explanation?.length! > 0);

 // Key comparison pairs revealed
 assert.equal(snapResult.whack?.keyPairs?.length,2);
 assert.equal(snapResult.whack?.keyPairs![0].stopBubble.classification,'STOP');
 assert.equal(snapResult.whack?.keyPairs![0].passBubble.classification,'PASS');

 // Group Score Verification:
 // Group 1: Player 0 (0) + Player 1 (100) = 100 / 2 members = 50.00
 // Group 2: Player 2 (0) + Player 3 (0) = 0 / 2 members = 0.00
 const scores=snapResult.scores!;
 assert.ok(scores);
 const g1=scores.find(g=>g.id===1);
 const g2=scores.find(g=>g.id===2);
 assert.equal(g1?.numerator,100);
 assert.equal(g1?.denominator,2);
 assert.equal(g2?.numerator,0);
 assert.equal(g2?.denominator,2);

 // Host Finishes Game -> cue transitions to 10.03
 const hostSnap=(await snap(host,code)).data;
 const finishRes=await hostCmd(code,'finish',{inputDigest:hostSnap.host!.inputDigest});
 assert.equal(finishRes.ok,true,finishRes.error);

 const finalSnap=(await snap(host,code)).data;
 assert.equal(finalSnap.room.cue,'10.03'); // Verified transition to 10.03!
 assert.equal(finalSnap.run?.status,'COMPLETED');

 // Host Replays Game -> cue returns to 10.02
 const replayRes=await hostCmd(code,'replay',{reason:'เล่นรอบทดสอบซ้ำ'});
 assert.equal(replayRes.ok,true,replayRes.error);
 const replaySnap=(await snap(host,code)).data;
 assert.equal(replaySnap.room.cue,'10.02'); // Verified replay cue 10.02!
});
