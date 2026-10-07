import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {chapters,allCues} from '../content';
import type {GroupScore,Role,Side,Snapshot,SwipeReveal,SwipeSnapshot} from '../shared/game-contracts';
import {api,command,newId,tabIdentity,useRoom} from './network';
import './game.css';
import './caption.css';
import './waiting-stage.css';
import CaptionBattle from './CaptionBattle';
import RouletteGame from './RouletteGame';
import WhackGame from './WhackGame';
import ShieldGame from './ShieldGame';
import PieceGame from './PieceGame';
import WaitingStage from './WaitingStage';
import './unified-theme.css';

const sideName=(side:Side|null|undefined)=>side==='HUMAN'?'Human':side==='AI'?'AI':'ยังไม่เลือกฝั่ง';
function Mark({side}:{side:'HUMAN'|'AI'}){return <svg viewBox="0 0 48 48" aria-hidden="true">{side==='HUMAN'?<><circle cx="24" cy="15" r="7"/><path d="M10 39c0-9 6-14 14-14s14 5 14 14"/></>:<><rect x="11" y="11" width="26" height="26" rx="6"/><path d="M19 20h1m8 0h1M18 29h12M24 4v7M4 24h7m26 0h7"/></>}</svg>;}
function Arena({s}:{s:Snapshot}) {
 const h=s.sides.HUMAN??{taps:0,members:0},a=s.sides.AI??{taps:0,members:0};
 const hm=h.members?h.taps/h.members:0,am=a.members?a.taps/a.members:0;
 const delta=Math.max(-110,Math.min(110,(am-hm)*3));
 const result=s.run&&['RESULT','COMPLETED'].includes(s.run.status);
 const verdict=!h.members||!a.members?'ไม่มีคู่เปรียบเทียบ':h.taps*a.members===a.taps*h.members?'แรงเฉลี่ยเสมอกัน':h.taps*a.members>a.taps*h.members?'Human ดึงได้มากกว่า':'AI ดึงได้มากกว่า';
 return <div className="trust-arena">
  <div className="side-summary human"><Mark side="HUMAN"/><strong>Human</strong><span>{h.members} คน</span>{s.room.activeRunId||result?<b>{hm.toFixed(1)} <small>แตะ / คน</small></b>:null}</div>
  <div className="rope-field"><svg viewBox="0 0 600 170" role="img" aria-label="เชือกแสดงแรงเฉลี่ย Human และ AI"><path className="rope-guide" d="M300 18v138"/><path className="rope" d="M35 86Q160 103 300 86T565 86"/><path className="rope-twist" d="M35 86Q160 69 300 86T565 86"/><circle className="rope-end human" cx="35" cy="86" r="15"/><circle className="rope-end ai" cx="565" cy="86" r="15"/><g style={{transform:`translateX(${delta}px)`}}><path className="rope-knot" d="M291 58h18v56l-9-9-9 9z"/><circle cx="300" cy="86" r="6" className="rope-pin"/></g></svg><p>{result?verdict:'ตอนนี้คุณไว้ใจฝั่งไหนมากกว่า?'}</p></div>
  <div className="side-summary ai"><Mark side="AI"/><strong>AI</strong><span>{a.members} คน</span>{s.room.activeRunId||result?<b>{am.toFixed(1)} <small>แตะ / คน</small></b>:null}</div>
 </div>;
}
function Scores({scores,confirmed=false}:{scores:GroupScore[];confirmed?:boolean}){
 const ordered=[...scores].sort((a,b)=>b.numerator*(a.denominator||1)-a.numerator*(b.denominator||1)||a.id-b.id);
 return <div className="scoreboard"><h2>{confirmed?'คะแนนที่ยืนยันแล้ว':'คะแนนกลุ่มรอยืนยัน'}</h2><p>รวมแตะที่รับจริง แล้วเฉลี่ยจากสมาชิกตอนเริ่มเกม รวมคนที่ไม่ได้แตะ</p><ol>{ordered.map((g,i)=><li key={g.id}><span className="rank">{i>0&&g.numerator*(ordered[i-1].denominator||1)===ordered[i-1].numerator*(g.denominator||1)?'=':i+1}</span><span className="group-label">{g.name}<small>{g.denominator?`สมาชิก ${g.denominator} คน`:'ไม่มีผู้เล่น'}</small></span><strong>{g.denominator?(g.numerator/g.denominator).toFixed(2):'0.00'}<small> คะแนนเฉลี่ย</small></strong></li>)}</ol></div>;
}
function useTicker(now:()=>number){const [,tick]=useState(0);useEffect(()=>{const id=setInterval(()=>tick(x=>x+1),100);return()=>clearInterval(id);},[]);return now();}
function Time({s,now}:{s:Snapshot;now:number}){
 const r=s.run;if(!r||r.status!=='RUNNING')return null;
 const ms=r.paused?r.remainingMs??0:Math.max(0,(r.deadline??now)-now);
 return <div className="phase-clock" aria-label={`เหลือ ${Math.ceil(ms/1000)} วินาที`}><span>{r.paused?'พักเกม':r.phase==='COUNTDOWN'?'เตรียมดึง':'เหลือเวลา'}</span><strong>{r.phase==='COUNTDOWN'?Math.ceil(ms/1000):(ms/1000).toFixed(1)}<small>วิ</small></strong></div>;
}
function Header({code,role,online,realtime}:{code?:string;role?:Role;online?:boolean;realtime?:string}){return <header className="game-header"><a href="/games" className="game-brand">HUMAN <span>vs</span> AI</a><div>{code?<span>ห้อง <b>{code}</b></span>:null}{role==='host'&&code?<a className="deck-link" href={`/?room=${code}&controller=${encodeURIComponent(tabIdentity('controller'))}`} target="_blank" rel="noopener">เปิดสไลด์</a>:null}{role?<span>{role==='host'?'ผู้จัด':role==='display'?'จอฉาย':'ผู้เล่น'}</span>:null}{online!==undefined?<span className={`connection ${online?'connected':'offline'}`} role="status">{online?'ออนไลน์':'กำลังเชื่อมต่อ'}<small>{realtime}</small></span>:null}</div></header>;}

function Home(){
 const [key,setKey]=useState(''),[roomCode,setRoomCode]=useState(''),[logged,setLogged]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[rooms,setRooms]=useState<{code:string;cue:string}[]>([]),[hostHelp,setHostHelp]=useState('กำลังตรวจการตั้งค่าห้อง');
 const load=useCallback(async()=>{const savedRooms=await api<{code:string;cue:string}[]>('/rooms','host');setRooms(savedRooms);setLogged(true);},[]);useEffect(()=>{void load().catch(()=>setLogged(false));},[load]);useEffect(()=>{void api<{mode:string}>('/health','player').then(x=>setHostHelp(x.mode==='local-pglite'?'ดูรหัสจาก data/host-key.txt หรือ Start-Game.cmd':'ใช้รหัสผู้จัดที่ตั้งไว้บนโฮสต์')).catch(()=>setHostHelp('ใส่รหัสผู้จัดของระบบนี้'));},[]);
 const login=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setMessage('');try{await api('/host/login','host',{key:key.trim()});await load();setKey('');}catch(e){setMessage(e instanceof Error?e.message:'เชื่อมต่อไม่ได้');}finally{setBusy(false);}};
 const create=async()=>{setBusy(true);try{const r=await api<{code:string}>('/rooms','host',{capacity:32});location.assign(`/presenter/${r.code}`);}catch(e){setMessage(e instanceof Error?e.message:'เชื่อมต่อไม่ได้');setBusy(false);}};
  return <div className="game-page"><Header/><main className="game-home"><div className="home-intro"><h1>HUMAN<br/>vs AI</h1><p>สไลด์และเกมใช้ห้องเดียวกัน<br/>สแกนครั้งเดียว แล้วรอเล่น</p><div className="home-rope"><svg viewBox="0 0 420 80" aria-hidden="true"><path d="M0 40Q105 15 210 40T420 40"/><circle cx="210" cy="40" r="12"/></svg></div><p className="game-facts">7 เกม · 8 กลุ่ม · ผลขึ้นจอฉายแบบเรียลไทม์</p><a className="text-link" href="/">เปิดเว็บสไลด์เดิม</a></div><div className="home-actions"><section><h2>เข้าร่วมเกม</h2><form onSubmit={e=>{e.preventDefault();location.assign(`/play/${roomCode.toUpperCase()}`);}}><label htmlFor="room-code">รหัสห้อง</label><input id="room-code" autoComplete="off" value={roomCode} onChange={e=>setRoomCode(e.target.value.replace(/[^a-f\d]/gi,'').slice(0,6))} placeholder="รหัส 6 ตัว" required minLength={6} maxLength={6}/><button className="primary" disabled={roomCode.length!==6}>เข้าห้อง</button></form></section><section className="host-entry"><h2>สำหรับผู้จัด</h2>{logged?<><p>สร้างห้องสำหรับผู้เล่น 32 คน แบ่งเป็น 8 กลุ่ม</p><button className="primary" disabled={busy} onClick={create}>{busy?'กำลังสร้างห้อง…':'สร้างห้อง'}</button>{rooms.length?<div className="saved-rooms"><h3>กลับเข้าห้องเดิม</h3>{rooms.slice(0,6).map(r=><a key={r.code} href={`/presenter/${r.code}`}>{r.code}<span>คิว {r.cue}</span></a>)}</div>:null}</>:<form onSubmit={login}><label htmlFor="host-key">รหัสผู้จัด</label><input id="host-key" type="password" value={key} onChange={e=>setKey(e.target.value)} required autoComplete="current-password"/><p className="field-help">{hostHelp}</p><button disabled={busy} className="secondary">{busy?'กำลังเข้าสู่ระบบ…':'เข้าสู่ระบบผู้จัด'}</button></form>}</section>{message?<p className="error-message" role="alert">{message}</p>:null}</div></main></div>;
}
function Join({code,onJoin}:{code:string;onJoin:()=>void}){
 const [groups,setGroups]=useState<{id:number;name:string;members:number}[]>([]),[cue,setCue]=useState('02.01'),[name,setName]=useState(''),[group,setGroup]=useState(0),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{void api<{groups:typeof groups;room:{cue:string}}>(`/rooms/${code}/lobby`,'player').then(x=>{setGroups(x.groups);setCue(x.room.cue);}).catch(e=>setMessage(e.message));},[code]);
 const join=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setMessage('');try{await command(code,'player','join',{nickname:name.trim(),groupId:group});onJoin();}catch(e){setMessage(e instanceof Error?e.message:'ติดต่อห้องไม่ได้');}finally{setBusy(false);}};
  return <main className="player-main"><h1>{cue==='14.01'?'Missing Piece':cue==='11.02'?'Company Shield':cue==='10.02'?'Chat Whack-a-Mole':cue==='07.01'?'Death Cap Roulette':cue==='04.01'?'Caption & Prompt Battle':cue==='03.05'?'Swipe Court':'เข้าร่วมกิจกรรม'}</h1><p>กรอกชื่อ เลือกกลุ่ม แล้วรอเกมบนมือถือ</p><form className="join-form" onSubmit={join}><label htmlFor="nickname">ชื่อเล่น</label><input id="nickname" value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname" maxLength={24} placeholder="ชื่อที่เพื่อนเรียก" required/><fieldset><legend>เลือกกลุ่ม</legend><div className="group-choices">{groups.map(g=><label key={g.id} className={group===g.id?'selected':''}><input type="radio" name="group" value={g.id} checked={group===g.id} onChange={()=>setGroup(g.id)} required/><strong>{g.name}</strong><span>{g.members} คน</span></label>)}</div></fieldset>{message?<p role="alert" className="error-message">{message}</p>:null}<button className="primary" disabled={busy||!name.trim()||!group}>{busy?'กำลังเข้าห้อง…':'เข้าร่วม'}</button><a href={`/display/${code}`} className="text-link">จอฉาย</a></form></main>;
}

function Player({room}:{room:ReturnType<typeof useRoom>}){
 const s=room.snapshot!,me=s.me!,r=s.run,writer=useRef(tabIdentity('input')),claiming=useRef(false),pending=useRef<{id:string;sequence:number}[]>([]),sending=useRef(false),seq=useRef(0);
 const [message,setMessage]=useState(''),[localPractice,setLocalPractice]=useState(0),[choiceBusy,setChoiceBusy]=useState(false),[unsent,setUnsent]=useState(0);
 const now=useTicker(room.now),preview=s.room.activeRunId===null&&s.room.cue==='02.01'&&(!r||['CANCELLED','SUPERSEDED'].includes(r.status));
 const practice=preview&&s.room.practiceUntil!==null&&now<s.room.practiceUntil;
 const active=r?.status==='RUNNING',writable=me.state?.writer_id===writer.current;
 const playing=active&&r.phase==='PULLING'&&!r.paused&&me.inRoster&&me.lockedSide!=='UNSELECTED'&&room.apiOnline&&room.isFresh()&&now<(r.deadline??0)&&writable;
 const claim=useCallback(async()=>{const cur=room.latest.current;if(!cur?.run||claiming.current)return;claiming.current=true;try{await command(s.room.code,'player','writer',{runId:cur.run.id,writerId:writer.current});await room.refresh();setMessage('');}catch(e){setMessage(e instanceof Error?e.message:'ยังรับสิทธิ์ไม่ได้');}finally{claiming.current=false;}},[room.latest,room.refresh,s.room.code]);
 useEffect(()=>{if(active&&me.inRoster&&me.state?.writer_id===null)void claim();},[active,me.inRoster,me.state?.writer_id,claim]);
 useEffect(()=>{seq.current=Math.max(seq.current,me.state?.last_sequence??0);},[me.state?.last_sequence]);
 useEffect(()=>{pending.current=[];setUnsent(0);seq.current=me.state?.last_sequence??0;},[r?.id]);
 useEffect(()=>{setLocalPractice(0);},[s.room.practiceId]);
 useEffect(()=>{if(!active||r.paused||!room.apiOnline){pending.current=[];setUnsent(0);}},[active,r?.paused,room.apiOnline,r?.phaseToken]);
 useEffect(()=>{
  if(!preview||me.ready||!room.apiOnline)return;let cancelled=false;
  const ready=async()=>{try{await document.fonts.load('600 24px "IBM Plex Sans Thai"','มนุษย์');await document.fonts.ready;if(!cancelled){await command(s.room.code,'player','ready',{previewId:s.room.previewId,contentVersion:'trust-tug-v1'});await room.refresh();}}catch{setMessage('กำลังโหลดเกม ลองรีเฟรชเมื่อเครือข่ายพร้อม');}};void ready();return()=>{cancelled=true;};
 },[preview,me.ready,s.room.previewId,room.apiOnline,room.refresh,s.room.code]);
 useEffect(()=>{
  const flush=async()=>{
   const cur=room.latest.current;if(sending.current||!pending.current.length||!cur?.run||!cur.me?.state)return;
   const batch=pending.current.splice(0,20),run=cur.run,state=cur.me.state;sending.current=true;
    try{const result=await command<{accepted:number;events:{accepted:boolean;reason:string|null}[]}>(s.room.code,'player','tap',{runId:run.id,phaseToken:run.phaseToken,writerId:writer.current,inputEpoch:state.input_epoch,events:batch});room.ack(run.id,result.accepted);const rejected=result.events.filter(e=>!e.accepted);if(rejected.length)setMessage('มีบางแตะส่งไม่สำเร็จ กำลังตรวจสถานะล่าสุด');else setMessage('');}
   catch(e){setMessage(e instanceof Error?e.message:'ยังส่งไม่สำเร็จ');void room.refresh();}
   finally{sending.current=false;setUnsent(pending.current.length);}
  };
  const timer=setInterval(()=>void flush(),100);return()=>{clearInterval(timer);};
 },[room.latest,room.ack,room.refresh,s.room.code]);
 const pull=()=>{if(practice){setLocalPractice(x=>x+1);return;}if(!playing)return;pending.current.push({id:newId(),sequence:++seq.current});setUnsent(pending.current.length);};
 const choose=async(side:Side)=>{setChoiceBusy(true);try{await command(s.room.code,'player','side',{previewId:s.room.previewId,side,expectedRevision:me.sideRevision});await room.refresh();setMessage('');}catch(e){setMessage(e instanceof Error?e.message:'เลือกฝั่งไม่ได้');void room.refresh();}finally{setChoiceBusy(false);}};
 const accepted=me.state?.accepted??0,result=r&&['RESULT','COMPLETED'].includes(r.status);
 return <main className="player-main"><div className="player-identity"><span>{me.nickname}</span><span>{s.groups.find(g=>g.id===me.groupId)?.name}</span></div>
  <h1>Trust Tug-of-War</h1>
  {preview?<><h2>ตอนนี้ไว้ใจใครมากกว่า?</h2><p>เลือกฝั่งของคุณ กลุ่มแข่งขันยังเป็นกลุ่มเดิม</p><div className="side-choices">{(['HUMAN','AI'] as const).map(side=><button key={side} className={`side-choice ${side.toLowerCase()} ${me.side===side?'selected':''}`} aria-pressed={me.side===side} onClick={()=>void choose(side)} disabled={choiceBusy||!room.apiOnline}><Mark side={side}/><strong>{sideName(side)}</strong><span>{me.side===side?'เลือกแล้ว':'เลือกฝั่งนี้'}</span></button>)}</div>
   {practice?<div className="practice-block"><p>ทดลอง · เหลือ {Math.ceil((s.room.practiceUntil!-now)/1000)} วินาที</p><button className={`pull-button ${me.side.toLowerCase()}`} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();pull();}} onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();pull();}}}>ดึง!<small>ทดลอง {localPractice} แตะ · ไม่คิดคะแนน</small></button></div>:<div className="waiting-note"><strong>{me.ready?'พร้อมเล่นแล้ว':'กำลังเตรียมเกม…'}</strong><p>รอผู้จัดเปิดช่วงทดลองหรือเริ่มเกม<br/>ดึงจริง 10 วินาที แตะครั้งละ 10 คะแนน แตะได้ไม่จำกัด</p></div>}</>:active?<>
   <div className="locked-side">ฝั่งที่ล็อก <strong className={(me.lockedSide??'').toLowerCase()}>{sideName(me.lockedSide)}</strong></div><Time s={s} now={now}/>
   {!me.inRoster?<div className="waiting-note"><h2>เข้าหลังเริ่มเกม</h2><p>คุณอยู่ในห้องแล้ว รอเกมถัดไป</p></div>:me.lockedSide==='UNSELECTED'?<div className="waiting-note"><h2>ยังไม่ได้เลือกฝั่งก่อนเริ่ม</h2><p>รอบนี้ยังดึงไม่ได้ รอรอบถัดไป<br/>คุณยังอยู่ในสมาชิกกลุ่มที่ใช้เฉลี่ยคะแนน</p></div>:<>
   {!writable?<div className="waiting-note"><p>เกมนี้เปิดอยู่ที่อีกแท็บ</p><button className="secondary" onClick={()=>void claim()} disabled={r.paused||!room.apiOnline}>เล่นต่อที่แท็บนี้</button></div>:null}
    <button className={`pull-button ${(me.lockedSide??'').toLowerCase()}`} disabled={!playing} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();pull();}} onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();pull();}}}><span>{r.paused?'พักเกม':r.phase==='COUNTDOWN'?'เตรียมตัว':'ดึง!'}</span><small>{r.paused?'รอผู้จัดเล่นต่อ':'แตะครั้งละหนึ่งที · ไม่จำกัดจำนวน'}</small></button>
    <div className="tap-total" aria-live="polite"><strong>{accepted}<small> แตะ</small></strong><span>ระบบรับแล้ว · {accepted*10} คะแนน</span>{unsent?<small className="pending">รอส่ง {unsent} แตะ</small>:null}</div></>}
   </>:result?<><h2>{r.status==='COMPLETED'?'ยืนยันคะแนนแล้ว':'จบดึงแล้ว'}</h2><div className="personal-result"><strong>{accepted*10}<small> คะแนน</small></strong><p>รับแล้ว {accepted} แตะ · ฝั่ง {sideName(me.lockedSide)}</p></div><Arena s={s}/><p className="waiting-note">{r.status==='COMPLETED'?'รอเกมถัดไป':'รอผู้จัดกด “จบเกม / ไปต่อ”'}</p>{s.scores?<Scores scores={s.scores} confirmed={r.status==='COMPLETED'}/>:null}</>:<div className="waiting-note"><h2>{r?.status==='CANCELLED'?'เกมยกเลิก / ไม่นับคะแนน':'รอเกมถัดไป'}</h2><p>ยังอยู่ในห้อง {s.room.code} ไม่ต้องเข้าร่วมใหม่</p></div>}
  {message?<p className="input-message" role="status">{message}</p>:null}
  <details className="player-settings"><summary>ข้อมูลกลุ่มและออกจากห้อง</summary><p>กลุ่มปัจจุบัน: {s.groups.find(g=>g.id===me.groupId)?.name}</p>{!s.room.teamLocked?<label>เปลี่ยนกลุ่ม<select value={me.groupId} onChange={e=>{void command(s.room.code,'player','group',{groupId:Number(e.target.value)}).then(room.refresh).catch(e=>setMessage(e.message));}}>{s.groups.map(g=><option key={g.id} value={g.id}>{g.name} ({g.members} คน)</option>)}</select></label>:<p>กลุ่มถูกล็อกแล้ว ผู้จัดย้ายให้ได้สำหรับเกมถัดไป</p>}<button className="quiet danger" onClick={()=>{void command(s.room.code,'player','leave',{}).then(()=>location.assign('/games')).catch(e=>setMessage(e.message));}}>ออกจากห้อง</button></details>
 </main>;
}

function Host({room}:{room:ReturnType<typeof useRoom>}){
 const s=room.snapshot!,r=s.run,controller=useRef(tabIdentity('controller'));
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[reason,setReason]=useState(''),[link,setLink]=useState(`${location.origin}/play/${s.room.code}`),[timing,setTiming]=useState('normal');
 const now=useTicker(room.now),hasControl=s.host?.controllerId===controller.current&&(s.host?.leaseUntil??0)>now;
 const acquire=useCallback(async(takeover=false)=>{try{await command(s.room.code,'host','acquire',{controllerId:controller.current,...(takeover?{reason:reason.trim()}: {})});await room.refresh();setMessage('');}catch(e){setMessage(e instanceof Error?e.message:'รับสิทธิ์ไม่ได้');}},[s.room.code,room.refresh,reason]);
 useEffect(()=>{if(s.host&&!s.host.controllerId)void acquire();},[s.host?.controllerId,acquire]);
 useEffect(()=>{if(!hasControl)return;const timer=setInterval(()=>{const cur=room.latest.current;if(cur?.host)void command(s.room.code,'host','heartbeat',{controllerId:controller.current,controllerEpoch:cur.host.controllerEpoch}).catch(()=>void room.refresh());},5000);return()=>clearInterval(timer);},[hasControl,s.room.code,room.latest,room.refresh]);
 const act=async(kind:string,payload:Record<string,unknown>={})=>{
  setBusy(true);setMessage('');const cur=room.latest.current!;
  try{const res=await command(s.room.code,'host',kind,{...payload,controllerId:controller.current,controllerEpoch:cur.host!.controllerEpoch,expectedVersion:cur.room.version});await room.refresh();if(kind==='start'&&Number(res.unready)>0)setMessage(`เริ่มแล้ว มีผู้เล่นยังไม่พร้อม ${res.unready} คน`);else if(['cancel','replay'].includes(kind))setReason('');}
  catch(e){setMessage(e instanceof Error?e.message:'ติดต่อระบบไม่ได้');void room.refresh();}finally{setBusy(false);}
 };
 const baseDisabled=busy||!hasControl||!room.apiOnline;
 const active=r?.status==='RUNNING',result=r?.status==='RESULT',finished=r?.status==='COMPLETED';
 const canStart=!s.room.activeRunId&&s.room.cue==='02.01'&&!finished&&now>=(s.room.practiceUntil??0);
 const copy=async()=>{try{await navigator.clipboard.writeText(link);setMessage('คัดลอกลิงก์ผู้เล่นแล้ว');}catch{setMessage('เลือกข้อความในช่องลิงก์ แล้วคัดลอกได้เลย');}};
 return <main className="host-main"><div className="host-heading"><div><h1>Trust Tug-of-War</h1><p>คิว {s.room.cue} · {r?`รอบ ${r.id.slice(0,8)}`:'เตรียมห้อง'} · ผู้เล่น {s.groups.reduce((v,g)=>v+g.members,0)}/{s.room.capacity} คน</p></div><a className="secondary button-link" href={`/display/${s.room.code}`} target="_blank" rel="noreferrer">เปิดจอฉาย</a></div>
 <div className="host-grid"><section className="control-section"><div className="section-heading"><h2>{result?'ผลเกมรอยืนยัน':finished?'ยืนยันคะแนนแล้ว':active?r.paused?'พักเกม':r.phase==='COUNTDOWN'?'กำลังนับถอยหลัง':'กำลังดึง':'พร้อมเริ่มเกม'}</h2><Time s={s} now={now}/></div><Arena s={s}/>
 {!hasControl?<div className="control-notice"><p>{s.host?.leaseUntil&&s.host.leaseUntil>now?'มีอีกแท็บควบคุมอยู่ ใส่เหตุผลด้านล่างเพื่อรับช่วงต่อ':'ยังไม่มีสิทธิ์ควบคุมห้อง'}</p><button className="secondary" disabled={busy||(!!s.host?.leaseUntil&&s.host.leaseUntil>now&&!reason.trim())} onClick={()=>void acquire(!!s.host?.leaseUntil&&s.host.leaseUntil>now)}>รับสิทธิ์ควบคุม</button></div>:null}
 <div className="host-controls">{!active&&!result&&!finished?<><button className="secondary" disabled={baseDisabled||!canStart} onClick={()=>void act('practice')}>ทดลอง 15 วินาที</button><button className="primary" disabled={baseDisabled||!canStart} onClick={()=>void act('start',{timingProfile:timing})}>เริ่มเกม</button></>:null}{active?<button className="primary" disabled={baseDisabled} onClick={()=>void act(r.paused?'resume':'pause')}>{r.paused?'เล่นต่อ':'พักเกม'}</button>:null}{result?<button className="primary finish-button" disabled={baseDisabled} onClick={()=>void act('finish',{inputDigest:s.host!.inputDigest})}>จบเกม / ไปต่อ</button>:null}</div>
 {result?<p>ปุ่มเดียวจะยืนยันคะแนนและไปสไลด์ 03.01 เกมค้างผลจนกว่าจะกด</p>:active?<p>ทีมและฝั่งล็อกแล้ว · เปลี่ยนคิวไม่ได้จนเกมจบ</p>:<><p className="readiness">พร้อม {s.groups.reduce((v,g)=>v+g.members,0)-(s.host?.unready??0)} คน · ยังไม่พร้อม {s.host?.unready??0} คน<br/>เริ่มได้แม้มีคนไม่พร้อม ทุกคนในห้องยังอยู่ใน roster</p><label className="timing-choice">เวลาอภิปราย<select value={timing} onChange={e=>setTiming(e.target.value)} disabled={baseDisabled||!!s.room.activeRunId}><option value="normal">ปกติ · กรอบ 130 วินาที</option><option value="compact">กระชับ · กรอบ 110 วินาที</option></select></label></>}
 {message?<p className="input-message" role="status">{message}</p>:null}
 <details className="host-tools"><summary>จัดการรอบและเปลี่ยนคิว</summary><label htmlFor="reason">เหตุผลยกเลิก / เล่นใหม่ / รับช่วงควบคุม</label><input id="reason" value={reason} onChange={e=>setReason(e.target.value)} maxLength={200} placeholder="ใส่เหตุผลที่ตรวจสอบย้อนหลังได้"/><div className="tool-buttons"><button className="quiet danger" disabled={baseDisabled||!s.room.activeRunId||!reason.trim()} onClick={()=>void act('cancel',{reason:reason.trim()})}>ยกเลิก / ไม่นับคะแนน</button><button className="secondary" disabled={baseDisabled||!r||!reason.trim()} onClick={()=>void act('replay',{reason:reason.trim()})}>เล่นใหม่แทนรอบเดิม</button></div><label>คิวสไลด์<select value={s.room.cue} disabled={baseDisabled||!!s.room.activeRunId} onChange={e=>void act('cue',{cue:e.target.value})}>{allCues.map(c=><option key={c.cue.id} value={c.cue.id}>{c.cue.id} {c.cue.title}</option>)}</select></label><a href={`/api/rooms/${s.room.code}/export`} className="text-link">ดาวน์โหลดผลและประวัติ JSON</a></details>
 </section><aside className="join-section"><h2>ชวนผู้เล่นเข้าห้อง</h2>{!s.room.teamLocked?<><img className="join-qr" src={`/api/rooms/${s.room.code}/qr`} alt={`QR เข้าห้อง ${s.room.code}`}/><strong className="room-code">{s.room.code}</strong><p>สแกนแล้วกรอกชื่อเล่นและเลือกกลุ่ม</p></>:<p className="waiting-note">ล็อกทีมแล้ว QR ถูกซ่อน<br/>ผู้มาช้าใช้ลิงก์เดิมและรอรอบถัดไป</p>}<label htmlFor="player-link">ลิงก์สำหรับผู้เล่น</label><input id="player-link" value={link} onChange={e=>setLink(e.target.value)} onFocus={e=>e.target.select()}/><button className="secondary" onClick={()=>void copy()}>คัดลอกลิงก์</button><p className="field-help">ทดสอบมือถือ: เปิดหน้าผู้จัดผ่าน IP เครื่องบน Wi-Fi เดียวกันก่อนสแกน QR</p></aside></div>
 {s.scores?<Scores scores={s.scores} confirmed={finished}/>:s.confirmedScores?<Scores scores={s.confirmedScores} confirmed/>:null}
 <section className="room-members"><h2>กลุ่มและความพร้อม</h2><div className="group-roster-grid">{s.groups.map(g=><div key={g.id} className="roster-column"><h3>{g.name}<small>{g.members} คน</small></h3><ul>{s.host?.members.filter(m=>m.groupId===g.id).map(m=><li key={m.id}><span>{m.nickname}<small>{m.id.slice(0,4)} · {sideName(m.side)}</small></span><span>{m.online?'ออนไลน์':'ขาดการเชื่อมต่อ'}<small>{m.ready?'พร้อม':'ยังไม่พร้อม'}</small></span></li>)}</ul>{!g.members?<p>ยังไม่มีสมาชิก</p>:null}<details><summary>แก้ชื่อกลุ่ม / ย้ายสมาชิก</summary><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void act('rename',{groupId:g.id,name:String(f.get('name')).trim()});}}><label>ชื่อกลุ่ม<input name="name" defaultValue={g.name} maxLength={32} required/></label><button className="quiet" disabled={baseDisabled}>บันทึกชื่อ</button></form>{s.host?.members.filter(m=>m.groupId===g.id).map(m=><label key={m.id}>{m.nickname}<select value={g.id} disabled={baseDisabled||!reason.trim()} onChange={e=>void act('move',{memberId:m.id,groupId:Number(e.target.value),reason:reason.trim()})}>{s.groups.map(to=><option key={to.id} value={to.id}>{to.name}</option>)}</select></label>)}<p>ย้ายกลุ่มต้องใส่เหตุผลในจัดการรอบ มีผลเกมถัดไป</p></details></div>)}</div></section>
 <p className="discussion">คำถามชวนคุย: คุณเลือกเพราะประสบการณ์ หลักฐาน หรือความคุ้นเคย แล้วจะไว้ใจฝั่งเดิมในงานศิลปะด้วยไหม?</p></main>;
}

function Display({room}:{room:ReturnType<typeof useRoom>}){
 const s=room.snapshot!,r=s.run,now=useTicker(room.now);
 const cue=allCues.find(c=>c.cue.id===s.room.cue);const chapter=chapters.findIndex(ch=>ch.cues.some(c=>c.id===s.room.cue));const beat=chapter<0?0:chapters[chapter].cues.findIndex(c=>c.id===s.room.cue);
 if(s.room.cue!=='02.01'&&cue)return <div className="synced-deck"><iframe title={`สไลด์ ${s.room.cue}`} src={`/?scene=${chapter}&cue=${beat}&clean=1`}/>{s.room.cue==='01.02'&&!s.room.teamLocked?<section className="join-slide-card" aria-label="QR สำหรับเข้าร่วมกิจกรรม"><div className="join-slide-copy"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 18V6h12M30 6h12v12M42 30v12H30M18 42H6V30"/><path d="M13 13h7v7h-7zm15 0h7v7h-7zM13 28h7v7h-7zm15 0h3v3h-3zm5 5h4v4h-4z"/></svg><div><strong>สแกนครั้งเดียว</strong><span>ชื่อเล่น · เลือกกลุ่ม</span></div></div><img src={`/api/rooms/${s.room.code}/qr`} alt={`QR เข้าร่วมห้อง ${s.room.code}`}/><b className="join-slide-code">{s.room.code}</b><small>มือถือจะรอจนถึงคิวเกม</small></section>:null}<span className="display-connection">ห้อง {s.room.code} · {room.apiOnline?'เชื่อมต่อแล้ว':'กำลังเชื่อมต่อใหม่'}</span></div>;
 const result=r&&['RESULT','COMPLETED'].includes(r.status);
 return <main className="display-main"><div className="display-heading"><h1>Trust Tug-of-War</h1><Time s={s} now={now}/></div><h2>{result?'แรงของความไว้ใจ':r?.paused?'พักเกม รอผู้จัดเล่นต่อ':r?.status==='RUNNING'?r.phase==='COUNTDOWN'?'เตรียมตัว…':'ดึงให้ฝั่งที่คุณไว้ใจ!':'ตอนนี้ไว้ใจ Human หรือ AI มากกว่า?'}</h2><Arena s={s}/>{result&&s.scores?<><Scores scores={s.scores} confirmed={r.status==='COMPLETED'}/><p className="display-caption">ผล Human / AI ไม่มีโบนัสคะแนน · รอผู้จัดกด “จบเกม / ไปต่อ”</p></>:r?.status==='CANCELLED'?<p className="display-caption">ยกเลิก / ไม่นับคะแนน</p>:<div className="display-lobby"><p>{s.room.practiceUntil&&now<s.room.practiceUntil?`ช่วงทดลอง เหลือ ${Math.ceil((s.room.practiceUntil-now)/1000)} วินาที · ไม่คิดคะแนน`:'แตะครั้งละหนึ่งที · เล่น 10 วินาที · แตะได้ไม่จำกัด'}</p>{!s.room.teamLocked?<div className="display-join"><img src={`/api/rooms/${s.room.code}/qr`} alt="QR เข้าร่วมเกม"/><div><span>เข้าร่วมเกม</span><strong>{s.room.code}</strong><p>เลือกชื่อเล่นและกลุ่ม 1–8</p></div></div>:null}<div className="display-groups">{s.groups.map(g=><span key={g.id}>{g.name}<b>{g.members} คน</b></span>)}</div></div>}</main>;
}

const emptySwipe:SwipeSnapshot={contentVersion:'swipe-court-v1',assets:[],round:0,rounds:8,currentImageId:null,answered:0,rosterCount:0,myChoice:null,revealed:false,reveals:[],myAnswers:[]};
function useSwipeImages(game:SwipeSnapshot){
 const key=game.assets.map(x=>x.id+':'+x.path).join('|');
 const [loaded,setLoaded]=useState<Set<string>>(()=>new Set()),[failed,setFailed]=useState<Set<string>>(()=>new Set());
 useEffect(()=>{
  let cancelled=false;setLoaded(new Set());setFailed(new Set());
  const preload=async()=>{
   const outcomes=await Promise.all(game.assets.map(async asset=>{
    const image=new Image();image.src=asset.path;
    try{if(typeof image.decode==='function')await image.decode();else await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('IMAGE_LOAD_FAILED'));});return {id:asset.id,ok:true};}
    catch{return {id:asset.id,ok:false};}
   }));
   if(cancelled)return;setLoaded(new Set(outcomes.filter(x=>x.ok).map(x=>x.id)));setFailed(new Set(outcomes.filter(x=>!x.ok).map(x=>x.id)));
  };void preload();return()=>{cancelled=true;};
 },[key]);
 return {loaded,failed,ready:game.assets.length>0&&loaded.size===game.assets.length};
}
function SwipeClock({s,now}:{s:Snapshot;now:number}){
 const r=s.run;if(!r||r.gameId!=='ai-or-human'||r.status!=='RUNNING')return null;
 const ms=r.paused?r.remainingMs??0:Math.max(0,(r.deadline??now)-now);
 return <div className="swipe-clock" role="timer" aria-label={`เหลือ ${Math.ceil(ms/1000)} วินาที`}><span>{r.paused?'พักเกม':r.phase==='COUNTDOWN'?'เริ่มใน':'เวลาภาพนี้'}</span><strong>{r.phase==='COUNTDOWN'?Math.ceil(ms/1000):(ms/1000).toFixed(1)}<small>วิ</small></strong></div>;
}
function SwipeChoiceRails({disabled,onChoose,selected}:{disabled:boolean;onChoose:(choice:'HUMAN'|'AI')=>void;selected?:'HUMAN'|'AI'|null}){
 return <div className="swipe-choice-rails" aria-label="เลือกที่มาของภาพ"><button type="button" className={`swipe-choice human ${selected==='HUMAN'?'selected':''}`} disabled={disabled} onClick={()=>onChoose('HUMAN')}><span aria-hidden="true" className="swipe-arrow">←</span><strong>มนุษย์</strong><small>กดหรือปัดซ้าย</small></button><button type="button" className={`swipe-choice ai ${selected==='AI'?'selected':''}`} disabled={disabled} onClick={()=>onChoose('AI')}><strong>AI</strong><small>กดหรือปัดขวา</small><span aria-hidden="true" className="swipe-arrow">→</span></button></div>;
}
function SwipeScoreboard({scores,confirmed=false}:{scores:GroupScore[];confirmed?:boolean}){
 const ordered=[...scores].sort((a,b)=>(b.denominator?b.numerator/b.denominator:0)-(a.denominator?a.numerator/a.denominator:0)||a.id-b.id);
 return <section className="swipe-scoreboard"><h2>{confirmed?'คะแนนที่ยืนยันแล้ว':'คะแนนเฉลี่ยแต่ละกลุ่ม'}</h2><p>ตอบถูกภาพละ 100 คะแนน แล้วหารด้วยสมาชิกใน roster ตอนเริ่มเกม</p><ol>{ordered.map((g,i)=><li key={g.id}><span className="swipe-rank">{i+1}</span><span>{g.name}<small>สมาชิกใน roster {g.denominator} คน</small></span><strong>{g.denominator?(g.numerator/g.denominator).toFixed(2):'0.00'}<small> / 800</small></strong></li>)}</ol></section>;
}
function percent(human:number,answered:number){return answered>0?Math.round(100*human/answered):null;}
function SwipeRevealItem({item,ownAnswer,showOwnAnswer=false,showGroups=true,compact=false}:{item:SwipeReveal;ownAnswer?:{choice:'HUMAN'|'AI';correct:boolean};showOwnAnswer?:boolean;showGroups?:boolean;compact?:boolean}){
 const humanRate=percent(item.humanVotes,item.answered),aiRate=humanRate===null?null:100-humanRate,correctRate=percent(item.correctVotes,item.answered);
 return <article className="swipe-reveal-item">
  <div className="swipe-reveal-image"><img src={item.path} alt={`ภาพรอบ ${item.round}`} loading="eager"/></div>
  <div className="swipe-reveal-copy"><h3>ภาพรอบ {item.round}</h3><p className="swipe-source-line">{item.revealText}</p>
   {compact?<details className="swipe-source-details"><summary>ที่มาและสิทธิ์ภาพ</summary><p className="swipe-provenance">{item.provenance} · {item.license} · <a href={item.sourceUrl} target="_blank" rel="noreferrer">เปิดแหล่งที่มา</a></p></details>:<p className="swipe-provenance">{item.provenance} · {item.license} · <a href={item.sourceUrl} target="_blank" rel="noreferrer">เปิดแหล่งที่มา</a></p>}
   {item.generationPrompt?<details><summary>บันทึก brief ภาพ AI</summary><p>{item.generationPrompt}</p></details>:null}
   <div className="swipe-vote-stats" aria-label={`มีคำตอบ ${item.answered} คน`}><span>ตอบมนุษย์ <b>{humanRate===null?'—':`${humanRate}%`}</b><small>{item.humanVotes} คน</small></span><span>ตอบ AI <b>{aiRate===null?'—':`${aiRate}%`}</b><small>{item.aiVotes} คน</small></span><span>ตอบถูก <b>{correctRate===null?'—':`${correctRate}%`}</b><small>{item.correctVotes}/{item.answered} คน</small></span></div>
   {showOwnAnswer?<p className="swipe-own-answer">{ownAnswer?`คำตอบของคุณ: ${ownAnswer.choice==='HUMAN'?'มนุษย์':'AI'} · ${ownAnswer.correct?'ถูก +100':'ไม่ถูก +0'}`:'คุณไม่ได้ส่งคำตอบภาพนี้ · +0'}</p>:null}
   {showGroups?<details className="swipe-group-votes"><summary>ดูคำตอบแยกตามกลุ่ม</summary><div>{item.groupVotes.map(g=><span key={g.groupId}><strong>{g.groupName}</strong><small>มนุษย์ {g.human} · AI {g.ai} · ถูก {g.correct}</small></span>)}</div></details>:null}
  </div>
 </article>;
}
function SwipeRevealSequence({game,now,ownAnswers=false}:{game:SwipeSnapshot;now:number;ownAnswers:boolean}){
 if(!game.revealed||!game.reveals.length)return null;
 const elapsed=Math.max(0,now-(game.revealStartedAt??now)),summary=elapsed>=24000;
 const visible=summary?game.reveals:game.reveals.slice(0,Math.min(8,Math.floor(elapsed/3000)+1));
 const own=new Map(game.myAnswers.map(x=>[x.imageId,x]));
 return <section className={`swipe-reveal-sequence ${summary?'summary':''}`} aria-live="polite">
  <h2>{summary?'สรุปคำตอบทั้ง 8 ภาพ':`เฉลยภาพ ${visible.length} จาก 8`}</h2>
  {visible.map(item=><SwipeRevealItem key={item.imageId} item={item} ownAnswer={ownAnswers?own.get(item.imageId):undefined} showOwnAnswer={ownAnswers} compact={summary}/>) }
 </section>;
}
function SwipeDisplaySummary({game}:{game:SwipeSnapshot}){
 return <section className="swipe-projection-summary"><h2>เฉลยและที่มาครบทั้ง 8 ภาพ</h2><div className="swipe-projection-grid">{game.reveals.map(item=>{
  const humanRate=percent(item.humanVotes,item.answered),aiRate=humanRate===null?null:100-humanRate,correctRate=percent(item.correctVotes,item.answered);
  return <article className="swipe-projection-tile" key={item.imageId}><div className="swipe-projection-thumb"><img src={item.path} alt={`ภาพรอบ ${item.round}`} loading="eager"/></div><div className="swipe-projection-copy"><strong>ภาพ {item.round} · {item.classification==='HUMAN'?'มนุษย์':'AI'}</strong><span>{item.revealText.replace(/^(มนุษย์|AI) · /,'')}</span><small>{humanRate===null?'ไม่มีคำตอบ':`มนุษย์ ${humanRate}% · AI ${aiRate}%`} · ถูก {correctRate===null?'—':`${correctRate}%`} ({item.correctVotes}/{item.answered})</small><small>{item.creator} · {item.license} · <a href={item.sourceUrl} target="_blank" rel="noreferrer">ที่มา</a></small><details><summary>รายละเอียดแหล่งภาพและกลุ่ม</summary><p>{item.provenance}</p><div>{item.groupVotes.map(g=><span key={g.groupId}>{g.groupName}: มนุษย์ {g.human} · AI {g.ai} · ถูก {g.correct}</span>)}</div>{item.generationPrompt?<p>Brief: {item.generationPrompt}</p>:null}</details></div></article>;
 })}</div></section>;
}

function SwipePlayer({room}:{room:ReturnType<typeof useRoom>}){
 const s=room.snapshot!,me=s.me!,r=s.run,game=s.swipe??emptySwipe,{loaded,failed,ready:imagesReady}=useSwipeImages(game);
 const now=useTicker(room.now),asset=game.assets.find(x=>x.id===game.currentImageId),imageReady=!!asset&&loaded.has(asset.id);
 const [message,setMessage]=useState(''),[posting,setPosting]=useState(false),[dragX,setDragX]=useState(0),[exitSide,setExitSide]=useState<'human'|'ai'|''>(''),[localChoice,setLocalChoice]=useState<{imageId:string;choice:'HUMAN'|'AI'}|null>(null);
 const drag=useRef<{pointerId:number;x:number;y:number}|null>(null);
 useEffect(()=>{if(s.room.cue!=='03.05'||s.room.activeRunId||me.ready||!room.apiOnline||!imagesReady)return;let cancelled=false;
  const markReady=async()=>{try{await command(s.room.code,'player','ready',{previewId:s.room.previewId,contentVersion:game.contentVersion});if(!cancelled)await room.refresh();}catch(e){if(!cancelled&&(!(e instanceof Error)||!('code' in e)||(e as {code:string}).code!=='PREVIEW_CLOSED'))setMessage(e instanceof Error?e.message:'ยืนยันความพร้อมไม่ได้');}};
  void markReady();return()=>{cancelled=true;};
 },[s.room.cue,s.room.activeRunId,s.room.previewId,me.ready,room.apiOnline,imagesReady,game.contentVersion,room.refresh,s.room.code]);
 useEffect(()=>{setDragX(0);setExitSide('');if(localChoice&&localChoice.imageId!==game.currentImageId)setLocalChoice(null);},[game.currentImageId]);
 const runActive=r?.gameId==='ai-or-human'&&r.status==='RUNNING',answering=runActive&&r.phase==='ANSWERING';
 const chosen=game.myChoice??(localChoice?.imageId===game.currentImageId?localChoice.choice:null);
 const ms=r?.paused?r.remainingMs??0:Math.max(0,(r?.deadline??now)-now);
 const canAnswer=!!answering&&!r?.paused&&!!asset&&imageReady&&!chosen&&!posting&&room.apiOnline&&room.isFresh()&&ms>0;
 const revealSummary=game.revealed&&now-(game.revealStartedAt??now)>=24000;
 const answer=async(choice:'HUMAN'|'AI')=>{
  if(!canAnswer||!r||!game.currentImageId)return;setPosting(true);setMessage('');
  try{const receipt=await command<{accepted:boolean;duplicate:boolean;imageId:string;choice:'HUMAN'|'AI'}>(s.room.code,'player','answer',{runId:r.id,phaseToken:r.phaseToken,imageId:game.currentImageId,choice});
   if(receipt.accepted){setLocalChoice({imageId:receipt.imageId,choice:receipt.choice});setExitSide(receipt.choice==='HUMAN'?'human':'ai');await room.refresh();}
  }catch(e){setMessage(e instanceof Error?e.message:'ส่งคำตอบไม่สำเร็จ');void room.refresh();}finally{setPosting(false);}
 };
 const pointerDown=(e:React.PointerEvent<HTMLDivElement>)=>{if(!canAnswer||e.button!==0)return;drag.current={pointerId:e.pointerId,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);};
 const pointerMove=(e:React.PointerEvent<HTMLDivElement>)=>{if(drag.current?.pointerId===e.pointerId)setDragX(Math.max(-130,Math.min(130,e.clientX-drag.current.x)));};
 const pointerUp=(e:React.PointerEvent<HTMLDivElement>)=>{const current=drag.current;if(!current||current.pointerId!==e.pointerId)return;drag.current=null;const dx=e.clientX-current.x,dy=e.clientY-current.y,width=e.currentTarget.getBoundingClientRect().width,threshold=Math.max(48,Math.min(96,width*.2));setDragX(0);if(Math.abs(dx)>=threshold&&Math.abs(dx)>Math.abs(dy))void answer(dx<0?'HUMAN':'AI');};
 const playerScore=game.myAnswers.filter(x=>x.correct).length*100;
 return <main className="swipe-player-main">
  <div className="swipe-player-heading"><div><h1>Swipe Court</h1><p>ดูภาพ แล้วเลือกว่ามนุษย์หรือ AI เป็นผู้สร้าง</p></div><SwipeClock s={s} now={now}/></div>
  <div className="swipe-rule-strip" aria-label="กติกา"><span><b>← ซ้าย</b> มนุษย์</span><span className="rule-divider" aria-hidden="true"/><span><b>ขวา →</b> AI</span></div>
  {s.room.cue==='03.05'&&!runActive&&!game.revealed?<section className="swipe-ready-state"><h2>ภาพพร้อม {loaded.size}/{game.assets.length || 8}</h2><p>{imagesReady?'โหลดและถอดรหัสครบแล้ว รอผู้จัดเริ่มเกม':'กำลังโหลดและถอดรหัสภาพทั้ง 8 ใบ'}</p>{failed.size?<p role="alert" className="input-message">โหลดภาพไม่สำเร็จ {failed.size} ใบ ตรวจเครือข่ายแล้วกดรีเฟรชเพื่อเตรียมใหม่</p>:null}<div className="swipe-ready-bar" role="progressbar" aria-label="ภาพที่โหลดแล้ว" aria-valuemin={0} aria-valuemax={8} aria-valuenow={loaded.size}><span style={{transform:`scaleX(${Math.min(1,loaded.size/8)})`}}/></div>{!me.ready&&imagesReady?<p className="swipe-ready-copy">กำลังส่งสถานะพร้อมไปยังผู้จัด…</p>:<p className="swipe-ready-copy">{me.ready?'พร้อมเล่นแล้ว':'รอเข้าคิว Swipe Court · เข้าร่วมกลุ่มได้ก่อนล็อก roster'}</p>}</section>:null}
  {runActive&&r?.phase==='COUNTDOWN'?<section className="swipe-ready-state"><h2>เตรียมเลือกภาพ</h2><p>ภาพแรกกำลังจะเริ่ม ทุกคนใช้เวลารอบเดียวกัน</p><div className="swipe-round-count">เริ่มใน <strong>{Math.ceil(ms/1000)}</strong></div></section>:null}
  {answering&&asset?<section className="swipe-play-area"><div className="swipe-round-heading"><h2>ภาพที่ {game.round} <span>จาก 8</span></h2><span className="swipe-answer-count">ตอบแล้ว {game.answered}/{game.rosterCount}</span></div>
   <div className="swipe-answer-layout"><div className="swipe-rail-label human-rail"><strong>มนุษย์</strong><span>←</span></div><div className={`swipe-image-card ${exitSide?`exit-${exitSide}`:''} ${imageReady?'loaded':''}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>{drag.current=null;setDragX(0);}} style={{transform:exitSide?undefined:`translateX(${dragX}px) rotate(${dragX*.025}deg)`}} aria-label={`ลากภาพรอบ ${game.round} ไปทางซ้ายเพื่อเลือกมนุษย์ หรือทางขวาเพื่อเลือก AI`}>
    {imageReady?<img src={asset.path} alt={`ภาพปริศนารอบ ${game.round}`} draggable={false}/>:<div className="swipe-image-loading" role="status">ภาพรอบนี้ยังโหลดไม่เสร็จ<br/><small>เวลารอบยังเดินตามเดิม</small></div>}
    {chosen?<div className="swipe-choice-locked" aria-live="polite"><strong>รับคำตอบแล้ว</strong><span>คุณเลือก {chosen==='HUMAN'?'มนุษย์':'AI'} · รอภาพถัดไป</span></div>:null}
   </div><div className="swipe-rail-label ai-rail"><strong>AI</strong><span>→</span></div></div>
   <SwipeChoiceRails disabled={!canAnswer} onChoose={answer} selected={chosen}/>
   <p className="swipe-no-feedback">คำตอบถูกล็อกครั้งแรก · ยังไม่แสดงคะแนนหรือเฉลยระหว่างเล่น</p>
  </section>:null}
  {game.revealed&&r?.gameId==='ai-or-human'?<section className="swipe-player-result"><div className="swipe-personal-score"><span>คะแนนของคุณ</span><strong>{playerScore}<small> / 800</small></strong><p>คำตอบถูก {game.myAnswers.filter(x=>x.correct).length} จาก {game.myAnswers.length} ภาพ · ไม่ตอบได้ 0 คะแนน</p></div><SwipeRevealSequence game={game} now={now} ownAnswers/>{revealSummary?<SwipeScoreboard scores={s.scores??[]} confirmed={r.status==='COMPLETED'}/>:null}{r.status==='RESULT'?<p className="swipe-waiting">รอผู้จัดตรวจสรุปและกดจบเกม</p>:<p className="swipe-waiting">คะแนนได้รับการยืนยันแล้ว · รอผู้จัดเปลี่ยนคิวเกม</p>}</section>:null}
  {r?.gameId==='ai-or-human'&&r.status==='CANCELLED'?<div className="waiting-note"><h2>เกมยกเลิก / ไม่นับคะแนน</h2><p>รอผู้จัดเริ่มรอบใหม่</p></div>:null}
  {!runActive&&!game.revealed&&r?.status!=='CANCELLED'&&s.room.cue!=='03.05'?<div className="waiting-note"><h2>รอเกม Swipe Court</h2><p>ผู้จัดเปลี่ยนคิวมาที่ 03.05 เพื่อเริ่มเกมนี้</p></div>:null}
  <details className="swipe-player-settings"><summary>ข้อมูลกลุ่มและออกจากห้อง</summary><p>กลุ่มปัจจุบัน: {s.groups.find(g=>g.id===me.groupId)?.name}</p>{!s.room.teamLocked?<label>เปลี่ยนกลุ่ม<select value={me.groupId} onChange={e=>{void command(s.room.code,'player','group',{groupId:Number(e.target.value)}).then(room.refresh).catch(e=>setMessage(e.message));}}>{s.groups.map(g=><option key={g.id} value={g.id}>{g.name} ({g.members} คน)</option>)}</select></label>:<p>กลุ่มถูกล็อกแล้ว ผู้จัดย้ายให้ได้สำหรับเกมถัดไป</p>}<button className="quiet danger" onClick={()=>{void command(s.room.code,'player','leave',{}).then(()=>location.assign('/games')).catch(e=>setMessage(e.message));}}>ออกจากห้อง</button></details>
  {message?<p className="input-message" role="status">{message}</p>:null}
 </main>;
}

function SwipeDisplay({room}:{room:ReturnType<typeof useRoom>}){
 const s=room.snapshot!,r=s.run,game=s.swipe??emptySwipe,now=useTicker(room.now),asset=game.assets.find(x=>x.id===game.currentImageId);
 const elapsed=Math.max(0,now-(game.revealStartedAt??now)),summary=game.revealed&&elapsed>=24000;
 const reveal=game.reveals[Math.min(7,Math.floor(elapsed/3000))];
 const aggregateAnswered=game.reveals.reduce((n,x)=>n+x.answered,0),aggregateCorrect=game.reveals.reduce((n,x)=>n+x.correctVotes,0);
 return <main className="swipe-display-main"><div className="swipe-display-heading"><h1>Swipe Court</h1><span>ห้อง {s.room.code}</span></div>
  <div className="swipe-rule-strip"><span><b>← ซ้าย</b> มนุษย์</span><span className="rule-divider" aria-hidden="true"/><span><b>ขวา →</b> AI</span></div>
  {!game.revealed?<><div className="swipe-display-status"><h2>{r?.status==='RUNNING'?r.phase==='COUNTDOWN'?'เตรียมภาพแรก':r.paused?'พักเกม รอผู้จัดเล่นต่อ':`ภาพที่ ${game.round} จาก 8`:'รอผู้จัดเริ่มเกม'}</h2><SwipeClock s={s} now={now}/></div>{asset?<div className="swipe-display-card"><img src={asset.path} alt={`ภาพปริศนารอบ ${game.round}`}/></div>:<div className="swipe-display-placeholder"><p>{r?.phase==='COUNTDOWN'?'อีกสักครู่ภาพแรกจะขึ้นที่นี่':'เมื่อผู้จัดเริ่มเกม ภาพจะปรากฏพร้อมกันทุกเครื่อง'}</p></div>}<p className="swipe-display-votes">{r?.status==='RUNNING'&&r.phase==='ANSWERING'?`ตอบแล้ว ${game.answered} / ${game.rosterCount} คน`:'ยังไม่แสดงเฉลยหรือคะแนน'}</p></>:<section className="swipe-display-reveal"><div className="swipe-display-status"><h2>{summary?'สรุปครบทั้ง 8 ภาพ':`เฉลยภาพ ${reveal?.round??0} จาก 8`}</h2><span>เหลือเวลาเฉลย {Math.ceil(Math.max(0,(game.revealDeadline??now)-now)/1000)} วินาที</span></div>
   {summary?<><div className="swipe-display-global-stat"><span>คำตอบทั้งหมด <b>{aggregateAnswered}</b></span><span>ตอบถูก <b>{aggregateCorrect}</b></span><span>ความแม่นยำ <b>{aggregateAnswered?`${Math.round(100*aggregateCorrect/aggregateAnswered)}%`:'—'}</b></span></div><SwipeDisplaySummary game={game}/>{s.scores?<SwipeScoreboard scores={s.scores} confirmed={r?.status==='COMPLETED'}/>:null}</>:reveal?<SwipeRevealItem item={reveal} showGroups={false}/>:null}
  </section>}
 </main>;
}

function SwipeHost({room}:{room:ReturnType<typeof useRoom>}){
 const s=room.snapshot!,r=s.run,game=s.swipe??emptySwipe,controller=useRef(tabIdentity('controller'));
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[reason,setReason]=useState(''),[link,setLink]=useState(`${location.origin}/play/${s.room.code}`);
 const now=useTicker(room.now),hasControl=s.host?.controllerId===controller.current&&(s.host?.leaseUntil??0)>now;
 const acquire=useCallback(async(takeover=false)=>{try{await command(s.room.code,'host','acquire',{controllerId:controller.current,...(takeover?{reason:reason.trim()}: {})});await room.refresh();setMessage('');}catch(e){setMessage(e instanceof Error?e.message:'รับสิทธิ์ไม่ได้');}},[s.room.code,room.refresh,reason]);
 useEffect(()=>{if(s.host&&!s.host.controllerId)void acquire();},[s.host?.controllerId,acquire]);
 useEffect(()=>{if(!hasControl)return;const timer=setInterval(()=>{const cur=room.latest.current;if(cur?.host)void command(s.room.code,'host','heartbeat',{controllerId:controller.current,controllerEpoch:cur.host.controllerEpoch}).catch(()=>void room.refresh());},5000);return()=>clearInterval(timer);},[hasControl,s.room.code,room.latest,room.refresh]);
 const act=async(kind:string,payload:Record<string,unknown>={})=>{setBusy(true);setMessage('');const cur=room.latest.current!;try{const result=await command(s.room.code,'host',kind,{...payload,controllerId:controller.current,controllerEpoch:cur.host!.controllerEpoch,expectedVersion:cur.room.version});await room.refresh();if(kind==='start'&&Number(result.unready)>0)setMessage(`เริ่มแล้ว มีผู้เล่นยังโหลดภาพไม่ครบ ${result.unready} คน`);else if(['cancel','replay'].includes(kind))setReason('');}catch(e){setMessage(e instanceof Error?e.message:'ติดต่อระบบไม่ได้');void room.refresh();}finally{setBusy(false);}};
 const baseDisabled=busy||!hasControl||!room.apiOnline,active=r?.gameId==='ai-or-human'&&r.status==='RUNNING',result=r?.gameId==='ai-or-human'&&r.status==='RESULT',finished=r?.gameId==='ai-or-human'&&r.status==='COMPLETED';
 const sameGameCompleted=r?.gameId==='ai-or-human'&&r.status==='COMPLETED',canStart=!s.room.activeRunId&&s.room.cue==='03.05'&&!sameGameCompleted;
 const finishAt=game.revealDeadline??r?.deadline??Infinity,canFinish=!!result&&now>=finishAt;
 const elapsed=Math.max(0,now-(game.revealStartedAt??now)),summary=game.revealed&&elapsed>=24000,reveal=game.reveals[Math.min(7,Math.floor(elapsed/3000))];
 const copy=async()=>{try{await navigator.clipboard.writeText(link);setMessage('คัดลอกลิงก์ผู้เล่นแล้ว');}catch{setMessage('เลือกข้อความในช่องลิงก์ แล้วคัดลอกได้เลย');}};
 return <main className="host-main swipe-host-main"><div className="host-heading"><div><h1>Swipe Court</h1><p>คิว {s.room.cue} · {r?`รอบ ${r.id.slice(0,8)}`:'เตรียมห้อง'} · ผู้เล่น {s.groups.reduce((v,g)=>v+g.members,0)}/{s.room.capacity} คน</p></div><a className="secondary button-link" href={`/display/${s.room.code}`} target="_blank" rel="noreferrer">เปิดจอฉาย</a></div>
  <div className="host-grid"><section className="control-section"><div className="section-heading"><h2>{active?r?.paused?'พักเกม':r?.phase==='COUNTDOWN'?'กำลังนับถอยหลัง':`ภาพที่ ${game.round} จาก 8`:result?'ตรวจเฉลยและสถิติ':finished?'คะแนนได้รับการยืนยัน':s.room.cue==='03.05'?'พร้อมเริ่ม Swipe Court':'เปลี่ยนคิวเพื่อเริ่มเกม'}</h2><SwipeClock s={s} now={now}/></div>
   {active&&game.currentImageId?<><p className="swipe-answer-count host-answer-count">ภาพรอบนี้ตอบแล้ว {game.answered}/{game.rosterCount} คน · เฉลยยังซ่อนอยู่</p><div className="swipe-host-card">{game.assets.find(x=>x.id===game.currentImageId)?<img src={game.assets.find(x=>x.id===game.currentImageId)!.path} alt={`ภาพรอบ ${game.round}`}/>:null}</div></>:null}
   {!hasControl?<div className="control-notice"><p>{s.host?.leaseUntil&&s.host.leaseUntil>now?'มีอีกแท็บควบคุมอยู่ ใส่เหตุผลด้านล่างเพื่อรับช่วงต่อ':'ยังไม่มีสิทธิ์ควบคุมห้อง'}</p><button className="secondary" disabled={busy||(!!s.host?.leaseUntil&&s.host.leaseUntil>now&&!reason.trim())} onClick={()=>void acquire(!!s.host?.leaseUntil&&s.host.leaseUntil>now)}>รับสิทธิ์ควบคุม</button></div>:null}
   <div className="host-controls">{!active&&!result&&!sameGameCompleted&&s.room.cue==='03.05'?<button className="primary" disabled={baseDisabled||!canStart} onClick={()=>void act('start',{timingProfile:'normal'})}>เริ่ม 8 ภาพ</button>:null}{active?<button className="primary" disabled={baseDisabled} onClick={()=>void act(r!.paused?'resume':'pause')}>{r?.paused?'เล่นต่อ':'พักเกม'}</button>:null}{result?<button className="primary finish-button" disabled={baseDisabled||!canFinish} onClick={()=>void act('finish',{inputDigest:s.host!.inputDigest})}>{canFinish?'ยืนยันผล / ไปคิว 03.03':`รออีก ${Math.ceil(Math.max(0,finishAt-now)/1000)} วินาที`}</button>:null}</div>
   {result?<p>เฉลยไล่ภาพละ 3 วินาที; ปุ่มยืนยันจะเปิดหลังช่วงสรุปครบ 30 วินาที ผู้จัดเป็นผู้จบเกมเอง</p>:active?<p>8 ภาพ · ภาพละ 4 วินาที · คำตอบแรกของแต่ละคนถูกล็อก</p>:!sameGameCompleted?<p className="readiness">พร้อม {s.groups.reduce((v,g)=>v+g.members,0)-(s.host?.unready??0)} คน · ยังไม่พร้อม {s.host?.unready??0} คน<br/>เริ่มได้แม้มีคนยังโหลดไม่ครบ แต่เครื่องนั้นจะตอบไม่ได้จนภาพแสดงได้</p>:null}
   {message?<p className="input-message" role="status">{message}</p>:null}
   {game.revealed&&r?.gameId==='ai-or-human'?<>{summary?<SwipeRevealSequence game={game} now={now} ownAnswers={false}/>:reveal?<SwipeRevealItem item={reveal} showGroups={false}/>:null}{summary&&s.scores?<SwipeScoreboard scores={s.scores} confirmed={finished}/>:null}</>:null}
   <details className="host-tools"><summary>จัดการรอบและเปลี่ยนคิว</summary><label htmlFor="swipe-reason">เหตุผลยกเลิก / เล่นใหม่ / รับช่วงควบคุม</label><input id="swipe-reason" value={reason} onChange={e=>setReason(e.target.value)} maxLength={200} placeholder="ใส่เหตุผลที่ตรวจสอบย้อนหลังได้"/><div className="tool-buttons"><button className="quiet danger" disabled={baseDisabled||!s.room.activeRunId||!reason.trim()} onClick={()=>void act('cancel',{reason:reason.trim()})}>ยกเลิก / ไม่นับคะแนน</button><button className="secondary" disabled={baseDisabled||!r||!reason.trim()} onClick={()=>void act('replay',{reason:reason.trim()})}>เล่นใหม่แทนรอบเดิม</button></div><label>คิวสไลด์<select value={s.room.cue} disabled={baseDisabled||!!s.room.activeRunId} onChange={e=>void act('cue',{cue:e.target.value})}>{allCues.map(c=><option key={c.cue.id} value={c.cue.id}>{c.cue.id} {c.cue.title}</option>)}</select></label><a href={`/api/rooms/${s.room.code}/export`} className="text-link">ดาวน์โหลดผลและประวัติ JSON</a></details>
  </section><aside className="join-section"><h2>ชวนผู้เล่นเข้าห้อง</h2>{!s.room.teamLocked?<><img className="join-qr" src={`/api/rooms/${s.room.code}/qr`} alt={`QR เข้าห้อง ${s.room.code}`}/><strong className="room-code">{s.room.code}</strong><p>สแกนแล้วกรอกชื่อเล่นและเลือกกลุ่ม</p></>:<p className="waiting-note">Roster รอบนี้ล็อกแล้ว<br/>ผู้มาช้าใช้ลิงก์เดิมและรอรอบถัดไป</p>}<label htmlFor="swipe-player-link">ลิงก์สำหรับผู้เล่น</label><input id="swipe-player-link" value={link} onChange={e=>setLink(e.target.value)} onFocus={e=>e.target.select()}/><button className="secondary" onClick={()=>void copy()}>คัดลอกลิงก์</button></aside></div>
  <section className="room-members"><h2>กลุ่มและความพร้อม</h2><div className="group-roster-grid">{s.groups.map(g=><div key={g.id} className="roster-column"><h3>{g.name}<small>{g.members} คน</small></h3><ul>{s.host?.members.filter(m=>m.groupId===g.id).map(m=><li key={m.id}><span>{m.nickname}<small>{m.id.slice(0,4)}</small></span><span>{m.online?'ออนไลน์':'ขาดการเชื่อมต่อ'}<small>{m.ready?'ภาพพร้อม':'ยังไม่พร้อม'}</small></span></li>)}</ul>{!g.members?<p>ยังไม่มีสมาชิก</p>:null}</div>)}</div></section>
 </main>;
}

export default function GameApp(){
 const route=location.pathname.match(/^\/(play|presenter|display)\/([a-f\d]{6})$/i);
 if(!route)return <Home/>;
 return <Room code={route[2].toUpperCase()} role={route[1]==='presenter'?'host':route[1]==='display'?'display':'player'}/>;
}
function Room({code,role}:{code:string;role:Role}){
 const room=useRoom(code,role);
 const selectedGameCue=room.snapshot?.room.cue;
 const pieceRoom=!!room.snapshot&&(selectedGameCue==='14.01'||(!['02.01','03.05','04.01','07.01','10.02','11.02'].includes(selectedGameCue!)&&room.snapshot.run?.gameId==='missing-piece'));
 const shieldRoom=!!room.snapshot&&(selectedGameCue==='11.02'||(!['02.01','03.05','04.01','07.01','10.02','14.01'].includes(selectedGameCue!)&&room.snapshot.run?.gameId==='company-shield'));
 const whackRoom=!!room.snapshot&&(selectedGameCue==='10.02'||(!['02.01','03.05','04.01','07.01','11.02'].includes(selectedGameCue!)&&room.snapshot.run?.gameId==='chat-whack-a-mole'));
 const rouletteRoom=!!room.snapshot&&(selectedGameCue==='07.01'||(!['02.01','03.05','04.01','10.02','11.02'].includes(selectedGameCue!)&&room.snapshot.run?.gameId==='confidence-roulette'));
 const captionRoom=!!room.snapshot&&(selectedGameCue==='04.01'||(!['02.01','03.05','07.01','10.02','11.02'].includes(selectedGameCue!)&&room.snapshot.run?.gameId==='caption-battle'));
 const swipeRoom=!!room.snapshot&&(selectedGameCue==='03.05'||(!['02.01','04.01','07.01','10.02','11.02'].includes(selectedGameCue!)&&room.snapshot.run?.gameId==='ai-or-human'));
  const waiting=role==='player'&&room.snapshot&&!['RUNNING','RESULT'].includes(room.snapshot.run?.status??'');
  const myGroup=room.snapshot?.me?room.snapshot.groups.find(g=>g.id===room.snapshot!.me!.groupId):undefined;
  return <div className={`game-page ${role}-page`}><Header code={code} role={role} online={room.apiOnline} realtime={room.realtime}/>{room.error?<div className="network-banner" role="status">{room.error} {role==='host'&&!room.snapshot?<a href="/games">เข้าสู่ระบบผู้จัด</a>:null}</div>:null}{room.needsJoin&&role==='player'?<Join code={code} onJoin={()=>void room.refresh()}/>:room.snapshot?waiting?<WaitingStage code={code} cue={room.snapshot.room.cue} nickname={room.snapshot.me?.nickname??'ผู้เล่น'} group={myGroup?.name??'สมาชิก'} groupSize={myGroup?.members??0} online={room.apiOnline}/>:role==='player'?pieceRoom?<PieceGame room={room}/>:shieldRoom?<ShieldGame room={room}/>:whackRoom?<WhackGame room={room}/>:rouletteRoom?<RouletteGame room={room}/>:captionRoom?<CaptionBattle room={room}/>:swipeRoom?<SwipePlayer room={room}/>:<Player room={room}/>:role==='host'?pieceRoom?<PieceGame room={room}/>:shieldRoom?<ShieldGame room={room}/>:whackRoom?<WhackGame room={room}/>:rouletteRoom?<RouletteGame room={room}/>:captionRoom?<CaptionBattle room={room}/>:swipeRoom?<SwipeHost room={room}/>:<Host room={room}/>:pieceRoom?<PieceGame room={room}/>:shieldRoom?<ShieldGame room={room}/>:whackRoom?<WhackGame room={room}/>:rouletteRoom?<RouletteGame room={room}/>:room.snapshot.room.cue==='04.01'?<CaptionBattle room={room}/>:room.snapshot.room.cue==='03.05'?<SwipeDisplay room={room}/>:<Display room={room}/>:<main className="loading-game"><h1>กำลังเข้าห้อง {code}</h1><p>กำลังขอสถานะล่าสุดจากระบบ</p><button className="secondary" onClick={()=>void room.refresh()}>ลองเชื่อมต่ออีกครั้ง</button><a href="/games">กลับหน้าเข้าห้อง</a></main>}</div>;
}

