import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {allCues} from '../src/content.ts';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',name);};
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const go=async(s,b)=>{await page.evaluate(([s,b])=>window.deck.go(s,b),[s,b]);await settle();};
const seek=async t=>{await page.evaluate(t=>window.deck.seek(t),t);await settle();};
const state=()=>page.evaluate(()=>window.deck.state());
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const line=()=>page.locator('.spatial-host [data-text-line]').first().evaluate(e=>{const m=new DOMMatrixReadOnly(getComputedStyle(e).transform);return {opacity:Number(getComputedStyle(e).opacity),z:m.m43,yaw:m.m13,pitch:m.m23,identity:m.isIdentity};});
const snapshot=()=>page.evaluate(()=>({state:window.deck.state(),styles:[...document.querySelectorAll('.spatial-host *, .outgoing *')].map(e=>e.getAttribute('style'))}));
await fs.mkdir('qa/place-journey',{recursive:true});
await page.goto('http://127.0.0.1:5173/?clean=1');await page.waitForFunction(()=>window.deck?.ready);await page.evaluate(()=>window.deck.pause());
const anchors=[],districts=new Map(),loopResults=[];
for(const {scene,beat,cue} of allCues.filter(x=>x.cue.kind==='content')){
 await go(scene,beat);await seek(4);const s=await state();anchors.push(JSON.stringify(s.placeAnchor));
 if(!districts.has(s.place)){
  districts.set(s.place,await page.evaluate(id=>[...document.querySelectorAll(`[data-place="${id}"] svg`)].map(e=>e.innerHTML).join(''),cue.id));
  await seek(20);const a=await snapshot();await seek(20+cue.loop*.27);const middle=await snapshot();await seek(20+cue.loop);const b=await snapshot();loopResults.push({place:s.place,moves:JSON.stringify(a.styles)!==JSON.stringify(middle.styles),pass:JSON.stringify(a.styles)===JSON.stringify(b.styles)&&dist(a.state.worldCamera,b.state.worldCamera)===0});
 }
}
check('31 content cues have distinct spatial addresses',anchors.length===31&&new Set(anchors).size===31,{count:anchors.length,unique:new Set(anchors).size});
check('11 places have distinct scenic silhouettes',districts.size===11&&new Set(districts.values()).size===11,{places:[...districts.keys()]});
check('all 11 ambient worlds repeat without camera drift',loopResults.every(r=>r.pass),loopResults);
check('each place has its own active ambient layer',loopResults.every(r=>r.moves),loopResults);
const cases=[{name:'walk',from:[2,3],to:[5,0]},{name:'descend',from:[5,2],to:[5,3]},{name:'threshold',from:[8,2],to:[9,0]},{name:'rise',from:[12,3],to:[14,0]},{name:'reverse',from:[2,3],to:[2,2]}];
for(const clip of cases){
 await go(...clip.from);await seek(4);const before=await state();await go(...clip.to);await seek(0);const start=await state();
 check(`${clip.name} departure keeps actual world camera pose`,dist(before.worldCamera,start.worldCamera)<.01&&Math.abs(before.cameraYaw-start.cameraYaw)<.01,{before:before.worldCamera,start:start.worldCamera});
 await seek(.85);const middle=await state();await seek(2.8);const end=await state(),title=await line();
 check(`${clip.name} camera travels through populated space`,dist(start.worldCamera,middle.worldCamera)>150&&dist(start.worldCamera,end.worldCamera)>1300&&Math.abs(middle.cameraYaw)>2&&middle.travelGates===3&&middle.backgroundLayers===4,{middle,end});
 check(`${clip.name} lands with readable native text`,title.identity&&title.opacity===1&&end.cameraZ===1500&&end.cameraYaw===0&&end.cameraPitch===0&&end.journey.progress===1,{title,end});
 if(clip.name==='descend')check('frontier combines world descent with compensated dolly',end.worldCamera.y<start.worldCamera.y&&Math.abs(middle.fov-end.fov)>7,{start,middle,end});
 if(clip.name==='reverse')check('reverse returns to the earlier gallery address',end.worldCamera.x<start.worldCamera.x,{start:start.worldCamera,end:end.worldCamera});
}
await go(8,2);await seek(4);await go(9,0);await seek(.2);
const oldLine=await page.locator('.outgoing-copy [data-text-line]').first().evaluate(e=>new DOMMatrixReadOnly(getComputedStyle(e).transform).m43);
check('departure text peels through depth',oldLine>10,{z:oldLine});
await seek(.52);check('old title clears before new title',await page.locator('.outgoing-copy').evaluate(e=>Number(getComputedStyle(e).opacity)===0));
await seek(1.4);const arriving=await line();check('text joins arrival with depth and two-axis tilt',arriving.z<0&&Math.abs(arriving.yaw)>.005&&Math.abs(arriving.pitch)>.005&&arriving.opacity>0&&arriving.opacity<1,arriving);
const bounds=[];for(const t of [1.55,1.7,1.9,2.2,2.8]){await seek(t);bounds.push({t,lines:await page.locator('.spatial-host [data-text-line]').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right};}))});}
check('readable arriving Thai stays inside frame',bounds.every(f=>f.lines.every(r=>r.left>=64&&r.right<=1856)),bounds);
await seek(.85);const a=await snapshot();await page.screenshot({path:'qa/place-journey/seek-a.png'});await seek(4);await seek(.85);const b=await snapshot();await page.screenshot({path:'qa/place-journey/seek-b.png'});
const diff=spawnSync('python',['-c',"from PIL import Image,ImageChops; import json; d=ImageChops.difference(Image.open('qa/place-journey/seek-a.png').convert('RGB'),Image.open('qa/place-journey/seek-b.png').convert('RGB')); p=list(d.get_flattened_data()); print(json.dumps({'maximumChannelDelta':max(max(v) for v in p),'changedPixels':sum(v!=(0,0,0) for v in p)}))"],{encoding:'utf-8'});
if(diff.status!==0)throw new Error(diff.stderr);const raster=JSON.parse(diff.stdout);
check('seek reconstructs camera, scenic sets and text',JSON.stringify(a)===JSON.stringify(b)&&raster.maximumChannelDelta<=1&&raster.changedPixels<=2073,{raster,poseEqual:JSON.stringify(a.state)===JSON.stringify(b.state),styleDifferences:a.styles.map((v,i)=>v===b.styles[i]?null:{i,a:v,b:b.styles[i]}).filter(Boolean).slice(0,12),note:'Exact DOM/pose, ≤1 RGB level in ≤0.1% pixels for GPU rounding.'});
const before=await state();await go(5,3);await seek(0);const after=await state();check('interrupted flight starts at captured live world pose',dist(before.worldCamera,after.worldCamera)<.01&&Math.abs(before.cameraYaw-after.cameraYaw)<.01,{before,after});
for(const t of [.08,.2,.39,.56,.85]){await seek(t);await go(8,1);await seek(t);await go(5,3);}await seek(4);
check('rapid travel retains bounded scenes and one live text',await page.evaluate(()=>window.deck.state().retainedSets<=3&&document.querySelectorAll('.spatial-host .text-stage').length===1&&document.querySelectorAll('.spatial-host .place-plane').length<=12&&document.querySelectorAll('.outgoing-copy').length<=1));
await go(1,0);await seek(.7);const p=await state(),pl=await line();check('game remains plain centered text without a journey',p.backgroundLayers===0&&p.travelGates===0&&p.particles===0&&pl.identity&&pl.opacity===1,p);
await go(0,2);await page.emulateMedia({reducedMotion:'reduce'});await seek(.85);const r=await line(),rs=await state();check('system motion preference retains camera travel and spatial text',!r.identity&&rs.journey.active&&rs.journey.progress>0&&rs.journey.progress<1&&rs.travelGates===3,{r,rs});
await page.emulateMedia({reducedMotion:'no-preference'});await seek(4);await page.evaluate(()=>window.deck.setFallback());await settle();
check('scenic places and native text survive missing WebGL',await page.evaluate(()=>window.deck.state().fallback&&window.deck.state().backgroundLayers===4&&document.querySelector('.spatial-host [data-text-line]').getBoundingClientRect().width>0));
check('one seek clock drives camera, cards, scenery and type',await page.evaluate(()=>window.__timelines.cards===window.__timelines.copy));
check('no runtime errors',errors.length===0,errors);
await fs.writeFile('qa/place-checks.json',JSON.stringify({checks,errors,pass:checks.every(c=>c.pass)},null,2));await browser.close();if(checks.some(c=>!c.pass))process.exitCode=1;
