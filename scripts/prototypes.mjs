import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11','--disable-features=CalculateNativeWinOcclusion']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/?clean=1');await page.waitForFunction(()=>window.deck?.ready,{timeout:30000});
await page.evaluate(()=>window.deck.pause());
await fs.mkdir('qa/prototypes',{recursive:true});
for(const [name,scene,beat] of [['opening',0,0],['frontier',5,3],['empathy',8,1]]){
 await page.evaluate(([s,b])=>window.deck.go(s,b),[scene,beat]);await page.waitForFunction(id=>document.querySelector('.stage')?.dataset.cue===id,`${String(scene+1).padStart(2,'0')}.${String(beat+1).padStart(2,'0')}`);
 await page.evaluate(()=>window.deck.seek(4));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await page.screenshot({path:`qa/prototypes/${name}.png`});
 console.log(name,JSON.stringify(await page.evaluate(()=>window.deck.state())));
}
await fs.writeFile('qa/prototypes/checks.json',JSON.stringify({errors},null,2));console.log('errors',errors);await browser.close();
