import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../api/app.ts';
import {openDatabase,type Database} from '../api/database.ts';

let db:Database,app:ReturnType<typeof createApp>,code:string;
const cookies:Record<string,string>={};
const previousVercel=process.env.VERCEL;
before(async()=>{process.env.VERCEL='1';db=await openDatabase(':memory:');app=createApp(db,'connectivity-test-key');});
after(async()=>{await db.close();if(previousVercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=previousVercel;});
async function request(path:string,role:string,body?:unknown,withCookie=true){
 const response=await app.handle(new Request(`http://localhost/api${path}`,{
  method:body===undefined?'GET':'POST',headers:{'x-game-role':role,...(withCookie&&cookies[role]?{cookie:cookies[role]}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},
  body:body===undefined?undefined:JSON.stringify(body)
 }));
 const cookie=response.headers.get('set-cookie');if(cookie)cookies[role]=cookie.split(';')[0];
 return response;
}
test('hosted API negotiates polling and host login creates a usable session',async()=>{
 const health=await request('/health','display');assert.equal(health.headers.get('x-game-transport'),'poll');assert.equal((await health.json()).release,'connection-v2');
 const invalid=await request('/host/login','host',{key:'wrong'});assert.equal(invalid.status,403);
 assert.equal((await request('/host/login','host',{key:'connectivity-test-key'})).status,200);
 const room=await (await request('/rooms','host',{capacity:32})).json();assert.equal(room.ok,true);code=room.data.code;
 assert.equal((await request('/rooms','host')).status,200);
});
test('snapshot authorizes roles in the same query and preserves member checks',async()=>{
 assert.equal((await request(`/rooms/${code}/snapshot`,'host',undefined,false)).status,401);
 assert.equal((await (await request('/session','display',{role:'display'})).json()).ok,true);
 const snapshot=await request(`/rooms/${code}/snapshot`,'display');assert.match(snapshot.headers.get('server-timing')??'',/snapshot;dur=/);assert.equal((await snapshot.json()).data.room.code,code);
 await request('/session','player',{role:'player'});
 assert.equal((await (await request(`/rooms/${code}/snapshot`,'player')).json()).error,'NOT_A_MEMBER');
 const spoof=await app.handle(new Request(`http://localhost/api/rooms/${code}/snapshot`,{headers:{'x-game-role':'host',cookie:cookies.display}}));assert.equal(spoof.status,401);
});
test('player joins and retries retain one member and the original identity',async()=>{
 const body={key:randomUUID(),payload:{nickname:'Connectivity player',groupId:1}};
 const first=await (await request(`/rooms/${code}/commands/join`,'player',body)).json();assert.equal(first.ok,true);
 assert.deepEqual(await (await request(`/rooms/${code}/commands/join`,'player',body)).json(),first);
 const previous=cookies.player;await request('/session','player',{role:'player'});assert.equal(cookies.player,previous);
 const snapshot=await (await request(`/rooms/${code}/snapshot`,'player')).json();assert.equal(snapshot.ok,true);assert.equal(snapshot.data.me.nickname,'Connectivity player');
 assert.equal(snapshot.data.groups[0].members,1);
 const forbidden=await (await request(`/rooms/${code}/commands/acquire`,'player',{key:randomUUID(),payload:{controllerId:'test'}})).json();assert.equal(forbidden.error,'FORBIDDEN');
});
test('legacy hosted SSE ends promptly without an infinite polling loop',async()=>{
 const events=await request(`/rooms/${code}/events?role=display`,'display');assert.equal(events.status,200);assert.equal(events.headers.get('x-game-transport'),'poll');
 const text=await Promise.race([events.text(),new Promise<never>((_,reject)=>{const timer=setTimeout(()=>reject(new Error('SSE did not finish')),1000);timer.unref();})]);
 assert.match(text,/retry: 15000/);assert.match(text,/"transport":"poll"/);
});
test('simultaneous host/player/display snapshots succeed without a stream',async()=>{
 for(let cycle=0;cycle<10;cycle++){
  const replies=await Promise.all(['host','player','display'].map(async role=>(await (await request(`/rooms/${code}/snapshot`,role)).json())));
  assert.equal(replies.every(reply=>reply.ok&&reply.data.room.code===code),true);
 }
});
test('deployment readiness fails clearly when migrations are missing',async()=>{
 await assert.rejects(openDatabase(':memory:',{bootstrap:false}),/migrations have not been applied/);
});
