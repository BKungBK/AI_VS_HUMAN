import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,type Database} from '../api/database.ts';
import {validateCommand} from '../api/validation.ts';
import {prepareCaption,graphemeCount} from '../src/shared/caption-text.ts';

let db:Database;
let host:string,players:string[];
type Reply={ok:boolean;error?:string;data:any};
before(async()=>{
 db=await openDatabase(':memory:');
 host=(await db.query<{id:string}>("INSERT INTO game.actors(role,token_hash) VALUES('host','host-test') RETURNING id")).rows[0].id;
 players=[];for(let i=0;i<5;i++)players.push((await db.query<{id:string}>("INSERT INTO game.actors(role,token_hash) VALUES('player',$1) RETURNING id",[`test-${i}`])).rows[0].id);
});
after(async()=>await db.close());
async function cmd(actor:string,code:string,kind:string,payload:object={},key=randomUUID()):Promise<Reply>{const clean=kind==='caption'?{...payload,...prepareCaption((payload as {text:string}).text)}:payload;return (await db.query<{result:Reply}>('SELECT game.command($1,$2,$3,$4,$5) result',[actor,code,kind,JSON.stringify(clean),key])).rows[0].result;}
async function snap(actor:string,code:string){return (await db.query<{result:Reply}>('SELECT game.snapshot($1,$2) result',[actor,code])).rows[0].result;}
async function create(code:string,count=4){
 // This suite exercises Trust Tug contracts, so its fixture must start on the game cue.
 await db.query("INSERT INTO game.rooms(code,host_id,capacity,cue) VALUES($1,$2,32,'02.01')",[code,host]);
 await db.query("INSERT INTO game.groups SELECT $1,i,'กลุ่ม '||i FROM generate_series(1,6) i",[code]);
 for(let i=0;i<count;i++)assert.equal((await cmd(players[i],code,'join',{nickname:`ผู้เล่น ${i}`,groupId:1})).ok,true);
 await cmd(host,code,'acquire',{controllerId:'host-tab'});
 for(let i=0;i<count;i++){
  const s=(await snap(players[i],code)).data;
  if(i!==3)await cmd(players[i],code,'side',{previewId:s.room.previewId,side:i%2?'AI':'HUMAN',expectedRevision:0});
 }
}
async function hostCmd(code:string,kind:string,payload:object={},key=randomUUID()){
 const s=(await snap(host,code)).data;
 return cmd(host,code,kind,{controllerId:'host-tab',controllerEpoch:s.host.controllerEpoch,expectedVersion:s.room.version,...payload},key);
}
async function start(code:string){const r=await hostCmd(code,'start',{timingProfile:'normal'});assert.equal(r.ok,true,r.error);return r.data.runId as string;}
async function pulling(run:string){await db.query("UPDATE game.runs SET phase='PULLING',phase_start=clock_timestamp()-interval '1 second',deadline=clock_timestamp()+interval '10 seconds',phase_token=gen_random_uuid() WHERE id=$1",[run]);}
async function input(actor:string,code:string,count:number,startSeq=1,writerId='writer'){
 const s=(await snap(actor,code)).data;
 if(!s.me.state.writer_id)await cmd(actor,code,'writer',{runId:s.run.id,writerId});
 const latest=(await snap(actor,code)).data;
 const p={runId:s.run.id,phaseToken:latest.run.phaseToken,writerId,inputEpoch:latest.me.state.input_epoch,events:Array.from({length:count},(_,i)=>({id:randomUUID(),sequence:startSeq+i}))};
 return {payload:p,result:await cmd(actor,code,'tap',p)};
}

test('validation rejects missing fences, spoofed scores, nonfinite and malformed batches',()=>{
 assert.equal(validateCommand('start',{timingProfile:'normal'}),false);
 assert.equal(validateCommand('tap',{runId:randomUUID(),phaseToken:randomUUID(),writerId:'x',inputEpoch:1,events:[{id:randomUUID(),sequence:Infinity}]}),false);
 assert.equal(validateCommand('join',{nickname:'ok',groupId:1,score:500}),false);
 assert.equal(validateCommand('join',{nickname:'ok',groupId:1}),true);
 assert.equal(validateCommand('answer',{runId:randomUUID(),phaseToken:randomUUID(),imageId:'sc-12c9b760',choice:'AI'}),true);
 assert.equal(validateCommand('answer',{runId:randomUUID(),phaseToken:randomUUID(),imageId:'ai-is-human',choice:'AI'}),false);
});
test('Start locks roster and side; concurrent host requests create one run',async()=>{
 await create('START1');const s=(await snap(host,'START1')).data;
 const p={controllerId:'host-tab',controllerEpoch:s.host.controllerEpoch,expectedVersion:s.room.version,timingProfile:'normal'};
 const replies=await Promise.all([cmd(host,'START1','start',p),cmd(host,'START1','start',p)]);
 assert.equal(replies.filter(x=>x.ok).length,1);
 assert.equal((await db.query<{count:number}>("SELECT count(*)::int count FROM game.runs WHERE room_code='START1'")).rows[0].count,1);
 assert.equal((await cmd(players[0],'START1','side',{previewId:s.room.previewId,side:'AI',expectedRevision:1})).error,'PREVIEW_CLOSED');
 assert.equal((await cmd(players[0],'START1','cue',{cue:'03.01'})).error,'FORBIDDEN');
 assert.equal((await hostCmd('START1','cue',{cue:'03.01'})).error,'NAVIGATION_LOCKED');
});
test('receipt retry returns original reply after deadline; changed payload fails',async()=>{
 await create('RETRY1');const run=await start('RETRY1');await pulling(run);
 const s=(await snap(players[0],'RETRY1')).data;await cmd(players[0],'RETRY1','writer',{runId:run,writerId:'writer'});
 const p={runId:run,phaseToken:s.run.phaseToken,writerId:'writer',inputEpoch:1,events:[{id:randomUUID(),sequence:1}]},key=randomUUID();
 const first=await cmd(players[0],'RETRY1','tap',p,key);assert.equal(first.data.accepted,1);
 await db.query("UPDATE game.runs SET deadline=clock_timestamp() WHERE id=$1",[run]);
 assert.deepEqual(await cmd(players[0],'RETRY1','tap',p,key),first);
 assert.equal((await cmd(players[0],'RETRY1','tap',{...p,inputEpoch:2},key)).error,'IDEMPOTENCY_CONFLICT');
 assert.equal((await input(players[0],'RETRY1',1,2)).result.error,'INPUT_CLOSED');
 assert.equal((await snap(host,'RETRY1')).data.run.status,'RESULT');
});
test('unlimited taps, duplicate event IDs, roster average, exact group mean 257.50',async()=>{
 await create('SCORE1');const run=await start('SCORE1');await pulling(run);
 const first=await input(players[0],'SCORE1',12);assert.equal(first.result.data.accepted,12);assert.equal(first.result.data.events.filter((x:any)=>!x.accepted).length,0);
 const repeated=await cmd(players[0],'SCORE1','tap',{...first.payload,events:first.payload.events.slice(0,10)});assert.equal(repeated.data.accepted,12);assert.equal(repeated.data.events.every((x:any)=>x.duplicate),true);
 for(let round=1;round<5;round++){
  const r=await input(players[0],'SCORE1',10,13+(round-1)*10);assert.equal(r.result.ok,true);
 }
 assert.equal((await input(players[0],'SCORE1',1,53)).result.data.accepted,53);
 for(let round=0;round<4;round++){
  await input(players[1],'SCORE1',10,round*10+1);
 }
 await input(players[2],'SCORE1',10);
 assert.equal((await input(players[3],'SCORE1',1)).result.error,'SIDE_UNSELECTED');
 await db.query("UPDATE game.runs SET deadline=clock_timestamp() WHERE id=$1",[run]);
 const s=(await snap(host,'SCORE1')).data;
 assert.equal(s.scores[0].numerator,1030);assert.equal(s.scores[0].denominator,4);
 assert.equal(s.scores[0].numerator/s.scores[0].denominator,257.5);
 const finish=await hostCmd('SCORE1','finish',{inputDigest:s.host.inputDigest});assert.equal(finish.ok,true,finish.error);
 const done=(await snap(host,'SCORE1')).data;assert.equal(done.room.cue,'03.01');assert.equal(done.run.status,'COMPLETED');
 assert.equal((await hostCmd('SCORE1','finish',{inputDigest:s.host.inputDigest})).ok,false);
 assert.equal((await db.query<{n:number}>('SELECT count(*)::int n FROM game.confirmations WHERE run_id=$1',[run])).rows[0].n,1);
});
test('Pause/Resume preserves taps, rotates phase fence, rejects stale writer',async()=>{
 await create('PAUSE1');const run=await start('PAUSE1');await pulling(run);const first=await input(players[0],'PAUSE1',2);
 assert.equal((await hostCmd('PAUSE1','pause')).ok,true);
 const paused=(await snap(players[0],'PAUSE1')).data;assert.equal(paused.run.paused,true);assert.equal(paused.me.state.accepted,2);
 assert.equal((await cmd(players[0],'PAUSE1','tap',{...first.payload,events:[{id:randomUUID(),sequence:3}]})).error,'INPUT_CLOSED');
 assert.equal((await hostCmd('PAUSE1','resume')).ok,true);
 assert.equal((await cmd(players[0],'PAUSE1','tap',{...first.payload,events:[{id:randomUUID(),sequence:4}]})).error,'STALE_PHASE');
 const live=(await snap(players[0],'PAUSE1')).data;await cmd(players[0],'PAUSE1','writer',{runId:run,writerId:'second-tab'});
 assert.equal((await cmd(players[0],'PAUSE1','tap',{...first.payload,phaseToken:live.run.phaseToken,events:[{id:randomUUID(),sequence:5}]})).error,'STALE_WRITER');
});
test('late joins, leave/rejoin, host move cannot change historic roster',async()=>{
 await create('LATE01');const run=await start('LATE01');await pulling(run);
 await cmd(players[4],'LATE01','join',{nickname:'มาช้า',groupId:2});
 assert.equal((await snap(players[4],'LATE01')).data.me.inRoster,false);
 assert.equal((await cmd(players[4],'LATE01','writer',{runId:run,writerId:'late'})).error,'NOT_IN_ROSTER');
 const p=(await snap(players[0],'LATE01')).data;
 await hostCmd('LATE01','move',{memberId:p.me.memberId,groupId:2,reason:'จัดกลุ่มใหม่'});
 assert.equal((await db.query<{group_id:number}>('SELECT group_id FROM game.rosters WHERE run_id=$1 AND actor_id=$2',[run,players[0]])).rows[0].group_id,1);
 await cmd(players[0],'LATE01','leave');assert.equal((await snap(players[0],'LATE01')).error,'NOT_A_MEMBER');
 await cmd(players[0],'LATE01','join',{nickname:'กลับมา',groupId:2});assert.equal((await snap(players[0],'LATE01')).data.me.inRoster,false);
 assert.equal((await db.query<{n:number}>('SELECT count(*)::int n FROM game.rosters WHERE run_id=$1',[run])).rows[0].n,4);
});
test('Player/Display payload excludes other private scores and Host data; cross-room host denied',async()=>{
 await create('PRIV01');const run=await start('PRIV01');await pulling(run);await input(players[0],'PRIV01',3);
 const s=(await snap(players[1],'PRIV01')).data;assert.equal(s.host,null);assert.equal(s.scores,null);assert.equal(s.me.state.accepted,0);
 const display=(await db.query<{id:string}>("INSERT INTO game.actors(role,token_hash) VALUES('display','display-test') RETURNING id")).rows[0].id;
 const d=(await snap(display,'PRIV01')).data;assert.equal(d.me,null);assert.equal(d.host,null);
 assert.equal((await cmd(display,'PRIV01','start',{})).error,'FORBIDDEN');
 const other=(await db.query<{id:string}>("INSERT INTO game.actors(role,token_hash) VALUES('host','other-host') RETURNING id")).rows[0].id;
 assert.equal((await snap(other,'PRIV01')).error,'FORBIDDEN');
 assert.equal((await snap(players[4],'PRIV01')).error,'NOT_A_MEMBER');
});
test('controller takeover fences old host; cancel and replay preserve audit and invalidate scores',async()=>{
 await create('TAKE01');const run=await start('TAKE01');
 const old=(await snap(host,'TAKE01')).data;
 assert.equal((await cmd(host,'TAKE01','acquire',{controllerId:'backup'})).error,'CONTROL_BUSY');
 assert.equal((await cmd(host,'TAKE01','acquire',{controllerId:'backup',reason:'เครื่องหลักล่ม'})).ok,true);
 assert.equal((await hostCmd('TAKE01','pause')).error,'STALE_CONTROLLER');
 await cmd(host,'TAKE01','acquire',{controllerId:'host-tab',reason:'กลับเครื่องหลัก'});
 assert.equal((await hostCmd('TAKE01','cancel',{reason:'ซ้อมยกเลิก'})).ok,true);
 assert.equal((await snap(host,'TAKE01')).data.run.status,'CANCELLED');
 assert.equal((await hostCmd('TAKE01','replay',{reason:'ซ้อมใหม่'})).ok,true);
 assert.equal((await snap(host,'TAKE01')).data.room.confirmedRunId,null);
 assert.equal((await db.query<{n:number}>("SELECT count(*)::int n FROM game.audit WHERE room_code='TAKE01' AND kind='acquire'")).rows[0].n,3);
 assert.notEqual((await snap(host,'TAKE01')).data.room.version,old.room.version);
 assert.equal((await db.query<{status:string}>('SELECT status FROM game.runs WHERE id=$1',[run])).rows[0].status,'SUPERSEDED');
});
test('RESULT has no auto-finish deadline and digest mismatch rolls back Finish',async()=>{
 await create('RESULT');const run=await start('RESULT');await pulling(run);await db.query("UPDATE game.runs SET deadline=clock_timestamp()-interval '1 day' WHERE id=$1",[run]);
 const s=(await snap(host,'RESULT')).data;assert.equal(s.run.status,'RESULT');assert.equal(s.run.deadline,null);
 assert.equal((await hostCmd('RESULT','finish',{inputDigest:'tampered'})).error,'DIGEST_CHANGED');
 assert.equal((await snap(host,'RESULT')).data.room.cue,'02.01');assert.equal((await snap(host,'RESULT')).data.run.status,'RESULT');
});

test('Swipe Court keeps its answer key private, locks the first answer, scores 8 correct, and waits through reveal',async()=>{
 await create('SWIPE1');
 assert.equal((await hostCmd('SWIPE1','cue',{cue:'03.05'})).ok,true);
 const preview=(await snap(players[0],'SWIPE1')).data;
 assert.equal(preview.swipe.assets.length,8);assert.equal('classification' in preview.swipe.assets[0],false);
 for(let i=0;i<4;i++){
  const state=(await snap(players[i],'SWIPE1')).data;
  assert.equal((await cmd(players[i],'SWIPE1','ready',{previewId:state.room.previewId,contentVersion:'swipe-court-v1'})).ok,true);
 }
 const started=await hostCmd('SWIPE1','start',{timingProfile:'normal'});assert.equal(started.ok,true,started.error);
 const run=started.data.runId as string;
 const preReveal=(await snap(players[0],'SWIPE1')).data;
 assert.equal(preReveal.run.gameId,'ai-or-human');assert.equal(preReveal.swipe.revealed,false);assert.equal(preReveal.swipe.reveals.length,0);
 assert.equal(JSON.stringify(preReveal.swipe).includes('classification'),false);assert.equal(JSON.stringify(preReveal.swipe).includes('sourceUrl'),false);
 await db.query("UPDATE game.runs SET deadline=clock_timestamp()-interval '1 millisecond' WHERE id=$1",[run]);
 const firstView=(await snap(players[0],'SWIPE1')).data;assert.equal(firstView.run.phase,'ANSWERING');assert.equal(firstView.swipe.round,1);
 let firstChoice:'HUMAN'|'AI'='HUMAN';
 for(let round=1;round<=8;round++){
  const live=(await snap(players[0],'SWIPE1')).data;
  const key=(await db.query<{image_id:string;classification:'HUMAN'|'AI'}>('SELECT sr.image_id,asset.classification FROM game.swipe_rounds sr JOIN game.swipe_assets asset ON asset.content_version=\'swipe-court-v1\' AND asset.image_id=sr.image_id WHERE sr.run_id=$1 AND sr.round_no=$2',[run,round])).rows[0];
  assert.equal(live.swipe.currentImageId,key.image_id);assert.equal(live.swipe.revealed,false);
  const choice=key.classification;const payload={runId:run,phaseToken:live.run.phaseToken,imageId:key.image_id,choice};
  const accepted=await cmd(players[0],'SWIPE1','answer',payload);
  assert.equal(accepted.ok,true,accepted.error);assert.equal(accepted.data.accepted,true);assert.equal(accepted.data.duplicate,false);assert.equal('correct' in accepted.data,false);
  if(round===1){
   firstChoice=choice;
   const duplicate=await cmd(players[0],'SWIPE1','answer',{...payload,choice:choice==='HUMAN'?'AI':'HUMAN'});
   assert.equal(duplicate.ok,true);assert.equal(duplicate.data.duplicate,true);assert.equal(duplicate.data.choice,firstChoice);
   const other=(await snap(players[1],'SWIPE1')).data;assert.equal(other.swipe.myChoice,null);assert.equal(other.scores,null);
   assert.equal((await cmd(players[0],'SWIPE1','answer',{...payload,imageId:'sc-00000000'})).error,'STALE_IMAGE');
  }
  if(round<8){
   await db.query("UPDATE game.runs SET deadline=clock_timestamp()-interval '1 millisecond' WHERE id=$1",[run]);
   const next=(await snap(host,'SWIPE1')).data;assert.equal(next.run.phase,'ANSWERING');assert.equal(next.swipe.round,round+1);
  }
 }
 await db.query("UPDATE game.runs SET deadline=clock_timestamp()-interval '1 millisecond' WHERE id=$1",[run]);
 const revealed=(await snap(host,'SWIPE1')).data;assert.equal(revealed.run.status,'RESULT');assert.equal(revealed.run.phase,'REVEAL_ALL');
 assert.equal(revealed.swipe.revealed,true);assert.equal(revealed.swipe.reveals.length,8);assert.equal(revealed.swipe.reveals.every((x:any)=>x.sourceUrl&&x.creator&&x.license),true);
 assert.equal(revealed.swipe.reveals.filter((x:any)=>x.answered===1).length,8);
 assert.equal(revealed.scores[0].numerator,800);assert.equal(revealed.scores[0].denominator,4);
 assert.equal((await snap(players[0],'SWIPE1')).data.swipe.myAnswers.length,8);assert.equal((await snap(players[1],'SWIPE1')).data.swipe.myAnswers.length,0);
 assert.equal((await hostCmd('SWIPE1','finish',{inputDigest:revealed.host.inputDigest})).error,'GAME_NOT_FINISHABLE');
 await db.query("UPDATE game.runs SET deadline=clock_timestamp()-interval '1 millisecond' WHERE id=$1",[run]);
 const end=(await snap(host,'SWIPE1')).data;
 assert.equal((await hostCmd('SWIPE1','finish',{inputDigest:end.host.inputDigest})).ok,true);
 const done=(await snap(host,'SWIPE1')).data;assert.equal(done.room.cue,'03.03');assert.equal(done.run.status,'COMPLETED');assert.equal(done.swipe.revealed,true);
});
