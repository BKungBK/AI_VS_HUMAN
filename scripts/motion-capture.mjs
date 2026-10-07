import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const base=process.env.DECK_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
await fs.mkdir('qa/motion',{recursive:true});await fs.mkdir('qa/motion-frames',{recursive:true});
await page.goto(base+'/?clean=1');await page.waitForFunction(()=>window.deck?.ready);await page.evaluate(()=>window.deck.pause());
const clips=[
 {name:'punch',scene:8,beat:1,from:[8,0],duration:2},
 {name:'push',scene:9,beat:0,from:[8,2],duration:2},
 {name:'dolly',scene:5,beat:3,from:[5,2],duration:2},
 {name:'poetry',scene:2,beat:1,from:[2,0],duration:2,start:4},
 {name:'confidence',scene:6,beat:1,from:[6,0],duration:2,start:4},
 {name:'ecg',scene:9,beat:0,from:[9,2],duration:2,start:4},
 {name:'formula',scene:14,beat:0,from:[13,0],duration:2,start:4}
];
const go=async(scene,beat)=>{await page.evaluate(([s,b])=>window.deck.go(s,b),[scene,beat]);await settle();};
const seek=async t=>{await page.evaluate(t=>window.deck.seek(t),t);await settle();};
const samples=[];
// Full-resolution continuous samples through camera moves and both sides of loop joins.
for(const clip of clips){
 await go(...clip.from);await seek(4);await go(clip.scene,clip.beat);
 const times=clip.start?[4,5,6,9.98,10,10.02,11.98,12,12.02]:[0,.2,.4,.6,.8,1.2,1.8,2.2,4];
 for(let i=0;i<times.length;i++){await seek(times[i]);const path=`qa/motion/${clip.name}-${i}.png`;await page.screenshot({path});samples.push({clip:clip.name,time:times[i],path,state:await page.evaluate(()=>window.deck.state())});}
 console.log('Samples:',clip.name);
}
await fs.writeFile('qa/motion-samples.json',JSON.stringify(samples,null,2));
// 14-second silent review film; rendered at 1920×1080 then encoded to 960×540.
let frame=0;const fps=30;
for(const clip of clips){
 await go(...clip.from);await seek(4);await go(clip.scene,clip.beat);
 for(let i=0;i<clip.duration*fps;i++){await seek((clip.start||0)+i/fps);await page.screenshot({path:`qa/motion-frames/${String(frame++).padStart(5,'0')}.png`});}
 console.log('Film:',clip.name,frame,'frames');
}
await browser.close();
if(errors.length)throw new Error(errors.join('\n'));
const encoded=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate',String(fps),'-i','qa/motion-frames/%05d.png','-frames:v',String(frame),'-vf','scale=960:540:flags=lanczos','-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p','-an','-movflags','+faststart','qa/motion-preview.mp4'],{stdio:'inherit'});
if(encoded.status!==0)throw new Error('FFmpeg failed');
await fs.writeFile('qa/motion-render.json',JSON.stringify({fps,frames:frame,duration:frame/fps,capture:[1920,1080],delivery:[960,540],audio:'absent',clips,errors},null,2));
console.log('Delivered:',frame/fps,'seconds /',frame,'frames');
