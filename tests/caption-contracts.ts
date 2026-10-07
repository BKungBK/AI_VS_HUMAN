import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,type Database} from '../api/database.ts';
import {prepareCaption,graphemeCount} from '../src/shared/caption-text.ts';
import {validateCommand} from '../api/validation.ts';
let db:Database,host:string,players:string[],display:string;
before(async()=>{db=await openDatabase(':memory:');host=(await db.query<{id:string}>("INSERT INTO game.actors(role,token_hash) VALUES('host','caption-host') RETURNING id")).rows[0].id;display=(await db.query<{id:string}>("INSERT INTO game.actors(role,token_hash) VALUES('display','caption-display') RETURNING id")).rows[0].id;players=[];for(let i=0;i<4;i++)players.push((await db.query<{id:string}>("INSERT INTO game.actors(role,token_hash) VALUES('player',$1) RETURNING id",[`caption-player-${i}`])).rows[0].id);});
after(async()=>db.close());
async function cmd(actor:string,code:string,kind:string,payload:Record<string,unknown>={},key=randomUUID()){
 if(kind==='caption')payload={...payload,...prepareCaption(payload.text as string)};
 return (await db.query<{result:any}>('SELECT game.command($1,$2,$3,$4,$5) result',[actor,code,kind,JSON.stringify(payload),key])).rows[0].result;
}
async function snap(actor:string,code:string){return (await db.query<{result:any}>('SELECT game.snapshot($1,$2) result',[actor,code])).rows[0].result.data;}
async function hostCmd(code:string,kind:string,payload:Record<string,unknown>={},key=randomUUID()){
 const s=await snap(host,code);return cmd(host,code,kind,{controllerId:'caption-host-tab',controllerEpoch:s.host.controllerEpoch,expectedVersion:s.room.version,...payload},key);
}
async function room(code:string){
 await db.query("INSERT INTO game.rooms(code,host_id,capacity,cue) VALUES($1,$2,32,'04.01')",[code,host]);
 await db.query("INSERT INTO game.groups SELECT $1,i,'กลุ่ม '||i FROM generate_series(1,6) i",[code]);
 for(let i=0;i<4;i++)assert.equal((await cmd(players[i],code,'join',{nickname:`คน ${i}`,groupId:i<2?1:i})).ok,true);
 await cmd(host,code,'acquire',{controllerId:'caption-host-tab'});
}
async function advance(code:string){const s=await snap(host,code);await db.query("UPDATE game.runs SET deadline=clock_timestamp()-interval '1 millisecond' WHERE id=$1",[s.run.id]);return snap(host,code);}
async function write(code:string,player:number,text:string,revision=1){const s=await snap(players[player],code);return cmd(players[player],code,'caption',{runId:s.run.id,phaseToken:s.run.phaseToken,text,revision,submitted:true});}
async function review(code:string,sub:any,decision='APPROVED',reason=''){const s=await snap(host,code);return hostCmd(code,'moderation',{runId:s.run.id,phaseToken:s.run.phaseToken,submissionId:sub.id,lockedRevision:sub.revision,expectedReviewVersion:sub.reviewVersion,decision,reason});}
async function vote(code:string,player:number,id:string,revision=1){const s=await snap(players[player],code);return cmd(players[player],code,s.run.phase==='INTERNAL_VOTE'?'internal-vote':'final-vote',{runId:s.run.id,phaseToken:s.run.phaseToken,candidateId:id,revision});}

test('Thai combining marks and emoji use visible clusters; normalize and reject markup/links',()=>{
 const unit='ก้';assert.equal(graphemeCount(unit.repeat(80)),80);assert.equal(prepareCaption(unit.repeat(80)).graphemeCount,80);assert.throws(()=>prepareCaption(unit.repeat(81)),/CAPTION_TOO_LONG/);
 assert.equal(graphemeCount('👨‍👩‍👧‍👦👍🏽ก้'),3);assert.throws(()=>prepareCaption('<script>'),/CAPTION_FORMAT/);assert.throws(()=>prepareCaption('https://example.com'),/CAPTION_FORMAT/);
 assert.equal(validateCommand('caption',{runId:randomUUID(),phaseToken:randomUUID(),text:'มุก',revision:1,submitted:true}),true);
 assert.equal(validateCommand('caption',{runId:randomUUID(),phaseToken:randomUUID(),text:'มุก',revision:1,submitted:true,graphemeCount:1}),false);
});
test('Caption flow guards AI approval, final revisions, review barrier, votes, privacy and atomic finish',async()=>{
 const c='CAP001';await room(c);
 assert.equal((await hostCmd(c,'start',{timingProfile:'normal'})).error,'AI_REVIEW_REQUIRED');
 assert.equal((await hostCmd(c,'caption-content-approve')).ok,true);
 const ready=await snap(players[0],c);assert.equal((await cmd(players[0],c,'ready',{previewId:ready.room.previewId,contentVersion:'caption-battle-v1'})).ok,true);
 assert.equal((await hostCmd(c,'start',{timingProfile:'normal'})).ok,true);
 let state=await advance(c);assert.equal(state.run.phase,'WRITING');
 assert.equal((await write(c,0,'แมวพร้อม คนยังไม่พร้อม')).ok,true);
 assert.equal((await write(c,1,'ผมคือฝ่ายอนุมัติอาหารแมว')).ok,true);
 assert.equal((await write(c,2,'พิมพ์งานหนึ่งหน้า งีบหนึ่งชั่วโมง')).ok,true);
 assert.equal((await write(c,3,'แคปชั่นที่ตรวจไม่ผ่าน')).ok,true);
 let queue=(await snap(host,c)).caption.reviewQueue;assert.equal((await review(c,queue[0])).ok,true);
 const old=queue[0];assert.equal((await write(c,0,'แมวแก้ฉบับล่าสุด',2)).ok,true);assert.equal((await review(c,old)).error,'STALE_REVIEW');
 assert.equal((await write(c,0,'อีกแท็บเก่า',2)).error,'STALE_REVISION');
 const privateView=await snap(players[1],c);assert.equal(privateView.caption.ownSubmission.text,'ผมคือฝ่ายอนุมัติอาหารแมว');assert.equal(privateView.caption.reviewQueue.length,0);assert.equal(privateView.caption.aiCaption,null);
 const screen=await snap(display,c);assert.equal(JSON.stringify(screen).includes('แมวแก้ฉบับล่าสุด'),false);assert.equal(screen.caption.aiMetadata,null);
 state=await advance(c);assert.equal(state.run.phase,'MODERATING');assert.equal((await write(c,0,'ส่งช้า',3)).error,'INPUT_CLOSED');
 const staleToken=state.run.phaseToken;await hostCmd(c,'pause');state=await snap(host,c);assert.equal(state.run.paused,true);
 assert.equal((await hostCmd(c,'moderation',{runId:state.run.id,phaseToken:staleToken,submissionId:old.id,lockedRevision:2,expectedReviewVersion:1,decision:'APPROVED',reason:''})).error,'INPUT_CLOSED');
 await hostCmd(c,'resume');state=await advance(c);assert.equal(state.run.phase,'REVIEW_REQUIRED');assert.equal(state.run.deadline,null);
 assert.equal((await hostCmd(c,'caption-open-vote',{runId:state.run.id,phaseToken:state.run.phaseToken})).error,'REVIEW_PENDING');
 queue=(await snap(host,c)).caption.reviewQueue;
 for(const sub of queue)assert.equal((await review(c,sub,sub.author==='คน 3'?'REJECTED':'APPROVED',sub.author==='คน 3'?'ทดสอบการซ่อนงาน':'')).ok,true);
 state=await snap(host,c);assert.equal((await hostCmd(c,'caption-open-vote',{runId:state.run.id,phaseToken:state.run.phaseToken})).ok,true);
 const internal=await snap(players[0],c);assert.equal(internal.caption.internalCandidates.length,2);const nomination=internal.caption.internalCandidates[1].id;
 assert.equal((await vote(c,0,nomination)).ok,true);assert.equal((await vote(c,0,internal.caption.internalCandidates[0].id,2)).ok,true);assert.equal((await vote(c,0,nomination,3)).ok,true);
 const rejected=queue.find((x:any)=>x.author==='คน 3');assert.equal((await vote(c,3,rejected.id)).error,'CANDIDATE_INVALID');
 state=await advance(c);assert.equal(state.run.phase,'FINAL_VOTE');assert.equal(state.caption.finalCandidates.length,3);assert.equal(JSON.stringify(state.caption.finalCandidates).includes('groupId'),false);
 const final=await snap(players[0],c);const own=final.caption.finalCandidates.find((x:any)=>x.ownGroup),other=final.caption.finalCandidates.find((x:any)=>!x.ownGroup);
 assert.equal((await vote(c,0,own.id)).error,'OWN_GROUP');assert.equal((await vote(c,0,other.id)).ok,true);
 assert.deepEqual((await snap(players[0],c)).caption.finalCandidates,final.caption.finalCandidates);
 const resume=await snap(players[0],c);assert.equal(resume.caption.finalVote.candidateId,other.id);
 state=await advance(c);assert.equal(state.run.status,'RESULT');assert.equal(state.caption.revealed,true);assert.equal(state.caption.results.length,3);assert.equal(state.caption.results.some((x:any)=>x.text===rejected.text),false);
 const digest=state.host.inputDigest;const fin=await hostCmd(c,'finish',{inputDigest:digest});assert.equal(fin.ok,true,fin.error);
 state=await snap(host,c);assert.equal(state.room.cue,'04.02');assert.equal(state.run.status,'COMPLETED');assert.equal(state.room.activeRunId,null);
 assert.equal((await hostCmd(c,'finish',{inputDigest:digest})).error,'NO_ACTIVE_RUN');
 assert.equal((await db.query<{n:number}>('SELECT count(*)::int n FROM game.confirmations WHERE run_id=$1',[state.run.id])).rows[0].n,1);
 assert.equal((await hostCmd(c,'replay',{reason:'ซ้อมอีกครั้ง'})).ok,true);state=await snap(host,c);assert.equal(state.room.cue,'04.01');assert.equal(state.caption.contentApproved,false);assert.equal(state.confirmedScores,null);
});
test('Normalized support uses frozen roster weights, AI baseline, exact ties and no-vote zero',async()=>{
 const c='CAP002';await room(c);await hostCmd(c,'caption-content-approve');await hostCmd(c,'start',{timingProfile:'normal'});const state=await advance(c),rr=state.run.id;
 // Replace rehearsal roster sizes with 5/10/15, keeping the scoring fixture explicit.
 await db.query('DELETE FROM game.player_states WHERE run_id=$1',[rr]);await db.query('DELETE FROM game.rosters WHERE run_id=$1',[rr]);
 const counts=[5,10,15];let roster:{member:string;group:number}[]=[];
 for(let group=1;group<=3;group++)for(let i=0;i<counts[group-1];i++){
 const actor=(await db.query<{id:string}>("INSERT INTO game.actors(role,token_hash) VALUES('player',$1) RETURNING id",[`weight-${group}-${i}`])).rows[0].id;
 const member=(await db.query<{id:string}>("INSERT INTO game.members(room_code,actor_id,nickname,group_id) VALUES($1,$2,'fixture',$3) RETURNING id",[c,actor,group])).rows[0].id;
 await db.query("INSERT INTO game.rosters VALUES($1,$2,$3,$4,'fixture','UNSELECTED')",[rr,member,actor,group]);roster.push({member,group});}
 const candidates:string[]=[];for(let group=1;group<=3;group++)candidates.push((await db.query<{id:string}>('INSERT INTO game.caption_candidates(run_id,group_id,text,position) VALUES($1,$2,$3,$2) RETURNING id',[rr,group,`candidate ${group}`])).rows[0].id);
 const ai=(await db.query<{id:string}>("INSERT INTO game.caption_candidates(run_id,text,position) VALUES($1,'AI',4) RETURNING id",[rr])).rows[0].id;
 assert.equal((await db.query<{r:any}>('SELECT game.caption_results($1) r',[rr])).rows[0].r.every((x:any)=>x.score===0),true);
 // Human supports .30/.20/.10: G1 gets 3/10 + 4/15 => .283333, so use G2 & G3 proportions .4/.2 = .30;
 // G2 gets 1/5 + 3/15 => .20; G3 gets 1/5 + 0/10 => .10.
 const assignment=[{group:2,index:[0,1,2,3],candidate:candidates[0]},{group:3,index:[0,1,2],candidate:candidates[0]},
 {group:1,index:[0],candidate:candidates[1]},{group:3,index:[3,4,5],candidate:candidates[1]},
 {group:1,index:[1],candidate:candidates[2]}];
 for(const item of assignment)for(const i of item.index)await db.query("INSERT INTO game.caption_votes VALUES($1,$2,'FINAL',$3,1,clock_timestamp())",[rr,roster.filter(x=>x.group===item.group)[i].member,item.candidate]);
 let results=(await db.query<{r:any}>('SELECT game.caption_results($1) r',[rr])).rows[0].r;
 assert.deepEqual(results.filter((x:any)=>x.groupId!==null).map((x:any)=>x.score),[1000,667,333]);
 // Exact tied support remains a shared win; speed never breaks final ties.
 for(const index of [0,1])await db.query("UPDATE game.caption_votes SET candidate_id=$2 WHERE run_id=$1 AND member_id=$3",[rr,ai,roster.filter(x=>x.group===2)[index].member]);
 results=(await db.query<{r:any}>('SELECT game.caption_results($1) r',[rr])).rows[0].r;
 assert.equal(results.filter((x:any)=>x.winner).length,2);
 await db.query("INSERT INTO game.caption_votes SELECT $1,member_id,'FINAL',$2,2,clock_timestamp() FROM game.rosters WHERE run_id=$1 ON CONFLICT(run_id,member_id,vote_type) DO UPDATE SET candidate_id=$2,revision=2",[rr,ai]);
 results=(await db.query<{r:any}>('SELECT game.caption_results($1) r',[rr])).rows[0].r;assert.equal(results.find((x:any)=>x.groupId===null).support,1);assert.equal(results.filter((x:any)=>x.groupId!==null).every((x:any)=>x.score===0),true);
 // Moving current membership cannot change the roster denominator.
 await db.query('UPDATE game.members SET group_id=6 WHERE room_code=$1',[c]);const score=(await db.query<{r:any}>('SELECT game.scores($1) r',[rr])).rows[0].r;assert.deepEqual(score.slice(0,3).map((x:any)=>x.denominator),counts);
});
test('Empty writing round advances safely; receipt retries after deadline keep acknowledgement; phase changes fence new requests',async()=>{
 const c='CAP003';await room(c);await hostCmd(c,'caption-content-approve');await hostCmd(c,'start',{timingProfile:'normal'});
 let state=await advance(c);const payload={runId:state.run.id,phaseToken:state.run.phaseToken,text:'ทดสอบ receipt',revision:1,submitted:true},receipt=randomUUID();
 const first=await cmd(players[0],c,'caption',payload,receipt);assert.equal(first.ok,true);
 // Empty latest revision removes this text from nomination without deleting audit history.
 await write(c,0,'',2);state=await advance(c);
 assert.deepEqual(await cmd(players[0],c,'caption',payload,receipt),first);
 assert.equal((await cmd(players[0],c,'caption',{...payload,text:'เปลี่ยนข้อมูล'},receipt)).error,'IDEMPOTENCY_CONFLICT');
 assert.equal((await cmd(players[0],c,'caption',{...payload,revision:3})).error,'STALE_PHASE');
 state=await advance(c);assert.equal(state.run.phase,'INTERNAL_VOTE');assert.equal((await snap(players[0],c)).caption.internalCandidates.length,0);
 state=await advance(c);assert.equal(state.run.phase,'FINAL_VOTE');assert.equal(state.caption.finalCandidates.length,1);
 state=await advance(c);assert.equal(state.caption.results[0].groupId,null);assert.equal(state.caption.results[0].score,0);assert.equal(state.scores.every((x:any)=>x.numerator===0),true);
});
