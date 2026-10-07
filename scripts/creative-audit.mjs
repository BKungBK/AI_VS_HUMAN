import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {allCues} from '../src/content.ts';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),rows=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const sample=()=>page.evaluate(()=>{
 const root=document.querySelector('.spatial-host .visual-world');
 const hooks=['confidence','breath','glow','hazard','ecg','flow','token','protein','cell'];
 return {hooks:hooks.filter(h=>root.querySelector(`[data-${h}]`)),styles:[...root.querySelectorAll('*')].map(e=>({style:e.getAttribute('style'),transform:e.getAttribute('transform'),opacity:e.getAttribute('opacity')})),confidence:root.querySelector('[data-confidence]')?.textContent,gavel:!!root.querySelector('.gavel')};
});
try{
 await page.goto('http://127.0.0.1:5173/?clean=1');await page.waitForFunction(()=>window.deck?.ready);await page.evaluate(()=>window.deck.pause());
 for(const {scene,beat,cue} of allCues.filter(c=>c.cue.kind==='content')){
  await page.evaluate(([s,b])=>window.deck.go(s,b),[scene,beat]);await page.waitForFunction(id=>document.querySelector('.stage')?.dataset.cue===id,cue.id);await settle();
  const samples=[];for(const phase of [0,.12,.25,.45,.65]){await page.evaluate(t=>window.deck.seek(t),2.8+cue.loop*(2+phase));await settle();samples.push(await sample());}
  const first=samples[0],foregroundMoves=samples.some(s=>JSON.stringify(first.styles)!==JSON.stringify(s.styles)||first.confidence!==s.confidence);
  rows.push({cue:cue.id,visual:cue.visual,title:cue.title,hooks:first.hooks,foregroundMoves,gavel:first.gavel,loop:cue.loop});
 }
 await fs.mkdir('qa/creative-direction',{recursive:true});
 const result={date:new Date().toISOString(),contentCues:rows.length,foregroundLoopCues:rows.filter(r=>r.foregroundMoves).length,staticForegroundCues:rows.filter(r=>!r.foregroundMoves).length,rows,errors};
 await fs.writeFile('qa/creative-direction/refined-motion-audit.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({contentCues:result.contentCues,foregroundLoopCues:result.foregroundLoopCues,staticForegroundCues:result.staticForegroundCues,static:rows.filter(r=>!r.foregroundMoves).map(r=>`${r.cue} ${r.visual}`),errors},null,2));
}finally{await browser.close();}
