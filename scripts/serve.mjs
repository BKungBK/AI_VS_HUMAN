import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const port=Number(process.env.PORT||5173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2','.wav':'audio/wav','.mp4':'video/mp4'};
try{await fs.access(path.join(root,'index.html'));}catch{console.error('Missing dist. Run npm run build first.');process.exit(1);}
http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('File not found');}
}).listen(port,'127.0.0.1',()=>console.log(`HUMAN vs AI ready: http://127.0.0.1:${port}/\nClean projection: http://127.0.0.1:${port}/?clean=1\nPresenter: http://127.0.0.1:${port}/?presenter=1\nCtrl+C stops the local server.`)).on('error',e=>{console.error(e.message);process.exitCode=1;});
