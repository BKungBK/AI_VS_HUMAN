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
 host=(await db.query<{id:string}>("INSERT INTO game.actors(role,token_hash) VALUES('host','host-roulette-test') RETURNING id")).rows[0].id;
 players=[];
 for(let i=0;i<6;i++){
  players.push((await db.query<{id:string}>("INSERT INTO game.actors(role,token_hash) VALUES('player',$1) RETURNING id",[`roulette-test-${i}`])).rows[0].id);
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
 return cmd(host,code,kind,{controllerId:'host-tab',controllerEpoch:s.host.controllerEpoch,expectedVersion:s.room.version,...payload},key);
}

async function setupRouletteRoom(code:string){
 await db.query('INSERT INTO game.rooms(code,host_id,capacity) VALUES($1,$2,32)',[code,host]);
 await db.query("INSERT INTO game.groups SELECT $1,i,'กลุ่ม '||i FROM generate_series(1,8) i",[code]);
 // Add 6 players (1 in each group)
 for(let i=0;i<6;i++){
  assert.equal((await cmd(players[i],code,'join',{nickname:`นักเดินป่า ${i+1}`,groupId:i+1})).ok,true);
 }
 await cmd(host,code,'acquire',{controllerId:'host-tab'});
 const s=(await snap(host,code)).data;
 // Switch cue to 07.01
 assert.equal((await hostCmd(code,'cue',{cue:'07.01'})).ok,true);
}

test('Validation rules for roulette-decision and ready', ()=>{
 assert.equal(validateCommand('roulette-decision',{runId:randomUUID(),phaseToken:randomUUID(),round:1,choice:'BELIEVE'}),true);
 assert.equal(validateCommand('roulette-decision',{runId:randomUUID(),phaseToken:randomUUID(),round:1,choice:'DOUBT'}),true);
 assert.equal(validateCommand('roulette-decision',{runId:randomUUID(),phaseToken:randomUUID(),round:1,choice:'MAYBE'}),false);
 assert.equal(validateCommand('roulette-decision',{runId:randomUUID(),phaseToken:randomUUID(),round:-1,choice:'BELIEVE'}),false);
 assert.equal(validateCommand('ready',{previewId:randomUUID(),contentVersion:'roulette-v1'}),true);
});

test('Roulette game flow: Start, Countdown, Privacy fence, Life risk, Eliminator, Group scoring, Finish', async()=>{
 const code='ROUL01';
 await setupRouletteRoom(code);

 // All players send ready
 const previewSnap=(await snap(players[0],code)).data;
 for(let i=0;i<6;i++){
  assert.equal((await cmd(players[i],code,'ready',{previewId:previewSnap.room.previewId,contentVersion:'roulette-v1'})).ok,true);
 }

 // Host starts the game
 const startRes=await hostCmd(code,'start',{timingProfile:'normal'});
 assert.equal(startRes.ok,true,startRes.error);
 const runId=startRes.data.runId as string;

 // Check initial run state: phase COUNTDOWN, all players ALIVE with 0 points
 const snapP0=(await snap(players[0],code)).data;
 assert.equal(snapP0.run?.phase,'COUNTDOWN');
 assert.equal(snapP0.roulette?.myState?.lifeState,'ALIVE');
 assert.equal(snapP0.roulette?.myState?.score,0);

 // Fast-forward COUNTDOWN -> Round 1 ANSWERING
 await db.query("UPDATE game.runs SET phase='ANSWERING', phase_start=clock_timestamp()-interval '1 second', deadline=clock_timestamp()+interval '4 seconds', phase_token=gen_random_uuid() WHERE id=$1",[runId]);
 await db.query("UPDATE game.roulette_run_state SET current_round=1, round_phase='ANSWERING', phase_start=clock_timestamp()-interval '1 second', deadline=clock_timestamp()+interval '4 seconds' WHERE run_id=$1",[runId]);

 const snapR1=(await snap(players[0],code)).data;
 assert.equal(snapR1.run?.phase,'ANSWERING');
 assert.equal(snapR1.roulette?.round,1);
 assert.equal(snapR1.roulette?.currentRound?.roundNo,1);
 // PRIVACY CHECK: isCorrect and explanation MUST be null during ANSWERING!
 assert.equal(snapR1.roulette?.currentRound?.isCorrect,null);
 assert.equal(snapR1.roulette?.currentRound?.explanation,null);

 // Player 0, 1, 2 choose BELIEVE on Round 1 (Round 1 is CORRECT: 4x250ml = 1L)
 const pt1=snapR1.run!.phaseToken;
 const ans0=await cmd(players[0],code,'roulette-decision',{runId,phaseToken:pt1,round:1,choice:'BELIEVE'});
 assert.equal(ans0.ok,true,ans0.error);

 // First answer lock: player 0 tries to change answer -> must be rejected!
 const ans0Dup=await cmd(players[0],code,'roulette-decision',{runId,phaseToken:pt1,round:1,choice:'DOUBT'});
 assert.equal(ans0Dup.error,'ANSWER_LOCKED');

 // Player 1 chooses BELIEVE
 assert.equal((await cmd(players[1],code,'roulette-decision',{runId,phaseToken:pt1,round:1,choice:'BELIEVE'})).ok,true);
 // Player 2 chooses BELIEVE
 assert.equal((await cmd(players[2],code,'roulette-decision',{runId,phaseToken:pt1,round:1,choice:'BELIEVE'})).ok,true);
 // Player 3 chooses DOUBT
 assert.equal((await cmd(players[3],code,'roulette-decision',{runId,phaseToken:pt1,round:1,choice:'DOUBT'})).ok,true);
 // Player 4 chooses DOUBT
 assert.equal((await cmd(players[4],code,'roulette-decision',{runId,phaseToken:pt1,round:1,choice:'DOUBT'})).ok,true);
 // Player 5 does not answer (timeout)

 // Fast-forward deadline to trigger reconcile into REVEAL for Round 1
 await db.query("UPDATE game.runs SET deadline=clock_timestamp()-interval '100 milliseconds' WHERE id=$1",[runId]);
 // Reconcile runs via snapshot fetch
 const snapAfterR1=(await snap(players[0],code)).data;
 assert.equal(snapAfterR1.roulette?.roundPhase,'REVEAL');
 assert.equal(snapAfterR1.roulette?.currentRound?.isCorrect,true); // Revealed now!
 assert.ok(snapAfterR1.roulette?.currentRound?.explanation?.length);

 // Check scores after Round 1 (Correct round):
 // Player 0 (BELIEVE): +300
 const p0State=(await snap(players[0],code)).data.roulette?.myState;
 assert.equal(p0State?.lifeState,'ALIVE');
 assert.equal(p0State?.score,300);

 // Player 3 (DOUBT on correct): +0, ALIVE
 const p3State=(await snap(players[3],code)).data.roulette?.myState;
 assert.equal(p3State?.lifeState,'ALIVE');
 assert.equal(p3State?.score,0);

 // Player 5 (No answer on correct): +0, ALIVE
 const p5State=(await snap(players[5],code)).data.roulette?.myState;
 assert.equal(p5State?.lifeState,'ALIVE');
 assert.equal(p5State?.score,0);

 // Now test DEATH mechanics in Round 3 (Incorrect statement: 100ลด20%เหลือ90):
 // Directly set state to Round 3 ANSWERING
 await db.query("UPDATE game.runs SET phase='ANSWERING', phase_start=clock_timestamp()-interval '1 second', deadline=clock_timestamp()+interval '4 seconds', phase_token=gen_random_uuid() WHERE id=$1",[runId]);
 await db.query("UPDATE game.roulette_run_state SET current_round=3, round_phase='ANSWERING', phase_start=clock_timestamp()-interval '1 second', deadline=clock_timestamp()+interval '4 seconds' WHERE run_id=$1",[runId]);

 const snapR3=(await snap(players[0],code)).data;
 const pt3=snapR3.run!.phaseToken;

 // Player 0 BELIEVES on Round 3 (TRAP! 100 - 20% = 80, not 90!)
 assert.equal((await cmd(players[0],code,'roulette-decision',{runId,phaseToken:pt3,round:3,choice:'BELIEVE'})).ok,true);
 // Player 1 DOUBTS on Round 3 (Correct decision!)
 assert.equal((await cmd(players[1],code,'roulette-decision',{runId,phaseToken:pt3,round:3,choice:'DOUBT'})).ok,true);

 // Fast-forward deadline to trigger reconcile into REVEAL for Round 3
 await db.query("UPDATE game.runs SET deadline=clock_timestamp()-interval '100 milliseconds' WHERE id=$1",[runId]);
 const snapAfterR3=(await snap(players[0],code)).data;
 assert.equal(snapAfterR3.roulette?.roundPhase,'REVEAL');

 // Player 0 MUST BE DEAD, score reset to 0, eliminatedAtRound = 3!
 const p0DeadState=(await snap(players[0],code)).data.roulette?.myState;
 assert.equal(p0DeadState?.lifeState,'DEAD');
 assert.equal(p0DeadState?.score,0);
 assert.equal(p0DeadState?.eliminatedAtRound,3);

 // Player 1 (who had 300 from R1, doubts R3): +100 = 400 points, remains ALIVE!
 const p1AliveState=(await snap(players[1],code)).data.roulette?.myState;
 assert.equal(p1AliveState?.lifeState,'ALIVE');
 assert.equal(p1AliveState?.score,400);

 // Test that DEAD player cannot answer Round 4:
 await db.query("UPDATE game.runs SET phase='ANSWERING', phase_start=clock_timestamp()-interval '1 second', deadline=clock_timestamp()+interval '4 seconds', phase_token=gen_random_uuid() WHERE id=$1",[runId]);
 await db.query("UPDATE game.roulette_run_state SET current_round=4, round_phase='ANSWERING', phase_start=clock_timestamp()-interval '1 second', deadline=clock_timestamp()+interval '4 seconds' WHERE run_id=$1",[runId]);
 const snapR4=(await snap(players[0],code)).data;
 const pt4=snapR4.run!.phaseToken;

 const p0Attempt=await cmd(players[0],code,'roulette-decision',{runId,phaseToken:pt4,round:4,choice:'BELIEVE'});
 assert.equal(p0Attempt.error,'PLAYER_DEAD');

 // Fast-forward to RESULT
 await db.query("UPDATE game.roulette_run_state SET current_round=6, round_phase='REVEAL' WHERE run_id=$1",[runId]);
 await db.query("UPDATE game.runs SET phase='REVEAL', deadline=clock_timestamp()-interval '100 milliseconds' WHERE id=$1",[runId]);
 const finalSnap=(await snap(host,code)).data;
 assert.equal(finalSnap.run?.status,'RESULT');
 assert.equal(finalSnap.roulette?.roundPhase,'RESULT');
 assert.ok(finalSnap.host?.inputDigest);

 // Test Finish: host finishes and advances cue to 07.02
 const finishRes=await hostCmd(code,'finish',{inputDigest:finalSnap.host!.inputDigest});
 assert.equal(finishRes.ok,true,finishRes.error);

 const completedSnap=(await snap(host,code)).data;
 assert.equal(completedSnap.room.cue,'07.02');
 assert.equal(completedSnap.room.activeRunId,null);
 assert.equal(completedSnap.run?.status,'COMPLETED');
});
