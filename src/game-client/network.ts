import {useCallback,useEffect,useRef,useState} from 'react';
import type {Role,Snapshot} from '../shared/game-contracts';

export const errors:Record<string,string>={
 API_UNAVAILABLE:'เซิร์ฟเวอร์เกมยังไม่พร้อม กรุณาลองใหม่อีกครั้ง',SERVER_NOT_CONFIGURED:'การตั้งค่าเซิร์ฟเวอร์เกมยังไม่ครบ ตรวจ GAME_DATABASE_URL และ GAME_HOST_KEY ใน Vercel',DATABASE_UNAVAILABLE:'เริ่มฐานข้อมูลเกมไม่สำเร็จ ตรวจ GAME_DATABASE_URL และสิทธิ์เชื่อมต่อ Supabase',API_INITIALIZATION_FAILED:'เริ่ม API เกมไม่สำเร็จ ลองเปิด deployment ล่าสุดอีกครั้ง',
 CAPTION_TOO_LONG:'แคปชั่นเกิน 80 ตัวอักษรที่เห็น ลดข้อความแล้วส่งอีกครั้ง',CAPTION_FORMAT:'ใช้ข้อความธรรมดา ไม่ใส่ลิงก์หรือ markup',
 AI_REVIEW_REQUIRED:'ตรวจและอนุมัติโจทย์กับแคปชั่น AI ก่อนเริ่ม',STALE_REVIEW:'ข้อความหรือผลตรวจเปลี่ยนแล้ว ตรวจ revision ล่าสุดอีกครั้ง',
 REVIEW_PENDING:'ยังมีงานที่ต้องตรวจ ตรวจให้ครบก่อนเปิดโหวต',CANDIDATE_INVALID:'ผลงานนี้ไม่มีสิทธิ์ให้โหวตในช่วงนี้',OWN_GROUP:'รอบสุดท้ายโหวตกลุ่มตัวเองไม่ได้',
 UNAUTHORIZED:'เซสชันหมดอายุ กรุณาเข้าสู่ระบบหรือเข้าห้องใหม่อีกครั้ง',HOST_KEY_INVALID:'รหัสผู้จัดไม่ถูกต้อง ตรวจจากไฟล์ data/host-key.txt',STALE_IMAGE:'ภาพเปลี่ยนแล้ว คำตอบนี้ไม่ถูกบันทึก',CONTENT_MISSING:'ชุดภาพไม่ครบ ติดต่อผู้จัดให้ตรวจเกม',CONTENT_INVALID:'ชุดภาพเกมตรวจไม่ผ่าน ติดต่อผู้จัด',
 ROOM_NOT_FOUND:'ไม่พบห้องนี้ ตรวจรหัสห้องแล้วลองอีกครั้ง',NOT_A_MEMBER:'ยังไม่ได้เข้าร่วมห้อง',ROOM_FULL:'ห้องเต็มแล้ว สามารถเปิดจอชมเกมได้',
 INPUT_CLOSED:'หมดช่วงรับการแตะแล้ว',STALE_PHASE:'จังหวะเกมเปลี่ยนแล้ว กำลังอัปเดต',STALE_WRITER:'อีกแท็บรับสิทธิ์เล่นแล้ว',
 STALE_CONTROLLER:'สิทธิ์ควบคุมหมดอายุหรืออยู่ที่อีกแท็บ กดรับสิทธิ์ควบคุม',CONTROL_BUSY:'อีกแท็บกำลังควบคุมห้องอยู่',
 SIDE_UNSELECTED:'ยังไม่ได้เลือกฝั่งก่อนเริ่ม รอรอบถัดไป',NOT_IN_ROSTER:'เข้าหลังเริ่มเกม รอรอบถัดไป',
 STALE_VERSION:'สถานะห้องเปลี่ยนแล้ว ตรวจหน้าจอและลองอีกครั้ง',STALE_REVISION:'ฝั่งที่เลือกเปลี่ยนจากอีกแท็บแล้ว ลองใหม่',
 PREVIEW_CLOSED:'เริ่มเกมแล้ว เปลี่ยนฝั่งไม่ได้',PRACTICE_ACTIVE:'รอช่วงทดลอง 15 วินาทีจบก่อน',
 REASON_REQUIRED:'ใส่เหตุผลก่อนดำเนินการ',NAVIGATION_LOCKED:'ต้องจบเกมหรือยกเลิกก่อนเปลี่ยนสไลด์',
 GAME_NOT_FINISHABLE:'รอให้เกมจบก่อนยืนยันคะแนน',TEAMS_LOCKED:'ล็อกกลุ่มแล้ว ให้ผู้จัดย้ายกลุ่ม',
 REPLAY_REQUIRED:'เกมนี้มีผลเดิมแล้ว ใช้ปุ่มเล่นใหม่พร้อมเหตุผล',INVALID_REQUEST:'ข้อมูลคำสั่งไม่ตรงกับสถานะเกม โหลดสถานะล่าสุดแล้วลองอีกครั้ง',
 NETWORK:'ยังติดต่อระบบไม่ได้ กำลังเชื่อมต่อใหม่',SERVER_ERROR:'ระบบยังตอบไม่ได้ ลองใหม่ด้วยคำขอเดิม',
 IDEMPOTENCY_CONFLICT:'คำขอเดิมมีข้อมูลต่างกัน กรุณาโหลดสถานะล่าสุด',CONTENT_VERSION:'เนื้อหาเกมเปลี่ยนแล้ว รีเฟรชหน้านี้'
};
export class GameError extends Error {code:string;constructor(code:string){super(errors[code]??code);this.code=code;}}
async function restoreSession(role:Role):Promise<void>{if(role!=='host')await api('/session',role,{role});}
export function newId():string {
 // LAN rehearsal uses HTTP; randomUUID is restricted to secure contexts.
 const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export async function api<T>(path:string,role:Role,body?:unknown):Promise<T> {
 const r=await fetch(`/api${path}`,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:{'x-game-role':role,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(6000)});
 let data:{ok?:boolean;error?:string;data?:T};
 try{data=await r.json();}catch{throw new GameError('API_UNAVAILABLE');}
 if(data.ok===false)throw new GameError(data.error??'SERVER_ERROR');if(!r.ok)throw new GameError('SERVER_ERROR');return data.data??data as T;
}
export async function command<T=Record<string,unknown>>(code:string,role:Role,kind:string,payload:Record<string,unknown>,key=newId()):Promise<T>{
 // A transport failure retries the exact request, including key and phase fence.
 let last:unknown;
 for(let attempt=0;attempt<2;attempt++)try{return await api<T>(`/rooms/${code}/commands/${kind}`,role,{key,payload});}catch(e){if(e instanceof GameError&&e.code==='UNAUTHORIZED'&&role!=='host'&&attempt===0){await restoreSession(role);continue;}if(e instanceof GameError)throw e;last=e;}
 throw last;
}
export function tabIdentity(kind:string):string {
 const key=`trust-tug:${kind}:tab`;let id=sessionStorage.getItem(key);if(!id){id=newId();sessionStorage.setItem(key,id);}return id;
}
export function useRoom(code:string,role:Role,enabled=true) {
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[apiOnline,setApiOnline]=useState(true),[realtime,setRealtime]=useState('กำลังเชื่อมต่อ'),[error,setError]=useState(''),[needsJoin,setNeedsJoin]=useState(false);
 const latest=useRef<Snapshot|null>(null),offset=useRef(0),busy=useRef(false),refetch=useRef(false),alive=useRef(true),lastAt=useRef(0),lastSessionRepair=useRef(0);
 const apply=useCallback((s:Snapshot)=>{
  const old=latest.current;
  if(old&&s.room.version<old.room.version)return;
  if(old?.run?.id===s.run?.id&&old?.run&&s.run&&s.run.version<old.run.version)return;
  if(old?.run?.id===s.run?.id&&old?.me?.state&&s.me?.state){s.me.state.accepted=Math.max(old.me.state.accepted,s.me.state.accepted);}
  latest.current=s;setSnapshot(s);
 },[]);
 const refresh=useCallback(async()=>{
  if(busy.current){refetch.current=true;return;}busy.current=true;
  const before=Date.now();
  try{
   let s:Snapshot;
   try{s=await api<Snapshot>(`/rooms/${code}/snapshot`,role);}
   catch(e){
    if(role!=='host'&&e instanceof GameError&&e.code==='UNAUTHORIZED'&&Date.now()-lastSessionRepair.current>=10000){
     lastSessionRepair.current=Date.now();
     await api('/session',role,{role});
     s=await api<Snapshot>(`/rooms/${code}/snapshot`,role);
    }else throw e;
   }
   if(!alive.current)return;offset.current=s.serverNow-(before+Date.now())/2;lastAt.current=Date.now();apply(s);setApiOnline(true);setError('');setNeedsJoin(false);
  }catch(e){if(!alive.current)return;if(e instanceof GameError&&e.code==='NOT_A_MEMBER'){setApiOnline(true);setNeedsJoin(true);setError('');}else {setApiOnline(false);setError(e instanceof GameError?e.message:errors.NETWORK);}}
  finally{busy.current=false;if(refetch.current&&alive.current){refetch.current=false;void refresh();}}
 },[code,role,apply]);
 useEffect(()=>{
  if(!enabled)return;
  alive.current=true;let timer:ReturnType<typeof setTimeout>;
  const poll=()=>{void refresh();timer=setTimeout(poll,role==='player'?2000:500);};
  const boot=async()=>{
   try{if(role!=='host')await api('/session',role,{role});await refresh();}catch{void refresh();}timer=setTimeout(poll,500);
  };void boot();
  const online=()=>void refresh();window.addEventListener('online',online);window.addEventListener('focus',online);document.addEventListener('visibilitychange',online);
  return()=>{alive.current=false;clearTimeout(timer);window.removeEventListener('online',online);window.removeEventListener('focus',online);document.removeEventListener('visibilitychange',online);};
 },[code,role,refresh,enabled]);
 useEffect(()=>{
  if(!enabled||!snapshot||needsJoin)return;
  const events=new EventSource(`/api/rooms/${code}/events?role=${role}`);
  events.onopen=()=>setRealtime('เชื่อมต่อแล้ว');events.onerror=()=>setRealtime('กำลังเชื่อมต่อใหม่');events.onmessage=()=>void refresh();
  return()=>events.close();
 },[code,role,!!snapshot,needsJoin,refresh,enabled]);
 useEffect(()=>{
  if(!enabled)return;
  const d=snapshot?.run?.deadline;if(!d||snapshot?.run?.paused)return;
  const timer=setTimeout(()=>void refresh(),Math.max(0,d-Date.now()-offset.current)+35);return()=>clearTimeout(timer);
 },[snapshot?.run?.deadline,snapshot?.run?.paused,refresh,enabled]);
 const ack=useCallback((runId:string,accepted:number)=>{
  const s=latest.current;if(s?.run?.id===runId&&s.me?.state)apply({...s,me:{...s.me,state:{...s.me.state,accepted:Math.max(s.me.state.accepted,accepted)}}});
 },[apply]);
 return {snapshot,latest,refresh,ack,apiOnline,realtime,error,needsJoin,now:()=>Date.now()+offset.current,isFresh:()=>Date.now()-lastAt.current<5000};
}
