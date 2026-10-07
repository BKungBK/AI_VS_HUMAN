import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import gsap from 'gsap';
import {chapters,allCues,evidence,formatTime,type Cue} from './content';
import {Visuals} from './Visuals';
import {World} from './World';
import {spoken,rehearsalSeconds} from './spoken';
import {AudioEngine,wavResult,type AudioState} from './AudioEngine';
import {scoreFor} from './SoundScore';
import {SoundPanel} from './SoundPanel';
import {command,tabIdentity,useRoom} from './game-client/network';

type Cursor={scene:number;beat:number};
export interface DeckAPI {ready:boolean;go:(scene:number|string,beat?:number|string)=>void;seek:(seconds:number)=>void;next:()=>void;previous:()=>void;pause:()=>void;resume:()=>void;state:()=>Record<string,unknown>;setFallback:()=>void;audio:{enable:(value?:boolean)=>Promise<void>;volume:(value:number)=>void;ambient:(value:boolean)=>void;speechSafe:(value:boolean)=>void;preview:()=>void;state:()=>AudioState;render:(duration?:number,ambient?:boolean)=>Promise<ReturnType<typeof wavResult>>}}
declare global {interface Window {deck:DeckAPI;__timelines:Record<string,gsap.core.Timeline>}}
const clamp=(v:number,max:number)=>Math.max(0,Math.min(max,Math.floor(Number(v)||0)));
const initial=():Cursor=>{const p=new URLSearchParams(location.search),s=clamp(p.get('scene') as unknown as number,15);return {scene:s,beat:clamp(p.get('cue') as unknown as number,chapters[s].cues.length-1)};};

export default function App(){
 const presenter=new URLSearchParams(location.search).has('presenter');
  const roomCode=new URLSearchParams(location.search).get('room');
  const controllerParam=new URLSearchParams(location.search).get('controller');
  const room=useRoom(roomCode??'','host',presenter&&!!roomCode);
 const [cursor,setCursor]=useState<Cursor>(initial),active=useRef(cursor);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[fallback,setFallback]=useState(false);
 const [paused,setPaused]=useState(false);
 const [soundOpen,setSoundOpen]=useState(false),[audioState,setAudioState]=useState<AudioState>({enabled:false,volume:.65,ambient:false,speechSafe:true,status:'locked',error:'',context:'uninitialized',voices:0,cue:null,playing:false,resyncs:0});
 const audio=useRef<AudioEngine|null>(null),audioStateRef=useRef(audioState),blankRef=useRef(false);audioStateRef.current=audioState;
  const roomController=useRef('');
  if(!roomController.current){if(controllerParam)sessionStorage.setItem('trust-tug:controller:tab',controllerParam);roomController.current=controllerParam??tabIdentity('controller');}
  const serverCueSync=useRef(''),cueQueue=useRef(Promise.resolve());
  const [roomCueMessage,setRoomCueMessage]=useState('');
 const [hidden,setHidden]=useState(()=>new URLSearchParams(location.search).has('clean')),[blank,setBlank]=useState(false),[indexOpen,setIndexOpen]=useState(false);
 const [dimensions,setDimensions]=useState({w:innerWidth,h:innerHeight});
 const element=useMemo(()=>{const el=document.createElement('div');el.className='visual-world';return el;},[]);
 const textElement=useMemo(()=>{const el=document.createElement('div');el.className='text-stage';return el;},[]);
 const stageRef=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),host=useRef<HTMLDivElement>(null),outgoing=useRef<HTMLDivElement>(null);
 const world=useRef<World|null>(null),channel=useRef<BroadcastChannel|null>(null),travelDirection=useRef(1);
 const clock=useRef({t:0,paused:false,last:0,ready:false,remote:false}),navLock=useRef(0),currentCue=chapters[cursor.scene].cues[cursor.beat];
 useEffect(()=>{if(presenter)document.querySelector('.presenter')?.scrollTo({top:0});},[cursor,presenter]);
 const render=useRef<(t:number)=>void>(()=>{}),readyRef=useRef(false);
 const navigate=useCallback((s:number|string,b:number|string=0,remote=false)=>{
  const si=typeof s==='string'?Math.max(0,chapters.findIndex(c=>c.id===s)):clamp(s,15);
  const bi=typeof b==='string'?Math.max(0,chapters[si].cues.findIndex(c=>c.id===b)):clamp(b,chapters[si].cues.length-1);
  const before=active.current;if(before.scene===si&&before.beat===bi){clock.current.t=clock.current.paused?4:0;audio.current?.seek(clock.current.t);render.current(clock.current.t);return;}
  travelDirection.current=si>before.scene||si===before.scene&&bi>before.beat?1:-1;
  world.current?.captureOutgoing();
  active.current={scene:si,beat:bi};clock.current.t=clock.current.paused?4:0;clock.current.last=0;setCursor({scene:si,beat:bi});
  if(!remote)channel.current?.postMessage({type:'navigate',cursor:{scene:si,beat:bi}});
 },[]);
 const next=useCallback(()=>{const c=active.current;if(c.beat+1<chapters[c.scene].cues.length)navigate(c.scene,c.beat+1);else if(c.scene<15)navigate(c.scene+1,0);},[navigate]);
 const previous=useCallback(()=>{const c=active.current;if(c.beat>0)navigate(c.scene,c.beat-1);else if(c.scene>0)navigate(c.scene-1,chapters[c.scene-1].cues.length-1);},[navigate]);
 const pause=useCallback((value:boolean,remote=false)=>{clock.current.paused=value;clock.current.last=0;if(value)audio.current?.hold();setPaused(value);if(!remote)channel.current?.postMessage({type:'pause',value});},[]);
 const blackout=useCallback((value:boolean,remote=false)=>{blankRef.current=value;if(value)audio.current?.hold();setBlank(value);if(!remote)channel.current?.postMessage({type:'blackout',value});},[]);
 const soundCommand=useCallback((action:string,value?:number|boolean)=>{
  if(presenter){if(action==='enabled'&&audioStateRef.current.status!=='ready'){setSoundOpen(true);return;}channel.current?.postMessage({type:'audio-command',action,value});return;}
  const a=audio.current;if(!a)return;
  if(action==='enabled')void a.enable(value===true);else if(action==='volume')a.setVolume(Number(value));else if(action==='ambient')a.setAmbient(value===true);else if(action==='speech')a.setSpeechSafe(value===true);else if(action==='preview')a.preview();
 },[presenter]);
 const toggleSound=useCallback(()=>soundCommand('enabled',!(audio.current?.settings.enabled??audioStateRef.current.enabled)),[soundCommand]);
   const openPresenter=()=>{window.open(`/?presenter=1&scene=${active.current.scene}&cue=${active.current.beat}${roomCode?`&room=${roomCode}&controller=${roomController.current}`:''}`,'sparring-presenter','popup,width=1200,height=850');};

 useEffect(()=>{
  const resize=()=>setDimensions({w:innerWidth,h:innerHeight});window.addEventListener('resize',resize);
  const bc=new BroadcastChannel('sparring-minds-v2');channel.current=bc;
   bc.onmessage=e=>{const m=e.data;if(m.type==='navigate')navigate(m.cursor.scene,m.cursor.beat,true);else if(m.type==='pause')pause(m.value,true);else if(m.type==='blackout')blackout(m.value,true);else if(m.type==='sync-request'&&!presenter)bc.postMessage({type:'sync',cursor:active.current,paused:clock.current.paused,audio:audio.current?.state()});else if(m.type==='audio-command'&&!presenter)soundCommand(m.action,m.value);else if(m.type==='audio-state'&&presenter)setAudioState(m.state);else if(m.type==='sync'&&presenter){const syncCue=chapters[m.cursor.scene]?.cues[m.cursor.beat]?.id;if(roomCode&&room.latest.current&&room.latest.current.room.cue!==syncCue)return;navigate(m.cursor.scene,m.cursor.beat,true);pause(m.paused,true);if(m.audio)setAudioState(m.audio);}};
  if(presenter)bc.postMessage({type:'sync-request'});
  return ()=>{window.removeEventListener('resize',resize);bc.close();};
  },[navigate,pause,blackout,presenter,soundCommand,roomCode,room.latest]);

  useEffect(()=>{
   const roomCue=room.snapshot?.room.cue;
   if(!presenter||!roomCode||!roomCue)return;
   const target=allCues.findIndex(item=>item.cue.id===roomCue);if(target<0)return;
   const chapterIndex=chapters.findIndex(item=>item.cues.some(cue=>cue.id===roomCue));
   const beatIndex=chapters[chapterIndex].cues.findIndex(cue=>cue.id===roomCue);
   if(active.current.scene===chapterIndex&&active.current.beat===beatIndex)return;
   serverCueSync.current=roomCue;
   navigate(chapterIndex,beatIndex,true);
   channel.current?.postMessage({type:'navigate',cursor:{scene:chapterIndex,beat:beatIndex}});
  },[presenter,roomCode,room.snapshot?.room.cue,navigate]);

  useEffect(()=>{
   if(!presenter||!roomCode||!room.snapshot)return;
   const cueId=chapters[cursor.scene].cues[cursor.beat].id;
   if(serverCueSync.current){if(serverCueSync.current===cueId)serverCueSync.current='';return;}
   if(room.latest.current?.room.cue===cueId)return;
   let cancelled=false;
   cueQueue.current=cueQueue.current.catch(()=>{}).then(async()=>{
    if(cancelled||chapters[active.current.scene].cues[active.current.beat].id!==cueId)return;
    for(let attempt=0;attempt<3;attempt++){
     let current=room.latest.current;
     if(!current){await room.refresh();current=room.latest.current;}
     if(!current)return;
     if(current.room.cue===cueId){setRoomCueMessage('สไลด์และห้องเกมเชื่อมกันแล้ว');return;}
     let host=current.host??null;
     if(!host||host.controllerId!==roomController.current||(host.leaseUntil??0)<=room.now()){
       try{await command(roomCode,'host','acquire',{controllerId:roomController.current});await room.refresh();current=room.latest.current;host=current?.host??null;}
      catch(error){throw error;}
     }
     if(!current||!host||host.controllerId!==roomController.current)throw new Error('เปิดหน้าผู้จัดของห้องนี้ไว้เพื่อควบคุมสไลด์');
     try{
      await command(roomCode,'host','cue',{cue:cueId,controllerId:roomController.current,controllerEpoch:host.controllerEpoch,expectedVersion:current.room.version});
      await room.refresh();setRoomCueMessage('สไลด์และห้องเกมเชื่อมกันแล้ว');return;
     }catch(error){
      if(error instanceof Error&&error.message.includes('สถานะห้องเปลี่ยนแล้ว')){await room.refresh();continue;}
      throw error;
     }
    }
    throw new Error('อัปเดตคิวไม่สำเร็จ โหลดสถานะล่าสุดแล้วลองอีกครั้ง');
   }).catch(error=>{if(!cancelled)setRoomCueMessage(error instanceof Error?error.message:'ยังเชื่อมคิวสไลด์ไม่ได้');});
   return()=>{cancelled=true;};
  },[presenter,roomCode,cursor.scene,cursor.beat,!!room.snapshot,room.latest,room.refresh]);

  useEffect(()=>{
   if(!presenter||!roomCode)return;
   const timer=setInterval(()=>{
    const current=room.latest.current,host=current?.host;
    if(current&&host?.controllerId===roomController.current&&(host.leaseUntil??0)>room.now())void command(roomCode,'host','heartbeat',{controllerId:roomController.current,controllerEpoch:host.controllerEpoch}).catch(()=>void room.refresh());
   },5000);
   return()=>clearInterval(timer);
  },[presenter,roomCode,room.latest,room.refresh]);

 useEffect(()=>{
  let live=true;
  const preload=async()=>{
   try{
    await Promise.all([document.fonts.load('400 32px "IBM Plex Sans Thai"','มนุษย์ AI'),document.fonts.load('600 90px "IBM Plex Sans Thai"','ความรับผิดชอบ'),document.fonts.load('500 26px "IBM Plex Sans Thai"','หลักฐาน')]);
    await Promise.all(['van-gogh','flamingone','death-cap'].map(name=>new Promise<void>((resolve,reject)=>{const img=new Image();img.onload=()=>{img.decode().then(()=>resolve(),reject);};img.onerror=()=>reject(new Error(`โหลดภาพ ${name} ไม่สำเร็จ`));img.src=`/assets/images/${name}.jpg`;})));
    await document.fonts.ready;
    if(live){clock.current.ready=true;readyRef.current=true;clock.current.last=0;setReady(true);}
   }catch(e){if(live)setError(e instanceof Error?e.message:String(e));}
  };preload();return()=>{live=false;};
 },[]);

 useLayoutEffect(()=>{
  if(presenter||!canvas.current||!host.current||!outgoing.current)return;
  const a=new AudioEngine(()=>{const state=audio.current?.state();if(state){setAudioState(state);if(state.status==='error')setSoundOpen(true);channel.current?.postMessage({type:'audio-state',state});}});audio.current=a;a.notify();
  const w=new World(canvas.current,host.current,element,textElement,outgoing.current,()=>setFallback(true));world.current=w;
  if(new URLSearchParams(location.search).has('fallback'))w.setFallback();
  return()=>{a.dispose();audio.current=null;w.dispose();world.current=null;};
 },[element,textElement,presenter]);

 useLayoutEffect(()=>{
  if(presenter)return;
  const cue=chapters[cursor.scene].cues[cursor.beat];
  const hasExit=!!world.current?.exitObjects.length;
  const tl=world.current?.enter(cue,travelDirection.current);
  audio.current?.configure(scoreFor(cue,{hasExit,journey:world.current?.journey?.active,direction:travelDirection.current}),clock.current.t);
  if(tl)window.__timelines={cards:tl,copy:tl,...(world.current?.narrative?{narrative:world.current.narrative.timeline}:{})};
  render.current=(t:number)=>world.current?.render(t);
  render.current(ready?clock.current.t:0);
 },[cursor,currentCue,ready,presenter]);

 useEffect(()=>{
  let id=0;const tick=(now:number)=>{const c=clock.current;if(c.ready){if(!c.paused&&c.last)c.t+=Math.min((now-c.last)/1000,.05);c.last=now;if(!presenter){render.current(c.t);audio.current?.sync(c.t,c.paused||blankRef.current||document.hidden);}}id=requestAnimationFrame(tick);};id=requestAnimationFrame(tick);const visibility=()=>{if(document.hidden)audio.current?.hold();};document.addEventListener('visibilitychange',visibility);return()=>{cancelAnimationFrame(id);document.removeEventListener('visibilitychange',visibility);};
 },[presenter]);

 useEffect(()=>{
  window.deck={ready,go:navigate,seek:(t:number)=>{clock.current.t=Math.max(0,Number(t)||0);clock.current.last=0;audio.current?.seek(clock.current.t);render.current(clock.current.t);},next,previous,pause:()=>pause(true),resume:()=>pause(false),setFallback:()=>world.current?.setFallback(),state:()=>({scene:active.current.scene,beat:active.current.beat,cue:chapters[active.current.scene].cues[active.current.beat].id,kind:chapters[active.current.scene].cues[active.current.beat].kind,time:clock.current.t,paused:clock.current.paused,ready:readyRef.current,audio:audio.current?.state()??audioStateRef.current,...world.current?.state()}),audio:{enable:async(value=true)=>{if(presenter){soundCommand('enabled',value);return;}await audio.current?.enable(value);},volume:v=>soundCommand('volume',v),ambient:v=>soundCommand('ambient',v),speechSafe:v=>soundCommand('speech',v),preview:()=>soundCommand('preview'),state:()=>audio.current?.state()??audioStateRef.current,render:async(duration=4,ambient=false)=>{if(!audio.current)throw new Error('Render audio from the projection window');return wavResult(await audio.current.render(duration,ambient));}}};
 },[ready,navigate,next,previous,pause,soundCommand]);

 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.target instanceof HTMLElement&&['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
   const k=e.key.toLowerCase();if(['arrowright','arrowleft',' ','pagedown','pageup'].includes(k)){e.preventDefault();if(e.repeat||e.timeStamp-navLock.current<220)return;navLock.current=e.timeStamp;if(['arrowright',' ','pagedown'].includes(k))next();else previous();}
   else if(k==='m')toggleSound();else if(k==='escape'&&soundOpen)setSoundOpen(false);else if(k==='p')pause(!clock.current.paused);else if(k==='b')blackout(!blank);else if(k==='h')setHidden(v=>!v);else if(k==='c'||k==='escape')setIndexOpen(v=>k==='escape'?false:!v);else if(k==='n')openPresenter();else if(k==='f'){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>{});}
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[next,previous,pause,blackout,blank,toggleSound,soundOpen]);

 const chapter=chapters[cursor.scene],cue=currentCue,flatIndex=allCues.findIndex(c=>c.cue.id===cue.id),nextCue=allCues[flatIndex+1];
 const centered=cue.kind==='placeholder',closing=['formula','different','future','responsibility','thanks'].includes(cue.visual||'');
 const scale=Math.min(dimensions.w/1920,dimensions.h/1080);
 const rehearsalStart=chapter.start+rehearsalSeconds[cursor.scene].slice(0,cursor.beat).reduce((a,b)=>a+b,0);
 const soundPanel=soundOpen&&<SoundPanel state={audioState} presenter={presenter} onClose={()=>setSoundOpen(false)} onToggle={toggleSound} onVolume={v=>soundCommand('volume',v)} onAmbient={v=>soundCommand('ambient',v)} onSpeech={v=>soundCommand('speech',v)} onPreview={()=>soundCommand('preview')}/>;
 if(presenter)return <div className="presenter"><header><span className="brand-mark">H / AI</span><h1>Presenter view</h1><span>{ready?'พร้อมนำเสนอ':'กำลังโหลด'}</span></header><main><section className="presenter-current"><div className="presenter-label">CURRENT · {chapter.id} / {cursor.beat+1} · {formatTime(rehearsalStart)}–{formatTime(rehearsalStart+rehearsalSeconds[cursor.scene][cursor.beat])}</div><h2>{cue.title.replaceAll('\n',' ')}</h2><p>{cue.subtitle}</p><p className="stage-direction">{spoken[cue.id].direction}</p><div className="notes">{spoken[cue.id].speech}</div><details className="fact-guard"><summary>ข้อกำกับข้อมูลสำหรับผู้พูด</summary><p>{cue.notes}</p></details><div className="source-notes">{cue.facts.map(id=><p key={id}><a href={evidence[id].url} target="_blank" rel="noreferrer">{evidence[id].label}</a><br/>{evidence[id].finding}<small>{evidence[id].status}</small></p>)}</div></section><aside><div className="presenter-label">NEXT</div><h2>{nextCue?.cue.title.replaceAll('\n',' ')||'จบการนำเสนอ'}</h2><p>{nextCue?.cue.subtitle}</p><div className="presenter-navigation"><button onClick={previous}>← ย้อนคิว</button><button onClick={next}>คิวถัดไป →</button><button onClick={()=>pause(!paused)}>{paused?'เล่นภาพต่อ':'หยุดภาพ'}</button><button onClick={()=>blackout(!blank)}>ดับ / เปิดจอ</button></div><label>เลือกบท<select value={cursor.scene} onChange={e=>navigate(Number(e.target.value))}>{chapters.map((c,i)=><option value={i} key={c.id}>{c.id} · {c.title}</option>)}</select></label><p className="presenter-help">คีย์บอร์ด: ← → / Space เปลี่ยนคิว<br/>P หยุด · B ดับจอ · C เลือกบท · M เสียง</p>{roomCode?<div className={`room-cue-status ${room.apiOnline?'online':'offline'}`} role="status"><strong>ห้อง {roomCode}</strong><span>{roomCueMessage|| (room.snapshot?'กำลังเชื่อมคิวสไลด์':'กำลังเชื่อมต่อห้อง')}</span></div>:null}<button onClick={()=>setSoundOpen(v=>!v)}>คุมเสียงจอฉาย · {audioState.enabled?'เปิด':'ปิด'}</button>{soundPanel}</aside></main></div>;

 return <div className="app-shell">
  <div className={`stage ${centered?'placeholder':''} ${closing?'closing':''} ${fallback?'fallback':''}`} ref={stageRef} data-cue={cue.id} data-kind={cue.kind} data-visual={cue.visual||'placeholder'} style={{transform:`translate(-50%,-50%) scale(${scale})`}}>
   <div className="slate-background"/><div className="atmosphere atmosphere-human"/><div className="atmosphere atmosphere-ai"/><div className="grain"/>
   <canvas className="particle-canvas" ref={canvas}/><div className="spatial-host" ref={host}/><div className="outgoing" ref={outgoing} aria-hidden="true"/>
   <div className="slide-copy">
    {!centered&&<><header className="stage-header"><a className="stage-brand" href="/" tabIndex={-1}><span className="brand-mark">H / AI</span><span>THE SPARRING MINDS</span></a><div className="chapter-marker"><b>{chapter.id}</b><span>{chapter.title}</span></div></header><div className="chapter-progress"><span style={{width:`${(cursor.scene+1)/16*100}%`}}/></div></>}
    {!centered&&<footer className="stage-footer"><div className="speaker-label"><i className={`dot-${cue.speaker.toLowerCase()}`}/>{cue.speaker==='Both'?'HUMAN + AI':cue.speaker.toUpperCase()}</div><div className="citations">{cue.facts.map(id=><a key={id} href={evidence[id].url} target="_blank" rel="noreferrer">{evidence[id].label}</a>)}</div><span className="cue-marker">{cue.id} <i/> {formatTime(chapter.start)}</span></footer>}
   </div>
   <div className={`blackout ${blank?'on':''}`}/>
   {!ready&&<div className="loading"><div className="brand-mark">H / AI</div><p>{error||'กำลังเตรียมภาพและฟอนต์…'}</p>{error&&<button onClick={()=>location.reload()}>ลองโหลดอีกครั้ง</button>}</div>}
  </div>
  {createPortal(<Visuals cue={cue}/>,element)}
  {createPortal(<div className={`copy-block ${cue.visual==='opening'?'opening-copy':''}`}>
   {!centered&&<div className={`eyebrow speaker-${cue.speaker.toLowerCase()}`} data-reveal><i/>{cue.eyebrow}</div>}
   <h1 data-reveal className={cue.visual==='opening'?'opening-title':/^[A-Z .?&\n]+$/.test(cue.title)?'latin-title':''}>{cue.title.split('\n').map((line,i)=><span data-text-line key={`${cue.id}-${i}`} className={line==='vs AI'?'ai-title':''}>{line==='vs AI'?<><em className="small-vs">vs</em> AI</>:line}</span>)}</h1>
   <p className="subtitle" data-reveal>{cue.subtitle}</p>
   {!centered&&cue.visual==='opening'&&<div className="opening-question" data-reveal>Who should do what?<br/><b>Who remains responsible?</b></div>}
   {!centered&&cue.visual==='mushroom'&&<div className="context-label" data-reveal>สถานการณ์จำลอง · ไม่ใช้ระบุชนิดเห็ด</div>}
  </div>,textElement)}
  {!hidden&&<nav className="controls" aria-label="ควบคุมการนำเสนอ"><button onClick={previous} title="คิวก่อนหน้า">←</button><span>{chapter.id} / 16 <i/> {cursor.beat+1} / {chapter.cues.length}</span><button onClick={next} title="คิวถัดไป">→</button><button onClick={()=>pause(!paused)}>{paused?'เล่นต่อ':'หยุดภาพ'}</button><button onClick={()=>setIndexOpen(v=>!v)}>เลือกบท</button><button className="sound-control" onClick={toggleSound} aria-pressed={audioState.enabled} aria-label={audioState.enabled?'ปิดเสียง':'เปิดเสียง'} disabled={audioState.status==='loading'}>{audioState.status==='loading'?'เตรียมเสียง…':`เสียง · ${audioState.enabled?'เปิด':'ปิด'}`}</button><button onClick={()=>setSoundOpen(v=>!v)} aria-label="ตั้งค่าเสียง">ตั้งเสียง</button><button onClick={openPresenter}>บทผู้พูด</button><button onClick={()=>setHidden(true)}>ซ่อน · H</button></nav>}
  {soundPanel}
  {indexOpen&&<div className="chapter-index"><div><h2>เลือกบท</h2><button onClick={()=>setIndexOpen(false)}>ปิด ×</button></div>{chapters.map((c,i)=><button key={c.id} onClick={()=>{navigate(i);setIndexOpen(false);}} className={cursor.scene===i?'selected':''}><b>{c.id}</b><span>{c.title}</span><small>{formatTime(c.start)}</small></button>)}</div>}
 </div>;
}
