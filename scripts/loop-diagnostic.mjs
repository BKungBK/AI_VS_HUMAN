import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});await page.goto('http://127.0.0.1:5173/?clean=1');await page.waitForFunction(()=>window.deck?.ready);await page.evaluate(()=>{window.deck.pause();window.deck.go(6,1);});await page.waitForFunction(()=>document.querySelector('.stage').dataset.cue==='07.02');
const rows=[];
for(const [name,t] of [['a',20],['b',30],['c',20]]){await page.evaluate(t=>window.deck.seek(t),t);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:`qa/loop-mushroom-${name}.png`});rows.push(await page.evaluate(()=>({state:window.deck.state(),photo:document.querySelector('.spatial-host img').getAttribute('style'),text:document.querySelector('[data-confidence]').textContent,transform:document.querySelector('.spatial-host .css3d-renderer').innerHTML.slice(0,1500)})));}
await fs.writeFile('qa/loop-diagnostic.json',JSON.stringify(rows,null,2));await browser.close();
