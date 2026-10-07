import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
const base=process.env.GAME_TEST_ORIGIN??'http://127.0.0.1:5180';
const count=Number(process.env.GAME_LOAD_PLAYERS??32);
const eventsPerPlayer=60;
const batchSize=10;
const key=(await readFile('data/host-key.txt','utf8')).trim();
const latency=[],errors=[],counts={accepted:0,rejected:0,batches:0};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function client(role){let cookie='';return {role,async req(path,body,measure=false){const begin=performance.now();const r=await fetch(`${base}/api${path}`,{method:body?'POST':'GET',headers:{'x-game-role':role,'Cookie':cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];const data=await r.json();if(measure)latency.push(performance.now()-begin);return data;},async cmd(code,kind,payload,measure=false){return this.req(`/rooms/${code}/commands/${kind}`,{key:randomUUID(),payload},measure);}};}
const host=client('host');assert.equal((await host.req('/host/login',{key})).ok,true);
const code=(await host.req('/rooms',{capacity:count})).data.code;
const players=Array.from({length:count},()=>client('player'));
await Promise.all(players.map(async(p,i)=>{await p.req('/session',{role:'player'});assert.equal((await p.cmd(code,'join',{nickname:`โหลด ${i+1}`,groupId:i%6+1})).ok,true);const s=(await p.req(`/rooms/${code}/snapshot`)).data;await p.cmd(code,'side',{previewId:s.room.previewId,side:i%2?'AI':'HUMAN',expectedRevision:0});await p.cmd(code,'ready',{previewId:s.room.previewId,contentVersion:'trust-tug-v1'});}));
await host.cmd(code,'acquire',{controllerId:'load-host'});
let s=(await host.req(`/rooms/${code}/snapshot`)).data;
const control=()=>({controllerId:'load-host',controllerEpoch:s.host.controllerEpoch,expectedVersion:s.room.version});
assert.equal((await host.cmd(code,'start',{...control(),timingProfile:'normal'})).ok,true);
s=(await host.req(`/rooms/${code}/snapshot`)).data;
const runId=s.run.id;
const state=await Promise.all(players.map(async p=>{await p.cmd(code,'writer',{runId,writerId:'load-input'});return (await p.req(`/rooms/${code}/snapshot`)).data;}));
await sleep(Math.max(0,s.run.deadline-Date.now())+20);
await Promise.all(players.map(async(p,i)=>{state[i]=(await p.req(`/rooms/${code}/snapshot`)).data;}));
const begin=performance.now();
const jobs=[];
for(let tick=0;tick<eventsPerPlayer/batchSize;tick++){
 await sleep(Math.max(0,begin+tick*400-performance.now()));
 for(let i=0;i<count;i++){
  const p=players[i],st=state[i];
  jobs.push(p.cmd(code,'tap',{runId,phaseToken:st.run.phaseToken,writerId:'load-input',inputEpoch:st.me.state.input_epoch,events:Array.from({length:batchSize},(_,j)=>({id:randomUUID(),sequence:tick*batchSize+j+1}))},true).then(r=>{counts.batches++;if(!r.ok){if(r.error==='INPUT_CLOSED')counts.rejected+=batchSize;else errors.push(r.error);return;}counts.accepted+=r.data.added;counts.rejected+=r.data.events.filter(e=>!e.accepted).length;}).catch(e=>errors.push(e.message)));
 }
}
await Promise.all(jobs);
s=(await host.req(`/rooms/${code}/snapshot`)).data;
const locked=await Promise.all(players.map(async p=>(await p.req(`/rooms/${code}/snapshot`)).data));
for(let wait=0;s.run.status==='RUNNING'&&wait<24;wait++){await sleep(500);s=(await host.req(`/rooms/${code}/snapshot`)).data;}
assert.equal(s.run.status,'RESULT');
const finish=await host.cmd(code,'finish',{...control(),inputDigest:s.host.inputDigest});assert.equal(finish.ok,true,JSON.stringify(finish));
const result=(await host.req(`/rooms/${code}/snapshot`)).data;
const sorted=latency.sort((a,b)=>a-b),pct=p=>Math.round(sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)]*100)/100;
const report={date:new Date().toISOString(),environment:'Local Windows / Elysia / persistent PGlite / loopback HTTP; not cloud staging',players:count,room:code,attemptedEvents:eventsPerPlayer*count,counts,latencyMs:{p50:pct(.5),p95:pct(.95),p99:pct(.99),max:Math.round(sorted.at(-1))},individualAccepted:locked.map(x=>x.me.state.accepted),confirmedScores:result.confirmedScores,eventsPerPlayer,batchSize,passed:errors.length===0&&locked.every(x=>x.me.state.accepted===eventsPerPlayer)&&result.run.status==='COMPLETED'};
await mkdir('qa/game1',{recursive:true});await writeFile(`qa/game1/load-${count}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.equal(report.passed,true,'load scoring gate');
