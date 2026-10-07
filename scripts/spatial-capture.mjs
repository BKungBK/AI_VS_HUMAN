import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const film=process.argv.includes('--film');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:film?1280:1920,height:film?720:1080},deviceScaleFactor:1}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const go=async(s,b)=>{await page.evaluate(([s,b])=>window.deck.go(s,b),[s,b]);await settle();};
const seek=async t=>{await page.evaluate(t=>window.deck.seek(t),t);await settle();};
const clips=[
 {name:'arc',from:[0,0],to:[0,2]},
 {name:'punch',from:[8,0],to:[8,1]},
 {name:'push',from:[8,2],to:[9,0]},
 {name:'dolly',from:[5,2],to:[5,3]},
 {name:'reverse',from:[0,3],to:[0,2]},
 {name:'formula',from:[13,0],to:[14,0]}
];
await fs.mkdir('qa/spatial-motion/frames',{recursive:true});
await page.goto('http://127.0.0.1:5173/?clean=1');await page.waitForFunction(()=>window.deck?.ready);await page.evaluate(()=>window.deck.pause());
let frame=0;const fps=30,samples=[];
for(const clip of clips){
 await go(...clip.from);await seek(4);await go(...clip.to);
 const times=film?Array.from({length:90},(_,i)=>i/fps):[0,.15,.3,.45,.6,.8,1.05,1.4,1.8,2.4,4,10];
 for(let i=0;i<times.length;i++){
  await seek(times[i]);const path=film?`qa/spatial-motion/frames/${String(frame++).padStart(5,'0')}.png`:`qa/spatial-motion/${clip.name}-${i}.png`;
  await page.screenshot({path});if(!film)samples.push({clip:clip.name,time:times[i],path,state:await page.evaluate(()=>window.deck.state())});
 }
 console.log(film?'Film':'Samples',clip.name);
}
await browser.close();if(errors.length)throw new Error(errors.join('\n'));
if(!film)await fs.writeFile('qa/spatial-motion/samples.json',JSON.stringify(samples,null,2));
else{
 const encode=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate',String(fps),'-i','qa/spatial-motion/frames/%05d.png','-frames:v',String(frame),'-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p','-an','-movflags','+faststart','qa/spatial-transition-preview.mp4'],{stdio:'inherit'});
 if(encode.status!==0)throw new Error('Encoding failed');
 await fs.writeFile('qa/spatial-motion/render.json',JSON.stringify({frames:frame,fps,duration:frame/fps,stage:[1920,1080],capture:[1280,720],audio:'absent',clips,errors},null,2));
}
