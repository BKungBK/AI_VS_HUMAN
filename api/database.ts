import {PGlite} from '@electric-sql/pglite';
import pg from 'pg';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {seedSwipeContent} from './games/swipe-court-content.ts';
import {seedCaptionContent} from './games/caption-content.ts';
import {seedRouletteContent} from './games/roulette-content.ts';
import {seedWhackContent} from './games/whack-content.ts';
import {seedShieldContent} from './games/shield-content.ts';
import {seedPieceContent} from './games/piece-content.ts';

export interface Database {
 query<T = Record<string, unknown>>(sql:string, params?:unknown[]): Promise<{rows:T[]}>;
 exec(sql:string): Promise<unknown>;
 close():Promise<void>;
}
export async function openDatabase(path=process.env.GAME_DATA_DIR ?? 'data/pg'):Promise<Database> {
 let db:Database;
 if(process.env.GAME_DATABASE_URL) {
  const pool=new pg.Pool({connectionString:process.env.GAME_DATABASE_URL,max:Number(process.env.GAME_DB_POOL_SIZE??1)});
  db={query:async<T>(sql:string,params?:unknown[])=>{const r=await pool.query(sql,params);return {rows:r.rows as T[]};},exec:sql=>pool.query(sql),close:()=>pool.end()};
 } else {
  if(path!==':memory:') await mkdir(resolve(path),{recursive:true});
  db=new PGlite(path===':memory:'?undefined:resolve(path)) as Database;
 }
 await db.exec(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../db/caption.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../db/roulette.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../db/whack.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../db/shield.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../db/piece.sql',import.meta.url),'utf8'));
 await seedSwipeContent(db);
 await seedCaptionContent(db);
 await seedRouletteContent(db);
 await seedWhackContent(db);
 await seedShieldContent(db);
 await seedPieceContent(db);
 return db;
}
