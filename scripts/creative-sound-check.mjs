import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {allCues,chapters} from '../src/content.ts';
import {scoreFor} from '../src/SoundScore.ts';
const out='qa/creative-direction/audio-renders';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),renders=[],checks=[],errors=[];
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',name);};
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5173/?clean=1');await page.waitForFunction(()=>window.deck?.ready);await page.evaluate(()=>window.deck.pause());
 await page.keyboard.press('h');await page.locator('.sound-control').click();await page.waitForFunction(()=>window.deck.audio.state().status==='ready');
 for(const {scene,beat,cue} of allCues){
  await page.evaluate(([s,b])=>window.deck.go(s,b),[scene,beat]);await page.waitForFunction(id=>document.querySelector('.stage')?.dataset.cue===id,cue.id);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const r=await page.evaluate(()=>window.deck.audio.render(4,false));await fs.writeFile(`${out}/${cue.id}.wav`,Buffer.from(r.base64,'base64'));delete r.base64;
  renders.push({cue:cue.id,kind:cue.kind,...r});
 }
 check('42 current cue scores render locally through the production mix',renders.length===42&&renders.every(r=>r.channels===2&&r.sampleRate===48000&&r.peakDbFS<-10&&r.peakDbFS>-70),{worstPeakDbFS:Math.max(...renders.map(r=>r.peakDbFS))});
 const plan=scoreFor(chapters[5].cues[3],{hasExit:true,journey:true});
 check('a journey has one arrival after the camera flight',plan.events.filter(e=>e.role==='arrival').length===1&&plan.events.find(e=>e.role==='arrival').at===1.72&&plan.events.every(e=>e.role!=='title'),plan);
 check('travel follows the camera with a narrower pan and lower gain',plan.events.some(e=>e.role==='travel'&&e.at===.16&&e.gain===.48&&e.pan===-.12&&e.panEnd===.12));
 check('visual strike loops do not inject repeating impacts',!scoreFor(chapters[10].cues[2],{journey:true}).events.some(e=>/gavel|impact/.test(e.asset)));
 check('no browser runtime errors',errors.length===0,errors);
}finally{await browser.close();await fs.writeFile('qa/creative-direction/sound-checks.json',JSON.stringify({checks,renders,errors,pass:checks.every(c=>c.pass)},null,2));}
if(checks.some(c=>!c.pass))process.exitCode=1;
