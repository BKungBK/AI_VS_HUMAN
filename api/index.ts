import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {networkInterfaces} from 'node:os';
import {openDatabase} from './database.ts';
import {createApp} from './app.ts';

await mkdir('data',{recursive:true});
let key:string;
try{key=(await readFile('data/host-key.txt','utf8')).trim();}catch{key=randomBytes(16).toString('hex');await writeFile('data/host-key.txt',key,{mode:0o600});}
const db=await openDatabase();
const port=Number(process.env.GAME_PORT??5180);
const app=createApp(db,key,process.env.GAME_PUBLIC_ORIGIN).listen({hostname:'0.0.0.0',port});
console.log(`HUMAN vs AI games ready: http://localhost:${port}/games`);
for(const addresses of Object.values(networkInterfaces()))for(const a of addresses??[])if(a.family==='IPv4'&&!a.internal&&!a.address.startsWith('169.254.'))console.log(`Wi-Fi/LAN: http://${a.address}:${port}/games`);
console.log('Host access key: saved in data/host-key.txt. Open Start-Game.cmd to copy it.');
let closing=false;
async function close(){if(closing)return;closing=true;await app.stop(true);await db.close();process.exit(0);}
process.on('SIGINT',close);process.on('SIGTERM',close);
