import {openDatabase} from './database.ts';
import {createApp} from './app.ts';

type GameApp=ReturnType<typeof createApp>;
let appPromise:Promise<GameApp>|undefined;

function jsonError(error:string,status:number){
 return new Response(JSON.stringify({ok:false,error}),{
  status,
  headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
 });
}

async function getApp(){
 if(!process.env.GAME_DATABASE_URL||!process.env.GAME_HOST_KEY)throw new Error('SERVER_NOT_CONFIGURED');
 appPromise??=openDatabase().then(db=>{
  const publicOrigin=process.env.GAME_PUBLIC_ORIGIN??(process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:undefined);
  return createApp(db,process.env.GAME_HOST_KEY!,publicOrigin);
 });
 return appPromise;
}

export default {
 async fetch(request:Request){
  const incoming=new URL(request.url);
  const route=incoming.searchParams.get('__game_route');
  if(!route||!route.startsWith('/api/'))return jsonError('ROUTE_NOT_FOUND',404);

  const target=new URL(route,incoming.origin);
  incoming.searchParams.delete('__game_route');
  target.search=incoming.search;
  try{
   const app=await getApp();
   return await app.handle(new Request(target,request));
  }catch(error){
   if(error instanceof Error&&error.message==='SERVER_NOT_CONFIGURED')return jsonError('SERVER_NOT_CONFIGURED',503);
   console.error('[game-api] request initialization failed');
   return jsonError('SERVER_ERROR',500);
  }
 }
};
