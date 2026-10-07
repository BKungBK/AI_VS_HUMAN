import type {IncomingMessage,ServerResponse} from 'node:http';

type GameApp=ReturnType<typeof import('./app.ts').createApp>;
let appPromise:Promise<GameApp>|undefined;

type VercelRequest=IncomingMessage&{body?:unknown};

function jsonError(response:ServerResponse,error:string,status:number){
 response.statusCode=status;
 response.setHeader('Content-Type','application/json; charset=utf-8');
 response.setHeader('Cache-Control','no-store');
 response.end(JSON.stringify({ok:false,error}));
}

async function getApp(){
 if(!process.env.GAME_DATABASE_URL||!process.env.GAME_HOST_KEY)throw new Error('SERVER_NOT_CONFIGURED');
 appPromise??=(async()=>{
  const {openDatabase}=await import('./database.ts');
  let db;
  try{db=await openDatabase();}
  catch(error){
   console.error('[game-api] database initialization failed',error instanceof Error?error.message:'unknown error');
   throw new Error('DATABASE_UNAVAILABLE');
  }
  try{
   const {createApp}=await import('./app.ts');
   const publicOrigin=process.env.GAME_PUBLIC_ORIGIN??(process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:undefined);
   return createApp(db,process.env.GAME_HOST_KEY!,publicOrigin);
  }catch(error){
   console.error('[game-api] app initialization failed',error instanceof Error?error.message:'unknown error');
   await db.close().catch(()=>{});
   throw new Error('API_INITIALIZATION_FAILED');
  }
 })();
 return appPromise;
}

export default async function handler(request:VercelRequest,response:ServerResponse){
 try{
  const incoming=new URL(request.url??'/',`https://${request.headers.host??'localhost'}`);
  const route=incoming.searchParams.get('__game_route');
  if(!route||!route.startsWith('/api/'))return jsonError(response,'ROUTE_NOT_FOUND',404);

  const target=new URL(route,incoming.origin);
  incoming.searchParams.delete('__game_route');
  target.search=incoming.search;
  const headers=new Headers();
  for(const [name,value] of Object.entries(request.headers)){
   if(value===undefined||['host','connection','content-length','transfer-encoding','accept-encoding'].includes(name.toLowerCase()))continue;
   headers.set(name,Array.isArray(value)?value.join(', '):value);
  }
  const method=request.method??'GET';
  const body=method==='GET'||method==='HEAD'||request.body===undefined?undefined:
   typeof request.body==='string'?request.body:JSON.stringify(request.body);
  const app=await getApp();
  const result=await app.handle(new Request(target,{method,headers,...(body===undefined?{}:{body})}));

  response.statusCode=result.status;
  result.headers.forEach((value,name)=>{if(name.toLowerCase()!=='set-cookie')response.setHeader(name,value);});
  const cookies=result.headers.getSetCookie?.();
  if(cookies?.length)response.setHeader('Set-Cookie',cookies);
  if(!result.body)return response.end();
  const reader=result.body.getReader();
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   if(!response.write(Buffer.from(value)))await new Promise<void>(resolve=>response.once('drain',resolve));
  }
  response.end();
 }catch(error){
  if(error instanceof Error&&error.message==='SERVER_NOT_CONFIGURED')return jsonError(response,'SERVER_NOT_CONFIGURED',503);
  if(error instanceof Error&&error.message==='DATABASE_UNAVAILABLE')return jsonError(response,'DATABASE_UNAVAILABLE',503);
  if(error instanceof Error&&error.message==='API_INITIALIZATION_FAILED')return jsonError(response,'API_INITIALIZATION_FAILED',500);
  console.error('[game-api] request handling failed',error instanceof Error?error.message:'unknown error');
  return jsonError(response,'SERVER_ERROR',500);
 }
}
