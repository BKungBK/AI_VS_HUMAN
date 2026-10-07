import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {chapters,allCues} from '../src/content.ts';
const base=process.env.DECK_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11','--disable-features=CalculateNativeWinOcclusion']});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const page=await context.newPage(),errors=[],checks=[],frames=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',name);};
const settled=async p=>p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const go=async(s,b=0)=>{await page.evaluate(([s,b])=>window.deck.go(s,b),[s,b]);await page.waitForFunction(id=>document.querySelector('.stage')?.dataset.cue===id,chapters[s].cues[b].id);await page.waitForFunction(()=>[...document.querySelectorAll('.spatial-host img')].every(img=>img.complete&&img.naturalWidth>0));await page.evaluate(()=>Promise.all([...document.querySelectorAll('.spatial-host img')].map(img=>img.decode())));await settled(page);};
await fs.mkdir('qa/captures',{recursive:true});await fs.mkdir('qa/backgrounds',{recursive:true});await fs.mkdir('qa/motion',{recursive:true});
await page.goto(base+'/?clean=1');await page.waitForFunction(()=>window.deck?.ready);await page.evaluate(()=>window.deck.pause());
check('16 chapters / 43 cues',chapters.length===16&&allCues.length===43,{chapters:chapters.length,cues:allCues.length});
check('12 simple placeholder cues',allCues.filter(x=>x.cue.kind==='placeholder').length===12);
for(const item of allCues){
 await go(item.scene,item.beat);await page.evaluate(()=>window.deck.seek(4));await settled(page);
 const layout=await page.evaluate(()=>{
  const overflow=[...document.querySelectorAll('.spatial-host .glass-inner')].filter(e=>e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2).map(e=>({text:e.textContent?.slice(0,80),height:e.clientHeight,scroll:e.scrollHeight}));
  const copy=document.querySelector('.spatial-host .text-stage > .copy-block').getBoundingClientRect();
  const cards=[...document.querySelectorAll('.spatial-host [data-card]')].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};});
  const images=[...document.querySelectorAll('.spatial-host img')].every(i=>i.complete&&i.naturalWidth>0);
  const placeholder=document.querySelector('.stage').dataset.kind==='placeholder';
  return {overflow,copy:{left:copy.left,right:copy.right,bottom:copy.bottom},cards,images,placeholderPlain:!placeholder||!document.querySelector('.spatial-host .visual-world').textContent && window.deck.state().backgroundLayers===0,canvas:{w:document.querySelector('canvas').width,h:document.querySelector('canvas').height}};
 });
 await page.screenshot({path:`qa/captures/${item.cue.id}.png`});
 const bounds=layout.cards.every(r=>r.left>=78&&r.right<=1842&&r.top>=160&&r.bottom<=935);
 const pass=layout.overflow.length===0&&layout.images&&layout.placeholderPlain&&layout.copy.left>=78&&layout.copy.right<=1842&&layout.copy.bottom<=930&&bounds;
 check(`layout ${item.cue.id}`,pass,layout);
 const boxes=await page.evaluate(()=>{
  const selectors=['.copy-block h1','.subtitle','.eyebrow','.stage-brand','.chapter-marker','.stage-footer','.spatial-host .matrix-grid span','.spatial-host .card-label','.spatial-host h2','.spatial-host p','.spatial-host .figure','.spatial-host .photo-credit','.spatial-host .stat-rule','.spatial-host .world-caption','.spatial-host .svg-text','.spatial-host .chat-message','.spatial-host .token-chips','.spatial-host .case-year','.spatial-host .alert-line','.spatial-host .flow-node','.spatial-host .case-sequence','.spatial-host .study-numbers','.spatial-host .system-window>span','.spatial-host .system-window>strong','.spatial-host .formula-step>span','.spatial-host .formula-step>strong','.spatial-host .formula-step>em','.spatial-host .formula-step>i','.spatial-host .horizon-label','.opening-question','.context-label'];
  return [...document.querySelectorAll(selectors.join(','))].filter(e=>!e.closest('.outgoing')&&e.getBoundingClientRect().width>0).map((el,i)=>{el.setAttribute('data-contrast','');const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,label:el.textContent?.slice(0,90)};});
 });
 const style=await page.addStyleTag({content:'[data-contrast],[data-contrast] *{color:transparent!important;fill:transparent!important;text-shadow:none!important;-webkit-text-stroke-color:transparent!important}'});
 await settled(page);await page.screenshot({path:`qa/backgrounds/${item.cue.id}.png`});await style.evaluate(e=>e.remove());await settled(page);
 frames.push({id:item.cue.id,title:item.cue.title,boxes});
}
await fs.writeFile('qa/contrast-regions.json',JSON.stringify(frames,null,2));
check('actual 1920×1080 buffer',await page.evaluate(()=>document.querySelector('canvas').width===1920&&document.querySelector('canvas').height===1080));
await go(0,0);await page.evaluate(()=>window.deck.seek(5));const a=crypto.createHash('sha256').update(await page.screenshot()).digest('hex');await page.evaluate(()=>window.deck.seek(5));const b=crypto.createHash('sha256').update(await page.screenshot()).digest('hex');check('deterministic seek',a===b);
await go(5,3);await page.evaluate(()=>window.deck.seek(.55));const early=await page.evaluate(()=>window.deck.state());await page.evaluate(()=>window.deck.seek(2.4));const late=await page.evaluate(()=>window.deck.state());check('dolly changes Z and FOV',Math.abs(early.cameraZ-late.cameraZ)>400&&Math.abs(early.fov-late.fov)>8,{early,late});
await go(2,1);await page.evaluate(()=>window.deck.seek(4));const t1=crypto.createHash('sha256').update(await page.screenshot()).digest('hex');await page.evaluate(t=>window.deck.seek(t),4+chapters[2].cues[1].loop);const t2=crypto.createHash('sha256').update(await page.screenshot()).digest('hex');check('contextual loop repeats at the authored period',t1===t2);
await go(0,3);await page.evaluate(()=>window.deck.next());await settled(page);check('next crosses chapter',await page.evaluate(()=>window.deck.state().cue==='02.01'));await page.evaluate(()=>window.deck.previous());await settled(page);check('previous crosses chapter',await page.evaluate(()=>window.deck.state().cue==='01.04'));
await go(5,2);await page.evaluate(()=>window.deck.pause());await page.keyboard.press('ArrowRight');await settled(page);check('paused navigation lands readable',await page.evaluate(()=>window.deck.state().cue==='06.04'&&window.deck.state().time===4));
await page.evaluate(()=>window.deck.resume());await page.waitForTimeout(120);const running=await page.evaluate(()=>window.deck.state().time);await page.evaluate(()=>window.deck.pause());await page.waitForTimeout(120);check('resume advances / pause holds',running>4&&await page.evaluate(t=>window.deck.state().time>=t&&window.deck.state().time<t+.07,running));
await go(0,0);await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await settled(page);check('rapid navigation debounced',await page.evaluate(()=>window.deck.state().cue==='01.02'));
await page.keyboard.press('b');await page.waitForTimeout(800);check('blackout works',await page.locator('.blackout').evaluate(e=>getComputedStyle(e).opacity==='1'));await page.keyboard.press('b');
await page.keyboard.press('c');check('chapter index opens',await page.locator('.chapter-index').count()===1);await page.keyboard.press('Escape');check('chapter index closes',await page.locator('.chapter-index').count()===0);
await go(5,3);await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.deck.seek(.85));await settled(page);check('system motion preference retains the full camera journey',await page.evaluate(()=>window.deck.state().journey.active&&window.deck.state().journey.progress>0&&window.deck.state().journey.progress<1));await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>window.deck.seek(4));await settled(page);
await page.evaluate(()=>document.querySelector('canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true})));await settled(page);check('context loss retains cards and text',await page.evaluate(()=>window.deck.state().fallback&&!!document.querySelector('.spatial-host .spatial-card')));await page.evaluate(()=>window.deck.seek(4));await page.screenshot({path:'qa/fallback.png'});

const presenter=await context.newPage();await presenter.goto(base+'/?presenter=1');await presenter.waitForSelector('.notes');await page.waitForTimeout(200);check('presenter receives current cue',await presenter.locator('.presenter-current h2').textContent()==='ความเก่ง ไม่ได้เป็นเส้นตรง');await presenter.locator('.presenter-navigation button').nth(1).click();await settled(page);check('presenter controls stage',await page.evaluate(()=>window.deck.state().cue==='06.05'));await presenter.screenshot({path:'qa/presenter.png'});await presenter.close();

const slow=await context.newPage();await slow.route('**/assets/images/*.jpg',async route=>{await new Promise(r=>setTimeout(r,900));await route.continue();});await slow.goto(base+'/?clean=1');await slow.waitForFunction(()=>window.deck);check('clock waits for assets',await slow.evaluate(()=>!window.deck.ready&&window.deck.state().time===0));await slow.waitForFunction(()=>window.deck.ready);check('slow assets eventually ready',await slow.evaluate(()=>window.deck.ready));await slow.close();

const local=await browser.newContext({viewport:{width:1920,height:1080}}),outside=[];await local.route('**/*',route=>{const url=route.request().url();if(!url.startsWith(base)&&!url.startsWith('data:')){outside.push(url);return route.abort();}return route.continue();});const lp=await local.newPage();await lp.goto(base+'/?clean=1');await lp.waitForFunction(()=>window.deck?.ready);check('all playback assets local',outside.length===0,{outside});await local.close();
await page.setViewportSize({width:390,height:844});await settled(page);const mobile=await page.locator('.stage').boundingBox();check('mobile keeps 16:9 stage',Math.abs(mobile.width/mobile.height-16/9)<.01);await page.screenshot({path:'qa/mobile.png'});
check('no browser errors',errors.length===0,errors);
await fs.writeFile('qa/browser-checks.json',JSON.stringify({checks,errors,pass:checks.every(c=>c.pass)},null,2));await browser.close();
if(checks.some(c=>!c.pass))process.exitCode=1;
