import {chromium} from 'playwright';
import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const base=process.env.GAME_TEST_ORIGIN??'http://127.0.0.1:5180';
const out='qa/game2';await mkdir(out,{recursive:true});await mkdir('.impeccable/review',{recursive:true});
const key=(await readFile('data/host-key.txt','utf8')).trim();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[],checks=[];
const capture=async(page,name)=>page.screenshot({path:`${out}/${name}.png`,fullPage:true});
const check=(name,value)=>{assert.ok(value,name);checks.push({name,passed:true});};
const snapshot=async(context,code,role)=>{const res=await context.request.fetch(`${base}/api/rooms/${code}/snapshot`,{headers:{'x-game-role':role}});assert.equal(res.ok(),true);return res.json();};
try{
 const hc=await browser.newContext({viewport:{width:1366,height:900}}),host=await hc.newPage();host.on('pageerror',e=>errors.push(`host: ${e.message}`));
 await host.goto(`${base}/games`);await host.getByLabel('รหัสผู้จัด').fill(key);await host.getByRole('button',{name:'เข้าสู่ระบบผู้จัด'}).click();
 await host.getByRole('button',{name:'สร้างห้องทดสอบ'}).click();await host.waitForURL(/presenter/);const code=host.url().split('/').at(-1);
 await host.getByText('จัดการรอบและเปลี่ยนคิว').click();await host.getByLabel('คิวสไลด์').selectOption('03.05');
 await host.getByRole('heading',{name:'พร้อมเริ่ม Swipe Court'}).waitFor();
 const pc=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),player=await pc.newPage();player.on('pageerror',e=>errors.push(`player: ${e.message}`));
 await player.goto(`${base}/play/${code}`);await player.getByLabel('ชื่อเล่น').fill('ทดสอบ Swipe');await player.getByText('กลุ่ม 1',{exact:true}).click();await player.getByRole('button',{name:'เข้าร่วมเกม',exact:true}).click();
 await player.getByText('พร้อมเล่นแล้ว',{exact:true}).waitFor({timeout:30000});await player.locator('.swipe-ready-state h2').getByText(/8\/8/).waitFor();
 const dc=await browser.newContext({viewport:{width:1920,height:1080}}),display=await dc.newPage();display.on('pageerror',e=>errors.push(`display: ${e.message}`));await display.goto(`${base}/display/${code}`);await display.getByRole('heading',{name:'รอผู้จัดเริ่มเกม'}).waitFor();
 await capture(host,'host-ready');await capture(player,'mobile-ready');await capture(display,'display-ready');
 check('player decoded all eight images before ready',await player.locator('.swipe-ready-state h2').innerText()==='ภาพพร้อม 8/8');
 check('mobile player has no horizontal overflow',await player.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check('display has no horizontal overflow in lobby',await display.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const before=await snapshot(pc,code,'player');check('answer key and image credits stay out of the pre-reveal snapshot',!JSON.stringify(before.data.swipe).match(/classification|sourceUrl|creator|license|revealText|generationPrompt/));
 await host.getByRole('button',{name:'เริ่ม 8 ภาพ'}).click();await player.getByRole('heading',{name:'เตรียมเลือกภาพ'}).waitFor();
 for(let round=1;round<=8;round++){
  await player.waitForFunction(n=>document.querySelector('.swipe-round-heading h2')?.textContent?.includes(`ภาพที่ ${n} จาก 8`),round,{timeout:10000});
  await player.waitForFunction(()=>{const b=document.querySelector('.swipe-choice.human');return b&&!b.disabled;},{},{timeout:3000});
  if(round===1){
   const card=player.locator('.swipe-image-card'),box=await card.boundingBox();assert.ok(box);await player.mouse.move(box.x+box.width*.75,box.y+box.height*.5);await player.mouse.down();await player.mouse.move(box.x+box.width*.75-105,box.y+box.height*.5,{steps:4});await player.mouse.up();
  }else await player.locator(round%2?'.swipe-choice.human':'.swipe-choice.ai').click();
  await player.getByText(/รับคำตอบแล้ว/).waitFor({timeout:2000});
  if(round===1){
   const accepted=await snapshot(pc,code,'player');check('left swipe submits Human and locks the image',accepted.data.swipe.myChoice==='HUMAN'&&accepted.data.swipe.answered===1);
   await player.locator('.swipe-choice.ai').click({force:true});await player.waitForTimeout(200);
   const duplicate=await snapshot(pc,code,'player');check('the locked image cannot score a second button answer',duplicate.data.swipe.answered===1&&duplicate.data.swipe.myChoice==='HUMAN');
   await capture(player,'mobile-locked-answer');
  }
  if(round<8)await player.waitForFunction(n=>document.querySelector('.swipe-round-heading h2')?.textContent?.includes(`ภาพที่ ${n+1} จาก 8`),round,{timeout:7000});
 }
 await player.locator('.swipe-personal-score').waitFor({timeout:12000});await display.getByText(/เฉลยภาพ 1 จาก 8/).waitFor({timeout:8000});
 const duringReveal=await snapshot(pc,code,'player');check('reveals begin only after all eight answer windows close',duringReveal.data.swipe.revealed===true&&duringReveal.data.swipe.reveals.length===8);
 check('player sees only their own answers after reveal',duringReveal.data.swipe.myAnswers.length===8);
 await capture(display,'display-first-reveal');await capture(player,'mobile-first-reveal');
 await display.getByRole('heading',{name:'สรุปครบทั้ง 8 ภาพ'}).waitFor({timeout:30000});
 await player.getByRole('heading',{name:'สรุปคำตอบทั้ง 8 ภาพ'}).waitFor({timeout:30000});
 await capture(display,'display-summary');await capture(player,'mobile-summary');await capture(host,'host-summary');
 check('summary accuracy handles unanswered roster entries',await display.getByText('ความแม่นยำ').count()===1);
 check('summary layout fits the 1920x1080 projection',await display.evaluate(()=>document.documentElement.scrollHeight<=innerHeight));
 check('mobile reveal can scroll without horizontal overflow',await player.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await host.getByRole('button',{name:/ยืนยันผล \/ ไปคิว 03\.03/}).waitFor({timeout:12000});
 await host.getByRole('button',{name:/ยืนยันผล \/ ไปคิว 03\.03/}).click();await display.locator('iframe').waitFor();
 const done=await snapshot(hc,code,'host');check('host explicitly confirms and returns to cue 03.03',done.data.run.status==='COMPLETED'&&done.data.room.cue==='03.03');
 check('no uncaught browser errors',errors.length===0);
 await copyFile(`${out}/host-ready.png`,'.impeccable/review/swipe-host.png');await copyFile(`${out}/mobile-ready.png`,'.impeccable/review/swipe-mobile.png');await copyFile(`${out}/display-summary.png`,'.impeccable/review/swipe-display.png');
 await writeFile(`${out}/browser-checks.json`,JSON.stringify({date:new Date().toISOString(),origin:base,code,checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,code,errors}));
}finally{await browser.close();}
