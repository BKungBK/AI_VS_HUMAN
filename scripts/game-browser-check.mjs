import {chromium} from 'playwright';
import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const base=process.env.GAME_TEST_ORIGIN??'http://127.0.0.1:5180';
const out='qa/game1';await mkdir(out,{recursive:true});await mkdir('.impeccable/review',{recursive:true});
const key=(await readFile('data/host-key.txt','utf8')).trim();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];const checks=[];
const capture=async(page,name)=>{await page.screenshot({path:`${out}/${name}.png`,fullPage:true});};
const check=(name,value)=>{assert.ok(value,name);checks.push({name,passed:true});};
try{
 const hc=await browser.newContext({viewport:{width:1366,height:900}}),host=await hc.newPage();
 host.on('pageerror',e=>errors.push(`host: ${e.message}`));
 await host.goto(`${base}/games`);await host.getByLabel('รหัสผู้จัด').fill(key);await host.getByRole('button',{name:'เข้าสู่ระบบผู้จัด'}).click();
 await host.getByRole('button',{name:'สร้างห้องทดสอบ'}).waitFor();await capture(host,'home');
 await host.getByRole('button',{name:'สร้างห้องทดสอบ'}).click();await host.waitForURL(/presenter/);const code=host.url().split('/').at(-1);
 await host.getByRole('button',{name:'เริ่มเกม',exact:true}).waitFor();await host.waitForFunction(()=>!document.querySelector('.host-controls .primary')?.disabled);
 const pc=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),player=await pc.newPage();player.on('pageerror',e=>errors.push(`player: ${e.message}`));
 await player.goto(`${base}/play/${code}`);await player.getByLabel('ชื่อเล่น').fill('ทดสอบมือถือ');await player.getByText('กลุ่ม 1',{exact:true}).click();await capture(player,'mobile-join');
 await player.getByRole('button',{name:'เข้าร่วมเกม',exact:true}).click();await player.getByRole('button',{name:/Human.*เลือกฝั่งนี้/}).waitFor();
 await player.getByRole('button',{name:/Human.*เลือกฝั่งนี้/}).click();await player.locator('.side-choice.human[aria-pressed="true"]:not(:disabled)').waitFor();await player.getByText('พร้อมเล่นแล้ว',{exact:true}).waitFor();await capture(player,'mobile-ready');
 check('mobile ready has no horizontal overflow',await player.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const dc=await browser.newContext({viewport:{width:1920,height:1080}}),display=await dc.newPage();display.on('pageerror',e=>errors.push(`display: ${e.message}`));
 await display.goto(`${base}/display/${code}`);await display.getByText('ตอนนี้ไว้ใจ Human หรือ AI มากกว่า?',{exact:true}).waitFor();await capture(display,'display-ready');await capture(host,'host-ready');
 await copyFile(`${out}/host-ready.png`,'.impeccable/review/desktop.png');await copyFile(`${out}/mobile-ready.png`,'.impeccable/review/mobile.png');
 const req=async(ctx,path,role,body)=>{const res=await ctx.request.fetch(`${base}/api${path}`,{method:body?'POST':'GET',headers:{'x-game-role':role},data:body});return res.json();};
 const before=await req(pc,`/rooms/${code}/snapshot`,'player');
 check('Realtime connected before Start',await player.getByText(/Realtime เชื่อมต่อแล้ว/).count()>0);
 await host.getByRole('button',{name:'เริ่มเกม',exact:true}).click();await player.getByText('เตรียมดึง',{exact:true}).waitFor();
 await player.waitForFunction(()=>{const b=document.querySelector('.pull-button');return b&&!b.disabled&&b.textContent.includes('ดึง!');},{},{timeout:8000});
 await capture(player,'mobile-pulling');
 const pull=player.locator('.pull-button');
 await pull.dispatchEvent('pointerdown',{button:0,pointerId:1,pointerType:'touch'});await player.waitForTimeout(350);
 const once=await req(pc,`/rooms/${code}/snapshot`,'player');check('one pointerdown produces one accepted tap',once.data.me.state.accepted===1);
 await player.waitForTimeout(500);const held=await req(pc,`/rooms/${code}/snapshot`,'player');check('holding pointer does not auto-repeat',held.data.me.state.accepted===1);
 for(let i=0;i<6;i++){await pull.dispatchEvent('pointerdown',{button:0,pointerId:1,pointerType:'touch'});await player.waitForTimeout(130);}
 await host.getByRole('button',{name:'พักเกม',exact:true}).click();await player.getByText('พักเกม',{exact:true}).first().waitFor();
 const paused=await req(pc,`/rooms/${code}/snapshot`,'player');check('Pause preserves accepted taps',paused.data.me.state.accepted>1);check('Pause disables tap control',await player.locator('.pull-button').isDisabled());
 await player.reload();await player.getByText('พักเกม',{exact:true}).first().waitFor();const restored=await req(pc,`/rooms/${code}/snapshot`,'player');check('Refresh restores same membership and score',restored.data.me.memberId===before.data.me.memberId&&restored.data.me.state.accepted===paused.data.me.state.accepted);
 // A second tab reads until the player explicitly claims the writer.
 const other=await pc.newPage();await other.goto(`${base}/play/${code}`);await other.getByText('เกมนี้เปิดอยู่ที่อีกแท็บ',{exact:true}).waitFor();check('second tab has a read-only input control',await other.locator('.pull-button').isDisabled());
 await host.getByRole('button',{name:'เล่นต่อ',exact:true}).click();await other.getByRole('button',{name:'เล่นต่อที่แท็บนี้'}).click();
 await other.waitForFunction(()=>!document.querySelector('.pull-button')?.disabled);
 await player.getByText('เกมนี้เปิดอยู่ที่อีกแท็บ',{exact:true}).waitFor();check('explicit takeover fences original tab',await player.locator('.pull-button').isDisabled());
 // Offline renders latest acknowledged state and recovery uses same room/run.
 await pc.setOffline(true);await player.waitForTimeout(2300);check('offline does not blank the page',await player.getByRole('heading',{name:'Trust Tug-of-War'}).count()===1);await capture(player,'mobile-offline');
 await pc.setOffline(false);await player.waitForTimeout(1200);
 await host.getByRole('button',{name:'จบเกม / ไปต่อ',exact:true}).waitFor({timeout:15000});await other.getByText('จบดึงแล้ว',{exact:true}).waitFor();
 await capture(other,'mobile-result');await capture(display,'display-result');await capture(host,'host-result');
 check('Display result fits 1920x1080 without scrolling',await display.evaluate(()=>document.documentElement.scrollHeight<=innerHeight));
 await host.waitForTimeout(1000);const result=await req(hc,`/rooms/${code}/snapshot`,'host');check('RESULT persists without auto-finish',result.data.run.status==='RESULT'&&result.data.room.cue==='02.01');
 await host.getByRole('button',{name:'จบเกม / ไปต่อ',exact:true}).click();await host.getByRole('heading',{name:'ยืนยันคะแนนแล้ว',exact:true}).waitFor();await display.locator('iframe').waitFor();
 const done=await req(hc,`/rooms/${code}/snapshot`,'host');check('Finish confirms and advances to 03.01',done.data.run.status==='COMPLETED'&&done.data.room.cue==='03.01');
 const exp=await hc.request.get(`${base}/api/rooms/${code}/export`);check('Host export available',exp.ok());
 const forbidden=await req(pc,`/rooms/${code}/commands/pause`,'player',{key:crypto.randomUUID(),payload:{controllerId:'fake',controllerEpoch:1,expectedVersion:1}});check('Player cannot issue Host command',forbidden.error==='FORBIDDEN');
 await copyFile(`${out}/mobile-result.png`,'.impeccable/review/mobile-result.png');await copyFile(`${out}/display-result.png`,'.impeccable/review/display.png');
 check('no uncaught browser errors',errors.length===0);
 await writeFile(`${out}/browser-checks.json`,JSON.stringify({date:new Date().toISOString(),origin:base,code,checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,code,errors}));
}finally{await browser.close();}
