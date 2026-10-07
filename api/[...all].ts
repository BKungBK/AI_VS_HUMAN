import {openDatabase} from './database.ts';
import {createApp} from './app.ts';

if(!process.env.GAME_DATABASE_URL)throw new Error('GAME_DATABASE_URL is required for the hosted game API.');
if(!process.env.GAME_HOST_KEY)throw new Error('GAME_HOST_KEY is required for the hosted game API.');

const db=await openDatabase();
const publicOrigin=process.env.GAME_PUBLIC_ORIGIN??(process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:undefined);
const app=createApp(db,process.env.GAME_HOST_KEY,publicOrigin);

export default app;
