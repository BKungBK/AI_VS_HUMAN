import {chromium} from 'playwright';
import {allCues} from '../src/content.ts';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1920,height:1080}});await page.goto('http://127.0.0.1:5173/?clean=1');await page.waitForFunction(()=>window.deck?.ready);await page.evaluate(()=>window.deck.pause());
const issues=[];
for(const item of allCues){await page.evaluate(([s,b])=>window.deck.go(s,b),[item.scene,item.beat]);await page.waitForFunction(id=>document.querySelector('.stage')?.dataset.cue===id,item.cue.id);await page.evaluate(()=>window.deck.seek(4));const problems=await page.evaluate(()=>{
 const data=[];for(const el of document.querySelectorAll('.spatial-host .glass-inner'))if(el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2)data.push({text:el.textContent?.slice(0,120),w:el.clientWidth,sw:el.scrollWidth,h:el.clientHeight,sh:el.scrollHeight});
 const block=document.querySelector('.spatial-host .text-stage .copy-block');if(block){const r=block.getBoundingClientRect();if(r.bottom>925)data.push({copyBottom:r.bottom,text:block.textContent?.slice(0,90)});}return data;
});if(problems.length)issues.push({cue:item.cue.id,problems});}
console.log(JSON.stringify(issues,null,2));await browser.close();
