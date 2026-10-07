import {afterEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {api,command,GameError} from '../src/game-client/network.ts';

const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
const reply=(data:unknown)=>new Response(JSON.stringify({ok:true,data}),{headers:{'Content-Type':'application/json','X-Game-Transport':'poll'}});
test('a response slower than the former six-second cutoff still succeeds',async()=>{
 globalThis.fetch=async(_url,options)=>{
  assert.equal(options?.credentials,'same-origin');
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,6500);options?.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(options.signal?.reason);},{once:true});});
  return reply({connected:true});
 };
 assert.deepEqual(await api('/health','player'),{connected:true});
});
test('a lost command response retries the exact idempotency key and payload',async()=>{
 const bodies:string[]=[];globalThis.fetch=async(_url,options)=>{bodies.push(options?.body as string);if(bodies.length===1)throw new TypeError('Connection lost');return reply({accepted:5});};
 assert.deepEqual(await command('TEST01','player','tap',{phaseToken:'same-phase',events:[{id:'same-event'}]},'same-key'),{accepted:5});
 assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1]);
});
test('business errors do not retry or replace player identity',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({ok:false,error:'STALE_PHASE'}));};
 await assert.rejects(command('TEST01','player','tap',{}),e=>e instanceof GameError&&e.code==='STALE_PHASE');assert.equal(calls,1);
});
test('simultaneous expired-player requests share one session repair',async()=>{
 let sessions=0,repaired=false;globalThis.fetch=async(url)=>{
  if(String(url).endsWith('/session')){sessions++;await new Promise(resolve=>setTimeout(resolve,20));repaired=true;return reply({});}
  return repaired?reply({accepted:1}):new Response(JSON.stringify({ok:false,error:'UNAUTHORIZED'}),{status:401});
 };
 const results=await Promise.all([command('TEST01','player','ready',{},'a'),command('TEST01','player','ready',{},'b')]);
 assert.equal(sessions,1);assert.equal(results.every(x=>x.accepted===1),true);
});
test('host authorization failure requires login instead of minting a public session',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({ok:false,error:'UNAUTHORIZED'}),{status:401});};
 await assert.rejects(command('TEST01','host','heartbeat',{}),e=>e instanceof GameError&&e.code==='UNAUTHORIZED');assert.equal(calls,1);
});
