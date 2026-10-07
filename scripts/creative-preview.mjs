import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const rhythm=process.argv.includes('--rhythm'),out=rhythm?'qa/card-rhythm':'qa/creative-direction',video=process.argv.includes('--video');
const shots=rhythm?[[0,0,'opening'],[6,1,'mushroom'],[9,2,'verification']]:[[8,1,'empathy'],[9,2,'verification'],[10,2,'gavel']],shotDuration=rhythm?10:8;
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const go=async(s,b)=>{await page.evaluate(([s,b])=>window.deck.go(s,b),[s,b]);await settle();};
const seek=async t=>{await page.evaluate(t=>window.deck.seek(t),t);await settle();};
try{
 await page.goto('http://127.0.0.1:5173/?clean=1');await page.waitForFunction(()=>window.deck?.ready);await page.evaluate(()=>window.deck.pause());
 for(const [s,b,id] of shots){
  await go(s,b);await seek(4);await page.screenshot({path:`${out}/${id}.png`});console.log('CAPTURE',id);
 }
 await go(10,2);
 for(const [i,t] of [2.8,3.35,3.6,3.72,3.86,4.1,5.5].entries()){
  await seek(t);await page.screenshot({path:`${out}/gavel-${i}.png`});
 }
 if(video){
  await page.setViewportSize({width:1280,height:720});await fs.mkdir(`${out}/frames`,{recursive:true});
  const sounds=[];let frame=0;
  for(const [s,b,id] of shots){
   await go(2,0);await seek(4);await go(s,b);const sound=await page.evaluate(t=>window.deck.audio.render(t,false),shotDuration);await fs.writeFile(`${out}/${id}.wav`,Buffer.from(sound.base64,'base64'));delete sound.base64;sounds.push({id,...sound});
   for(let f=0;f<shotDuration*30;f++){
    await seek(f/30);await page.screenshot({path:`${out}/frames/${String(frame++).padStart(5,'0')}.jpg`,type:'jpeg',quality:90});
   }
   console.log('RENDERED',id,`${shotDuration}s`);
  }
  const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','30','-i',`${out}/frames/%05d.jpg`,...shots.flatMap(([, ,id])=>['-i',`${out}/${id}.wav`]),'-filter_complex','[1:a][2:a][3:a]concat=n=3:v=0:a=1[a]','-map','0:v','-map','[a]','-c:v','libx264','-crf','19','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-t',String(shotDuration*shots.length),'-movflags','+faststart',`${out}/creative-preview.mp4`],{stdio:'inherit'});
  if(r.status!==0)throw new Error('FFmpeg preview encode failed');
  await fs.writeFile(`${out}/preview-render.json`,JSON.stringify({width:1280,height:720,fps:30,frames:frame,duration:shotDuration*shots.length,sounds},null,2));
 }
}finally{await browser.close();}
