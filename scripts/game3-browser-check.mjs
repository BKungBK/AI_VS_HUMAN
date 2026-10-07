import {chromium,request} from 'playwright';
import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const base=process.env.GAME_TEST_ORIGIN??'http://127.0.0.1:5182',out='qa/game3';
await mkdir(out,{recursive:true});await mkdir('.impeccable/review',{recursive:true});
const key=(await readFile('data/host-key.txt','utf8')).trim(),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[],checks=[],contexts=[],latencies=[];
const check=(name,value)=>{assert.ok(value,name);checks.push({name,passed:true});};
const json=async(response)=>{const value=await response.json();assert.equal(value.ok,true,value.error);return value.data??value;};
const snapshot=(ctx,code,role)=>ctx.request.get(`${base}/api/rooms/${code}/snapshot`,{headers:{'x-game-role':role}}).then(json);
const send=async(ctx,code,role,kind,payload)=>{const start=Date.now();const response=await ctx.request.post(`${base}/api/rooms/${code}/commands/${kind}`,{headers:{'x-game-role':role},data:{key:crypto.randomUUID(),payload}});const data=await response.json();latencies.push(Date.now()-start);return data;};
async function capture(page,name){await page.screenshot({path:`${out}/${name}.png`,fullPage:true});check(`${name}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
async function phase(ctx,code,wanted){const until=Date.now()+85000;while(Date.now()<until){const s=await snapshot(ctx,code,'host');if(s.run?.phase===wanted){console.log(`Phase ${wanted}`);return s;}await new Promise(r=>setTimeout(r,600));}throw Error(`Phase timeout ${wanted}`);}
let roomCode;
const segmenter=new Intl.Segmenter('th',{granularity:'grapheme'});
const longCaption=(prefix)=>[...segmenter.segment((prefix+' แมวทำงานแทนทุกคน แต่คนยังต้องตรวจงานและรับผิดชอบก่อนกดส่ง').repeat(4))].slice(0,80).map(x=>x.segment).join('');
const playerTexts=[longCaption('แมวพร้อม เจ้านายยังหาปุ่มเปิดเครื่อง'),longCaption('AI ทำแทนได้ แต่ข้าวแมวผมจ่ายเอง'),longCaption('แมวหนึ่งตัวดูแลทั้งบริษัท')];
async function maxLengthCapture(page,code,name,state){
 const fixture=structuredClone(state);fixture.room.cue='04.01';
 fixture.caption.finalCandidates=fixture.caption.finalCandidates.map(x=>({...x,text:longCaption(`ผลงาน ${x.position}`)}));
 fixture.caption.results=fixture.caption.results.map(x=>({...x,text:longCaption(`ผลงาน ${x.position}`)}));
 const endpoint=`**/api/rooms/${code}/snapshot`;
 await page.route(endpoint,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:fixture})}));
 try{await page.reload();await page.locator('.caption-voting, .caption-gallery, .caption-results').waitFor();await capture(page,name);}
 finally{await page.unroute(endpoint);}
}
try{
 const hc=await browser.newContext({viewport:{width:1366,height:900}}),host=await hc.newPage();contexts.push(hc);host.on('pageerror',e=>errors.push(e.message));
 await host.goto(`${base}/games?game=caption-battle`);await host.getByLabel('รหัสผู้จัด').fill(key);await host.getByRole('button',{name:'เข้าสู่ระบบผู้จัด'}).click();check('game3 preselected for new room',await host.getByLabel('เกมสำหรับห้องใหม่').inputValue()==='04.01');await host.getByRole('button',{name:'สร้างห้องทดสอบ'}).click();await host.waitForURL(/presenter/);const code=host.url().split('/').at(-1);roomCode=code;
 await host.getByRole('heading',{name:'พร้อมเริ่มเกมที่สาม'}).waitFor();
 const players=[];
 for(const [i,width] of [[0,390],[1,1280],[2,320]]){
  const ctx=await browser.newContext({viewport:{width,height:width>640?900:844},isMobile:width<640,hasTouch:width<640}),page=await ctx.newPage();contexts.push(ctx);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/play/${code}`);await page.getByLabel('ชื่อเล่น').fill(`ทดสอบ ${i+1}`);await page.getByText(`กลุ่ม ${i+1}`,{exact:true}).click();await page.getByRole('button',{name:'เข้าร่วมเกม'}).click();await page.getByRole('heading',{name:'พร้อมเขียนแล้ว'}).waitFor();players.push({ctx,page,group:i+1});
 }
 const extra=[];
 for(let i=3;i<32;i++){
  const ctx=await request.newContext({baseURL:base});contexts.push(ctx);await json(await ctx.post('/api/session',{data:{role:'player'}}));
  await json(await ctx.post(`/api/rooms/${code}/commands/join`,{headers:{'x-game-role':'player'},data:{key:crypto.randomUUID(),payload:{nickname:`ผู้เล่นโหลด ${i+1}`,groupId:i%8+1}}}));
  const state=await snapshot({request:ctx},code,'player');await json(await ctx.post(`/api/rooms/${code}/commands/ready`,{headers:{'x-game-role':'player'},data:{key:crypto.randomUUID(),payload:{previewId:state.room.previewId,contentVersion:'caption-battle-v1'}}}));extra.push({request:ctx,i});
 }
 const dc=await browser.newContext({viewport:{width:1920,height:1080}}),display=await dc.newPage();contexts.push(dc);display.on('pageerror',e=>errors.push(e.message));await display.goto(`${base}/display/${code}`);
 await host.getByRole('button',{name:'อนุมัติโจทย์และแคปชั่น AI'}).click();await host.getByRole('button',{name:'เริ่มเขียน 20 วินาที'}).click();await phase(hc,code,'WRITING');
 for(const [i,p] of players.entries())await p.page.getByLabel('แคปชั่นของคุณ').fill(playerTexts[i]);
 for(const p of players)await p.page.getByRole('button',{name:'ส่งแคปชั่นตอนนี้'}).click();
 // Exercise simultaneous autosave revision traffic for all other roster members.
 const loadWrites=await Promise.all(extra.map(async(ctx)=>{const state=await snapshot(ctx,code,'player');return send(ctx,code,'player','caption',{runId:state.run.id,phaseToken:state.run.phaseToken,text:longCaption(`มุกโหลด ${ctx.i+1}`),revision:1,submitted:false});}));check('29 simultaneous drafts accepted',loadWrites.every(x=>x.ok));
 await Promise.all(extra.map(async(ctx)=>{const state=await snapshot(ctx,code,'player');check('draft revision update', (await send(ctx,code,'player','caption',{runId:state.run.id,phaseToken:state.run.phaseToken,text:longCaption(`มุกฉบับแก้ ${ctx.i+1}`),revision:2,submitted:true})).ok);}));
 const playerView=await snapshot(players[0].ctx,code,'player'),displayView=await snapshot(dc,code,'display');
 check('32 frozen roster members',playerView.caption.rosterCount===32);check('unreviewed drafts private',displayView.caption.reviewQueue.length===0&&!JSON.stringify(displayView).includes('แมวพร้อมรับโบนัส'));check('AI text hidden',playerView.caption.aiCaption===null&&playerView.caption.aiMetadata===null);
 const bad=await send(players[0].ctx,code,'player','caption',{runId:playerView.run.id,phaseToken:playerView.run.phaseToken,text:'ก้'.repeat(81),revision:100,submitted:true});check('81 Thai graphemes rejected by HTTP',bad.error==='CAPTION_TOO_LONG');
 // Keyboard focus in the real editor and refresh restores the accepted revision.
 await players[0].page.reload();await players[0].page.getByLabel('แคปชั่นของคุณ').waitFor();check('reconnect restores caption',await players[0].page.getByLabel('แคปชั่นของคุณ').inputValue()===playerTexts[0]);
 await players[0].page.getByLabel('แคปชั่นของคุณ').focus();check('textarea has visible keyboard focus',await players[0].page.getByLabel('แคปชั่นของคุณ').evaluate(el=>getComputedStyle(el).outlineStyle!=='none'));
 await capture(players[0].page,'mobile-writing');await capture(players[2].page,'mobile-320-writing');await capture(players[1].page,'desktop-writing');await capture(display,'display-writing');
 await phase(hc,code,'MODERATING');await host.getByRole('heading',{name:'ตรวจผลงานทีละ revision'}).waitFor();await capture(host,'host-moderation');
 await host.getByLabel('เหตุผลสั้นสำหรับไม่ผ่าน / งดเผยแพร่').fill('ทดสอบซ่อนงาน');
 await host.locator('.caption-review-item').first().getByRole('button',{name:'ผ่าน',exact:true}).click();
 await host.locator('.caption-review-item').first().getByRole('button',{name:'ผ่าน',exact:true}).waitFor();
 check('pending queue bounded to six visible jobs',await host.locator('.caption-review-item').count()<=6);
 await host.waitForFunction(()=>document.activeElement?.matches('.caption-review-select'),{},{timeout:5000});
 check('review focus moves to pending item',await host.evaluate(()=>document.activeElement?.matches('.caption-review-select')));
 let state=await snapshot(hc,code,'host');
 const pending=state.caption.reviewQueue.filter(x=>x.decision==='PENDING');
 for(const [index,sub] of pending.slice(0,-1).entries()){
  state=await snapshot(hc,code,'host');const latest=state.caption.reviewQueue.find(x=>x.id===sub.id);
  const response=await send(hc,code,'host','moderation',{runId:state.run.id,phaseToken:state.run.phaseToken,submissionId:sub.id,lockedRevision:latest.revision,expectedReviewVersion:latest.reviewVersion,decision:index===0?'REJECTED':'APPROVED',reason:index===0?'ทดสอบซ่อนงาน':'',controllerId:state.host.controllerId,controllerEpoch:state.host.controllerEpoch,expectedVersion:state.room.version});check('moderation accepted',response.ok);
 }
 await phase(hc,code,'REVIEW_REQUIRED');await host.getByText('ครบเวลาตรวจแล้ว ยังไม่เปิดโหวต',{exact:false}).waitFor();check('review barrier blocks incomplete work',await host.getByRole('button',{name:'ตรวจครบแล้ว / เปิดเลือกตัวแทน'}).isDisabled());await capture(host,'host-review-required');
 const last=host.locator('.caption-review-item.pending').first();await last.getByRole('button',{name:'ผ่าน',exact:true}).click();await host.getByRole('button',{name:'ตรวจครบแล้ว / เปิดเลือกตัวแทน'}).click();
 await phase(hc,code,'INTERNAL_VOTE');await players[0].page.getByRole('heading',{name:'เลือกตัวแทนกลุ่มของเรา'}).waitFor();await capture(players[0].page,'mobile-internal-vote');
 for(const p of players)await p.page.locator('.caption-option').first().click();
 await phase(hc,code,'FINAL_VOTE');await players[0].page.getByRole('heading',{name:'แคปชั่นไหนโดนใจที่สุด?'}).waitFor();
 state=await snapshot(hc,code,'host');check('7 anonymous final candidates',state.caption.finalCandidates.length===7&&state.caption.finalCandidates.every(x=>!('groupId' in x)&&!('author' in x)));
 const own=await snapshot(players[0].ctx,code,'player');check('own group disabled in UI',await players[0].page.locator('.caption-option').filter({hasText:'ตัวแทนกลุ่มคุณ'}).isDisabled());
 const ownCandidate=own.caption.finalCandidates.find(x=>x.ownGroup);check('server forbids own group',(await send(players[0].ctx,code,'player','final-vote',{runId:own.run.id,phaseToken:own.run.phaseToken,candidateId:ownCandidate.id,revision:1})).error==='OWN_GROUP');
 for(const p of players)await p.page.locator('.caption-option:not(:disabled)').first().click();
 await Promise.all(extra.map(async(ctx)=>{const view=await snapshot(ctx,code,'player');const candidate=view.caption.finalCandidates.find(x=>!x.ownGroup);check('load final vote',(await send(ctx,code,'player','final-vote',{runId:view.run.id,phaseToken:view.run.phaseToken,candidateId:candidate.id,revision:1})).ok);}));
 await capture(players[0].page,'mobile-final-vote');await capture(display,'display-final-vote');
 await players[0].page.evaluate(()=>scrollTo(0,document.body.scrollHeight));check('vote timer persists during scroll',await players[0].page.locator('.voting-sticky').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight;}));await players[0].page.evaluate(()=>scrollTo(0,0));
 await maxLengthCapture(players[0].page,code,'mobile-390-final-max',await snapshot(players[0].ctx,code,'player'));
 await maxLengthCapture(players[2].page,code,'mobile-320-final-max',await snapshot(players[2].ctx,code,'player'));
 await maxLengthCapture(display,code,'display-final-max',await snapshot(dc,code,'display'));
 check('maximum final gallery fits projection',await display.evaluate(()=>document.documentElement.scrollHeight<=innerHeight));
 await phase(hc,code,'RESULT');await host.getByRole('button',{name:'ยืนยันผล / ไปคิว 04.02'}).waitFor();await players[0].page.getByRole('heading',{name:'ผลโหวต · รอผู้จัดยืนยัน'}).waitFor();
 await capture(host,'host-result');await capture(players[0].page,'mobile-result');await capture(display,'display-result');
 check('RESULT feedback no longer promises editable vote',await players[0].page.getByText('ปิดโหวตแล้ว · รอผู้จัดยืนยันผล',{exact:true}).isVisible());
 await maxLengthCapture(display,code,'display-result-max',await snapshot(dc,code,'display'));
 check('maximum result and all six group totals fit projection',await display.evaluate(()=>document.documentElement.scrollHeight<=innerHeight));
 state=await snapshot(hc,code,'host');check('all 32 final votes counted',state.caption.results.reduce((n,x)=>n+x.votes,0)===32);check('finite group scores',state.scores.length===8&&state.scores.every(x=>Number.isFinite(x.numerator)));check('result waits for host',state.room.activeRunId!==null);
 await host.getByRole('button',{name:'ยืนยันผล / ไปคิว 04.02'}).click();await players[0].page.getByRole('heading',{name:'รอเกมถัดไป'}).waitFor();state=await snapshot(hc,code,'host');check('finish commits score and next cue',state.run.status==='COMPLETED'&&state.room.cue==='04.02'&&state.room.activeRunId===null);
 const exported=await (await hc.request.get(`${base}/api/rooms/${code}/export`,{headers:{'x-game-role':'host'}})).json();check('creative export includes roster submissions votes and provenance',exported.creative[0].roster.length===32&&exported.creative[0].submissions.length===32&&exported.creative[0].votes.length>=32&&!!exported.creative[0].ai_metadata.prompt);
 await host.getByText('จัดการรอบและเปลี่ยนคิว').click();await host.getByLabel('คิวสไลด์').selectOption('03.05');await host.getByRole('heading',{name:'พร้อมเริ่ม Swipe Court'}).waitFor();check('previous Caption run cannot trap a different game cue',true);
 check('no browser errors',errors.length===0);const sorted=latencies.sort((a,b)=>a-b);const summary={code,players:32,checks,errors,latency:{commandP95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1)},screenshots:out,maxLengthFixture:'Screenshots ending in -max use snapshot response fixtures with seven 80-grapheme strings for geometry testing; the locked AI caption and live DB scores are unchanged.'};
 await writeFile(`${out}/report.json`,JSON.stringify(summary,null,2));
 for(const [source,target] of [['host-moderation','caption-host'],['mobile-writing','caption-mobile'],['display-final-vote','caption-display'],['desktop-writing','caption-desktop'],['mobile-320-writing','caption-mobile-320'],['display-result','caption-result']])await copyFile(`${out}/${source}.png`,`.impeccable/review/${target}.png`);
 console.log(JSON.stringify({room:code,checks:checks.length,errors,latency:summary.latency}));
}catch(e){await writeFile(`${out}/failure.json`,JSON.stringify({roomCode,error:String(e),errors,checks},null,2));throw e;}
finally{for(const ctx of contexts){if(ctx.close)await ctx.close();else await ctx.dispose();}await browser.close();}
