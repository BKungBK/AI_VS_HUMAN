import {Elysia,t} from 'elysia';
import {node} from '@elysiajs/node';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import QRCode from 'qrcode';
import type {Database} from './database.ts';
import {groupNames} from './group-names.ts';
import {validateCommand} from './validation.ts';
import {allCues} from '../src/content.ts';
import {prepareCaption} from '../src/shared/caption-text.ts';

const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.wav':'audio/wav'};
const roleSchema=t.Union([t.Literal('player'),t.Literal('host'),t.Literal('display')]);
type Role='player'|'host'|'display';
const fail=(error:string)=>({ok:false,error});
export function createApp(db:Database,hostKey:string,publicOrigin?:string) {
 const secureCookies=process.env.NODE_ENV==='production'||publicOrigin?.startsWith('https:')===true;
 const identity=(request:Request,role?:string)=>{
  const selected=role??request.headers.get('x-game-role')??'player';
  if(!['player','host','display'].includes(selected))return null;
  const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(`game_${selected}=`))?.split('=')[1];
  if(!token)return null;
  return {tokenHash:hash(token),role:selected};
 };
 const actor=async(request:Request,role?:string)=>{
  const selected=identity(request,role);if(!selected)return null;
  return (await db.query<{id:string;role:string}>('SELECT id,role FROM game.actors WHERE token_hash=$1 AND role=$2',[selected.tokenHash,selected.role])).rows[0]??null;
 };
 const issue=async(role:Role,token=randomBytes(32).toString('hex'))=>{
  const r=await db.query<{id:string}>('INSERT INTO game.actors(role,token_hash) VALUES($1,$2) ON CONFLICT(token_hash) DO UPDATE SET token_hash=excluded.token_hash RETURNING id',[role,hash(token)]);
  return {id:r.rows[0].id,token};
 };
 const cookie=(role:string,token:string)=>`game_${role}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=2592000${secureCookies?'; Secure':''}`;
 // Authentication does not use nickname, claimed actor ID, or frontend scores.
 const app=new Elysia({adapter:node(),serve:{maxRequestBodySize:16384}})
 .onRequest(({request,set})=>{
  set.headers['Cache-Control']='no-store';set.headers['X-Content-Type-Options']='nosniff';
  set.headers['X-Game-Transport']=process.env.VERCEL?'poll':'sse';
  set.headers['X-Game-Release']='connection-v2';
  const origin=request.headers.get('origin');
  if(request.method!=='GET'&&origin&&origin!==new URL(request.url).origin) {set.status=403;return fail('ORIGIN_REJECTED');}
 })
 .onError(({code,error,request,set})=>{if(code!=='VALIDATION')console.error('[game-api]',request.method,new URL(request.url).pathname,code,error instanceof Error?error.message:'unknown error');set.status=code==='VALIDATION'?400:500;return fail(code==='VALIDATION'?'INVALID_REQUEST':'SERVER_ERROR');})
 .get('/api/health',()=>({ok:true,mode:process.env.GAME_DATABASE_URL?'postgres':'local-pglite',transport:process.env.VERCEL?'poll':'sse',game:'human-vs-ai',release:'connection-v2'}))
 .post('/api/session',async({request,body,set})=>{
  const existing=await actor(request,body.role);if(existing)return {ok:true};
  const s=await issue(body.role);set.headers['Set-Cookie']=cookie(body.role,s.token);return {ok:true};
 },{body:t.Object({role:t.Union([t.Literal('player'),t.Literal('display')])},{additionalProperties:false})})
 .post('/api/host/login',async({body,set})=>{
  const candidate=hash(body.key);const expected=hash(hostKey);
  if(!timingSafeEqual(Buffer.from(candidate),Buffer.from(expected))){set.status=403;return fail('HOST_KEY_INVALID');}
  const s=await issue('host',hash(`host-session:${hostKey}`));set.headers['Set-Cookie']=cookie('host',s.token);return {ok:true};
 },{body:t.Object({key:t.String({minLength:1,maxLength:100})},{additionalProperties:false})})
 .post('/api/rooms',async({request,body,set})=>{
  const a=await actor(request,'host');if(!a){set.status=401;return fail('UNAUTHORIZED');}
  const code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();
  // Single statement transaction: room + eight stable group IDs.
   await db.query(`WITH room AS (INSERT INTO game.rooms(code,host_id,capacity,cue) VALUES($1,$2,$3,'01.02') RETURNING code)
   INSERT INTO game.groups(room_code,id,name)
   SELECT room.code,group_row.ordinality::int,group_row.name
   FROM room CROSS JOIN unnest($4::text[]) WITH ORDINALITY AS group_row(name,ordinality)`,[code,a.id,body.capacity,[...groupNames]]);
  return {ok:true,data:{code}};
 },{body:t.Object({capacity:t.Integer({minimum:1,maximum:64})},{additionalProperties:false})})
 .get('/api/rooms',async({request,set})=>{
  const a=await actor(request,'host');if(!a){set.status=401;return fail('UNAUTHORIZED');}
  return {ok:true,data:(await db.query('SELECT code,cue,capacity FROM game.rooms WHERE host_id=$1 ORDER BY created_at DESC',[a.id])).rows};
 })
 .get('/api/rooms/:code/lobby',async({params})=>{
  const rooms=await db.query('SELECT code,capacity,team_locked,cue FROM game.rooms WHERE code=$1',[params.code]);
  if(!rooms.rows.length)return fail('ROOM_NOT_FOUND');
  const groups=await db.query('SELECT g.id,g.name,count(m.id)::int AS members FROM game.groups g LEFT JOIN game.members m ON m.room_code=g.room_code AND m.group_id=g.id AND m.active WHERE g.room_code=$1 GROUP BY g.id,g.name ORDER BY g.id',[params.code]);
  return {ok:true,data:{room:rooms.rows[0],groups:groups.rows}};
 })
 .get('/api/rooms/:code/snapshot',async({request,params,set})=>{
  const selected=identity(request);if(!selected){set.status=401;return fail('UNAUTHORIZED');}
  const start=performance.now();
  const result=(await db.query<{result:unknown}>('SELECT game.snapshot(id,$1) AS result FROM game.actors WHERE token_hash=$2 AND role=$3',[params.code,selected.tokenHash,selected.role])).rows[0];
  set.headers['Server-Timing']=`snapshot;dur=${(performance.now()-start).toFixed(1)}`;
  if(!result){set.status=401;return fail('UNAUTHORIZED');}
  return result.result;
 })
 .post('/api/rooms/:code/commands/:kind',async({request,params,body,set})=>{
  const selected=identity(request);if(!selected){set.status=401;return fail('UNAUTHORIZED');}
  if(!validateCommand(params.kind,body.payload)){set.status=400;return fail('INVALID_REQUEST');}
  if(params.kind==='cue'&&!allCues.some(c=>c.cue.id===body.payload.cue)){set.status=400;return fail('INVALID_CUE');}
  if(params.kind==='caption'){
   try{Object.assign(body.payload,prepareCaption(body.payload.text as string));}
   catch(e){set.status=400;return fail(e instanceof Error?e.message:'CAPTION_FORMAT');}
  }
  const result=(await db.query<{result:unknown}>('SELECT game.command(id,$1,$2,$3::jsonb,$4) AS result FROM game.actors WHERE token_hash=$5 AND role=$6',[params.code,params.kind,JSON.stringify(body.payload),body.key,selected.tokenHash,selected.role])).rows[0];
  if(!result){set.status=401;return fail('UNAUTHORIZED');}
  return result.result;
 },{body:t.Object({key:t.String({minLength:1,maxLength:100}),payload:t.Record(t.String(),t.Unknown())},{additionalProperties:false})})
 .get('/api/rooms/:code/events',async({request,params,query,set})=>{
  const a=await actor(request,query.role);if(!a){set.status=401;return fail('UNAUTHORIZED');}
  const allowed=(await db.query<{result:{ok:boolean}}>('SELECT game.snapshot($1,$2) AS result',[a.id,params.code])).rows[0].result;
  if(!allowed.ok){set.status=403;return fail('FORBIDDEN');}
  // Older clients may still request SSE. Finish the serverless request promptly;
  // current clients negotiate polling through X-Game-Transport.
  if(process.env.VERCEL)return new Response('retry: 15000\n\ndata: {"transport":"poll"}\n\n',{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Game-Transport':'poll'}});
  let timer:ReturnType<typeof setTimeout>|undefined;let closed=false;let last=Number(query.after)||0;
  const encoder=new TextEncoder();
  const stream=new ReadableStream<Uint8Array>({
   start(controller){
    controller.enqueue(encoder.encode('retry: 2000\n\n'));
    const tick=async()=>{
     try{
      if(closed)return;
      // Reauthorize every poll: explicit leave revokes even an existing SSE connection.
      const permission=await db.query<{allowed:boolean}>(`SELECT (a.role='display' OR (a.role='host' AND r.host_id=a.id) OR EXISTS(SELECT 1 FROM game.members WHERE actor_id=a.id AND room_code=r.code AND active)) allowed FROM game.actors a CROSS JOIN game.rooms r WHERE a.id=$1 AND r.code=$2`,[a.id,params.code]);
      if(!permission.rows[0]?.allowed){closed=true;controller.close();return;}
      const rows=await db.query<{id:string;room_version:number}>('SELECT id,room_version FROM game.outbox WHERE room_code=$1 AND id>$2 ORDER BY id LIMIT 50',[params.code,last]);
      if(closed)return;
      if(rows.rows.length){last=Number(rows.rows.at(-1)!.id);controller.enqueue(encoder.encode(`id: ${last}\ndata: ${JSON.stringify({eventId:last,scope:'room',roomVersion:rows.rows.at(-1)!.room_version})}\n\n`));}
      else controller.enqueue(encoder.encode(': keepalive\n\n'));
     }catch{if(!closed){closed=true;controller.close();}}
     if(!closed)timer=setTimeout(tick,500);
    };
    timer=setTimeout(tick,500);
   },cancel(){closed=true;if(timer)clearTimeout(timer);}
  });
  return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'}});
 },{query:t.Object({role:roleSchema,after:t.Optional(t.String())})})
 .get('/api/rooms/:code/qr',async({params,request,set})=>{
  const exists=await db.query('SELECT code FROM game.rooms WHERE code=$1',[params.code]);if(!exists.rows.length){set.status=404;return '';}
  const url=`${publicOrigin??new URL(request.url).origin}/play/${params.code}`;
  return new Response(await QRCode.toString(url,{type:'svg',margin:3,errorCorrectionLevel:'M',color:{dark:'#0D1117',light:'#FFFFFF'}}),{headers:{'Content-Type':'image/svg+xml','Cache-Control':'no-store'}});
 })
 .get('/api/rooms/:code/export',async({params,request,set})=>{
  const a=await actor(request,'host');if(!a){set.status=401;return fail('UNAUTHORIZED');}
  const allowed=await db.query('SELECT code FROM game.rooms WHERE code=$1 AND host_id=$2',[params.code,a.id]);if(!allowed.rows.length){set.status=403;return fail('FORBIDDEN');}
  const r=await db.query(`SELECT r.id,r.game_id,r.status,r.content_version,r.scoring_version,r.schedule_version,r.timing_profile,r.pause_history,r.input_digest,cf.scores,cf.created_at confirmed_at FROM game.runs r LEFT JOIN game.confirmations cf ON cf.run_id=r.id WHERE r.room_code=$1 ORDER BY r.created_at`,[params.code]);
  const audit=await db.query('SELECT actor_id,kind,payload,created_at FROM game.audit WHERE room_code=$1 ORDER BY id',[params.code]);
  const creative=await db.query(`SELECT r.id run_id,content.task,content.image_path,content.ai_caption,content.ai_metadata,
   (SELECT coalesce(jsonb_agg(to_jsonb(ro)),'[]') FROM game.rosters ro WHERE ro.run_id=r.id) roster,
   (SELECT coalesce(jsonb_agg(to_jsonb(sub)),'[]') FROM game.caption_submissions sub WHERE sub.run_id=r.id) submissions,
   (SELECT coalesce(jsonb_agg(to_jsonb(vote)),'[]') FROM game.caption_votes vote WHERE vote.run_id=r.id) votes,
   (SELECT coalesce(jsonb_agg(to_jsonb(candidate) ORDER BY position),'[]') FROM game.caption_candidates candidate WHERE candidate.run_id=r.id) candidates,
   game.caption_results(r.id) results FROM game.runs r JOIN game.caption_content content ON content.version=r.content_version WHERE r.room_code=$1 AND r.game_id='caption-battle'`,[params.code]);
  set.headers['Content-Disposition']=`attachment; filename="human-vs-ai-${params.code}.json"`;return {room:params.code,runs:r.rows,audit:audit.rows,creative:creative.rows};
 })
 .get('/*',async({params,set})=>{
  if(params['*'].startsWith('api/')){set.status=404;return fail('NOT_FOUND');}
  const root=resolve('dist');let path=resolve(root,params['*']||'index.html');
  if(path!==root&&!path.startsWith(root+sep)){set.status=403;return '';}
  try{if(!(await stat(path)).isFile())path=resolve(root,'index.html');}catch{path=resolve(root,'index.html');}
  try{return new Response(new Uint8Array(await readFile(path)),{headers:{'Content-Type':mime[extname(path)]??'application/octet-stream'}});}catch{set.status=503;return 'Run npm run build first.';}
 });
 return app;
}
