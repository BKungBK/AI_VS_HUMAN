import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {chapters} from '../src/content.ts';
import {scoreFor} from '../src/SoundScore.ts';

const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11']});
const checks=[],errors=[],runs=[];
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',name);};
const settle=p=>p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const snapshot=p=>p.evaluate(()=>{
 const s=window.deck.state();
 const styles=[...document.querySelectorAll('.spatial-host [data-text-line],.spatial-host [data-card],.spatial-host .place-plane,.spatial-host [data-token],.spatial-host [data-hazard],.spatial-host [data-glow],.spatial-host [data-breath]')].map(e=>{const c=getComputedStyle(e);return {text:e.textContent,transform:c.transform,opacity:c.opacity,shadow:c.boxShadow};});
 return {cue:s.cue,time:s.time,cameraZ:s.cameraZ,worldCamera:s.worldCamera,yaw:s.cameraYaw,pitch:s.cameraPitch,roll:s.cameraRoll,fov:s.fov,journey:s.journey,travelGates:s.travelGates,backgroundLayers:s.backgroundLayers,particles:s.particles,styles};
});
try{
 for(const preference of ['no-preference','reduce']){
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,reducedMotion:preference});
  const page=await context.newPage();page.on('pageerror',e=>errors.push({preference,message:e.message}));
  page.on('response',r=>{if(r.status()>=400)errors.push({preference,message:`${r.status()} ${r.url()}`});});
  await page.goto('http://127.0.0.1:5173/?clean=1');await page.waitForFunction(()=>window.deck?.ready);await page.evaluate(()=>window.deck.pause());
  const go=async(s,b)=>{await page.evaluate(([s,b])=>window.deck.go(s,b),[s,b]);await page.waitForFunction(id=>document.querySelector('.stage')?.dataset.cue===id,chapters[s].cues[b].id);await settle(page);};
  const seek=async t=>{await page.evaluate(t=>window.deck.seek(t),t);await settle(page);return snapshot(page);};
  const opening=await seek(.5),openingHold=await seek(4);
  check(`${preference}: opening camera and text animate`,opening.cameraZ!==openingHold.cameraZ&&JSON.stringify(opening.styles)!==JSON.stringify(openingHold.styles));
  check(`${preference}: reduction API and state are removed`,await page.evaluate(()=>!('setReduced' in window.deck)&&!('reduced' in window.deck.state())));
  await go(2,0);await seek(4);await go(5,3);
  const departure=await seek(.2),flight=await seek(.85),entry=await seek(1.6),landing=await seek(4);
  check(`${preference}: travel and dolly remain active`,flight.journey.active&&flight.journey.progress>0&&flight.journey.progress<1&&flight.travelGates===3&&Math.abs(flight.fov-landing.fov)>1);
  check(`${preference}: spatial text enters and settles`,JSON.stringify(entry.styles)!==JSON.stringify(landing.styles)&&landing.journey.progress===1);
  await seek(.85);const before=await snapshot(page);await page.emulateMedia({reducedMotion:preference==='reduce'?'no-preference':'reduce'});await settle(page);const after=await snapshot(page);
  check(`${preference}: changing OS preference cannot reset or flatten a flight`,JSON.stringify(before)===JSON.stringify(after));
  await page.emulateMedia({reducedMotion:preference});
  const sound=await page.evaluate(()=>window.deck.audio.render(4,true));const pcm=Buffer.from(sound.base64,'base64');delete sound.base64;
  await go(2,1);const poetry=await seek(4),poetryLater=await seek(6),poetryLoop=await seek(4+chapters[2].cues[1].loop);
  check(`${preference}: contextual loops animate and seek deterministically`,JSON.stringify(poetry.styles)!==JSON.stringify(poetryLater.styles)&&JSON.stringify(poetry.styles)===JSON.stringify(poetryLoop.styles));
  await go(1,0);const placeholder=await seek(.7);
  check(`${preference}: game cue keeps the approved plain design`,placeholder.travelGates===0&&placeholder.backgroundLayers===0&&placeholder.particles===0);
  await go(5,3);await page.evaluate(()=>window.deck.setFallback());const fallback=await seek(.85);
  check(`${preference}: fallback retains full camera, scenery and text`,fallback.journey.active&&fallback.journey.progress<1&&fallback.backgroundLayers===4&&fallback.styles.length>0);
  await seek(4);await page.evaluate(()=>window.deck.resume());await page.waitForTimeout(120);await page.evaluate(()=>window.deck.pause());const held=await page.evaluate(()=>window.deck.state().time);await settle(page);
  check(`${preference}: manual resume and pause still work`,held>4&&await page.evaluate(t=>window.deck.state().time===t,held));
  const blackoutDuration=await page.locator('.blackout').evaluate(e=>getComputedStyle(e).transitionDuration);
  runs.push({preference,opening,openingHold,departure,flight,entry,landing,poetry,poetryLater,poetryLoop,placeholder,fallback,blackoutDuration,sound,pcm});
  await context.close();
 }
 const [a,b]=runs;
 for(const key of ['opening','openingHold','departure','flight','entry','landing','poetry','poetryLater','poetryLoop','placeholder','fallback']){
  const same=JSON.stringify(a[key])===JSON.stringify(b[key]);
  check(`identical ${key} with either OS preference`,same,same?undefined:{first:a[key],second:b[key]});
 }
 check('blackout fade remains identical',a.blackoutDuration===b.blackoutDuration&&parseFloat(a.blackoutDuration)>0,{duration:a.blackoutDuration});
 let maxDelta=0,changed=0,sumError=0;for(let i=44;i<a.pcm.length;i+=2){const delta=Math.abs(a.pcm.readInt16LE(i)-b.pcm.readInt16LE(i));maxDelta=Math.max(maxDelta,delta);sumError+=(delta/32767)**2;if(delta)changed++;}
 const samples=(a.pcm.length-44)/2,errorDbFS=20*Math.log10(Math.sqrt(sumError/samples)||1e-12);
 // Independent WebAudio contexts can round samples differently by one PCM16 step.
 // Compare the actual amplitude error and peak, preserving identical timing and length.
 check('both preferences render the same full travel sound',a.pcm.length===b.pcm.length&&maxDelta<=1&&errorDbFS<-115&&Math.abs(a.sound.peakDbFS-b.sound.peakDbFS)<.00001,{maxPCM16Delta:maxDelta,changedSamples:changed,changedPercent:changed/samples*100,errorDbFS,peaks:[a.sound.peakDbFS,b.sound.peakDbFS]});
 check('camera score includes departure, flight and arrival',scoreFor(chapters[5].cues[3],{hasExit:true,journey:true}).events.some(e=>e.role==='travel'));
 check('no missing assets or browser runtime errors',errors.length===0,errors);
}finally{
 await browser.close();
 await fs.writeFile('qa/full-motion-checks.json',JSON.stringify({date:new Date().toISOString(),checks,errors,passed:checks.filter(c=>c.pass).length,total:checks.length,pass:checks.every(c=>c.pass)},null,2));
}
if(checks.some(c=>!c.pass))process.exitCode=1;
