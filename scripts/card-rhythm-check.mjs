import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {allCues} from '../src/content.ts';
const out='qa/card-rhythm';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',name);};
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const seek=async t=>{await page.evaluate(t=>window.deck.seek(t),t);await settle();};
const go=async(s,b)=>{await page.evaluate(([s,b])=>window.deck.go(s,b),[s,b]);await settle();};
const rects=()=>page.evaluate(()=>{
 const root=document.querySelector('.spatial-host .visual-world'),r=e=>{const b=e.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};};
 return {cards:[...root.querySelectorAll('.spatial-card,.formula-step,.horizon-world')].map(e=>({rect:r(e),translate:getComputedStyle(e).translate,light:e.style.getPropertyValue('--ambient-light')})),heading:r(document.querySelector('.spatial-host h1')),overflow:[...root.querySelectorAll('.glass-inner')].filter(e=>e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2).map(e=>({text:e.textContent.slice(0,65),height:e.clientHeight,scroll:e.scrollHeight})),timing:window.deck.state().motionTiming};
});
try{
 await page.goto('http://127.0.0.1:5173/?clean=1');await page.waitForFunction(()=>window.deck?.ready);await page.evaluate(()=>window.deck.pause());
 for(const {scene,beat,cue} of allCues.filter(c=>c.cue.kind==='content')){
  await go(scene,beat);const samples=[];
  for(const f of [0,.15,.3,.5,.7,.9]){await seek(2.8+cue.loop*(2+f));samples.push(await rects());}
  const first=samples[0],motion=first.cards.map((_,i)=>samples.some(s=>s.cards[i].translate!==first.cards[i].translate)&&samples.some(s=>s.cards[i].light!==first.cards[i].light));
  const safe=samples.every(s=>s.overflow.length===0&&s.cards.every(c=>c.rect.left>=78&&c.rect.right<=1842&&c.rect.top>=160&&c.rect.bottom<=935));
  const fixed=samples.every(s=>JSON.stringify(s.heading)===JSON.stringify(first.heading));
  check(`floating cards, light, reading space ${cue.id}`,motion.length>0&&motion.every(Boolean)&&safe&&fixed,{cards:motion.length,motion,safe,fixed,overflow:samples.flatMap(s=>s.overflow)});
  check(`narrative rest 2–3 seconds ${cue.id}`,first.timing.rest>=2&&first.timing.rest<=3,first.timing);
  await seek(2.8+cue.loop*3-.016);const before=await rects();await seek(2.8+cue.loop*3+.016);const after=await rects();
  const delta=Math.max(...before.cards.map((c,i)=>Math.max(...Object.keys(c.rect).map(k=>Math.abs(c.rect[k]-after.cards[i].rect[k])))));
  check(`smooth card seam ${cue.id}`,delta<.8,{maximumBoundDelta:delta});
 }
 for(const [s,b,id] of [[0,0,'01.01'],[0,2,'01.03'],[3,1,'04.02'],[5,0,'06.01'],[6,1,'07.02'],[9,0,'10.01'],[9,2,'10.03']]){
  await go(s,b);await seek(4);await page.screenshot({path:`${out}/${id}.png`});
  if(['04.02','06.01','07.02'].includes(id)){
   const samples=[];for(const f of [0,.2,.4,.6,.8]){await seek(2.8+allCues.find(c=>c.cue.id===id).cue.loop*(2+f));samples.push(await page.evaluate(()=>{
    const cards=[...document.querySelectorAll('.spatial-host .spatial-card')].map(e=>e.getBoundingClientRect());
    let overlap=0;for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++)overlap+=Math.max(0,Math.min(cards[i].right,cards[j].right)-Math.max(cards[i].left,cards[j].left))*Math.max(0,Math.min(cards[i].bottom,cards[j].bottom)-Math.max(cards[i].top,cards[j].top));
    return {overlap,cells:document.querySelectorAll('.spatial-host [data-cell]').length};
   }));}
   check(`cards never occlude evidence ${id}`,samples.every(s=>s.overlap===0)&&(id!=='06.01'||samples.every(s=>s.cells===16)),samples);
  }
  if(id.startsWith('10.')){
   const fits=[];for(const f of [0,.25,.5,.75]){await seek(2.8+f*5.8);fits.push(await page.evaluate(()=>{
    const ecg=document.querySelector('.spatial-host .ecg'),e=ecg.querySelector('path').getBoundingClientRect(),c=ecg.closest('.spatial-card').getBoundingClientRect();
    return {above:e.bottom<c.top-7,fit:e.left>=c.left&&e.right<=c.right,height:e.height,widthRatio:e.width/c.width,top:e.top};
   }));}
   check(`larger ECG attached above its card ${id}`,fits.every(f=>f.above&&f.fit&&f.height>=60&&f.height<=85&&f.widthRatio>.85&&f.top>=160),fits);
  }
 }
 await go(0,0);const signals=[];
 for(const t of [2.9,3.3,3.7,4.1]){await seek(t);signals.push(await page.evaluate(()=>[...document.querySelectorAll('.spatial-host [data-neural-runner]')].map(p=>({offset:p.style.strokeDashoffset,opacity:p.style.opacity}))));}
 check('human electrical impulses travel across thirteen nerve paths',signals[0].length===13&&signals.some(s=>JSON.stringify(s)!==JSON.stringify(signals[0])),signals.map(s=>s.filter(p=>Number(p.opacity)>.1).length));
 await seek(4);const paused=await rects();await page.waitForTimeout(180);check('card drift freezes with the central pause',JSON.stringify(paused)===JSON.stringify(await rects()));
 check('no runtime errors',errors.length===0,errors);
}finally{await browser.close();await fs.writeFile(`${out}/checks.json`,JSON.stringify({checks,errors,pass:checks.every(c=>c.pass)},null,2));}
if(checks.some(c=>!c.pass))process.exitCode=1;
