import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {allCues} from '../src/content.ts';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),checks=[],errors=[];
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',name);};
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const pose=()=>page.evaluate(()=>({heading:document.querySelector('.spatial-host h1').textContent,styles:[...document.querySelectorAll('.spatial-host .visual-world *')].map(e=>({style:e.getAttribute('style'),transform:e.getAttribute('transform'),opacity:e.getAttribute('opacity')})),confidence:document.querySelector('[data-confidence]')?.textContent}));
const seek=async t=>{await page.evaluate(t=>window.deck.seek(t),t);await settle();return pose();};
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5173/?clean=1');await page.waitForFunction(()=>window.deck?.ready);await page.evaluate(()=>window.deck.pause());
 for(const {scene,beat,cue} of allCues.filter(c=>c.cue.kind==='content')){
  await page.evaluate(([s,b])=>window.deck.go(s,b),[scene,beat]);await page.waitForFunction(id=>document.querySelector('.stage')?.dataset.cue===id,cue.id);await settle();
  const a=await seek(20),b=await seek(20+cue.loop);await seek(2.8+cue.loop*.2);const c=await seek(20);
  const diffs=a.styles.map((s,i)=>JSON.stringify(s)===JSON.stringify(b.styles[i])?null:{i,a:s,b:b.styles[i]}).filter(Boolean);
  check(`loop and reverse seek ${cue.id}`,JSON.stringify(a)===JSON.stringify(b)&&JSON.stringify(a)===JSON.stringify(c),diffs.length?diffs.slice(0,4):undefined);
 }
 await page.evaluate(()=>window.deck.go(9,2));await settle();await seek(4);
 const clear=await page.evaluate(()=>{const ecg=document.querySelector('.spatial-host .ecg').getBoundingClientRect(),label=document.querySelector('.spatial-host .card-label').getBoundingClientRect();return ecg.bottom<label.top;});
 check('ECG clears the verification label',clear);
 await page.evaluate(()=>window.deck.go(10,2));await settle();await seek(3.72);
 const contact=await page.evaluate(()=>{const root=document.querySelector('.material-gavel'),tool=root.querySelector('.gavel-tool'),matrix=tool.transform.baseVal.consolidate().matrix,tip=new DOMPoint(257,266).matrixTransform(matrix);return {gap:284-tip.y,offset:tip.x-260,gradientCount:root.querySelectorAll('linearGradient').length};});
 check('gavel head contacts the center of its block',Math.abs(contact.gap)<3&&Math.abs(contact.offset)<12&&contact.gradientCount===4,contact);
 check('no runtime errors',errors.length===0,errors);
}finally{await browser.close();await fs.writeFile('qa/creative-direction/loop-checks.json',JSON.stringify({checks,errors,pass:checks.every(c=>c.pass)},null,2));}
if(checks.some(c=>!c.pass))process.exitCode=1;
