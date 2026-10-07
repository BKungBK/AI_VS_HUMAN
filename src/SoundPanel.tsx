import type {AudioState} from './AudioEngine';
export function SoundPanel({state,presenter,onClose,onToggle,onVolume,onAmbient,onSpeech,onPreview}:{state:AudioState;presenter:boolean;onClose:()=>void;onToggle:()=>void;onVolume:(v:number)=>void;onAmbient:(v:boolean)=>void;onSpeech:(v:boolean)=>void;onPreview:()=>void}){
 const locked=presenter&&state.status!=='ready';
 return <section className={`sound-panel ${presenter?'sound-presenter':''}`} role="dialog" aria-label="ตั้งค่าเสียง"><header><h2>เสียงของการเดินทาง</h2><button onClick={onClose} aria-label="ปิดตั้งค่าเสียง">×</button></header>
  <p className="sound-description">เอฟเฟกต์ตามกล้องและจังหวะลงจอด</p>
  <button className="sound-toggle" aria-pressed={state.enabled} onClick={onToggle} disabled={locked||state.status==='loading'}>{state.status==='loading'?'กำลังเตรียมเสียง…':state.enabled?'ปิดเสียง · M':'เปิดเสียง · M'}</button>
  <label className="sound-volume">ระดับเสียง <output>{Math.round(state.volume*100)}%</output><input aria-label="ระดับเสียง" type="range" min="0" max="100" value={Math.round(state.volume*100)} onChange={e=>onVolume(Number(e.target.value)/100)}/></label>
  <label className="sound-choice"><input type="checkbox" checked={state.speechSafe} onChange={e=>onSpeech(e.target.checked)}/><span>เว้นพื้นที่ให้เสียงผู้พูด<small>ลดความถี่ที่ทับเสียงพูด</small></span></label>
  <label className="sound-choice"><input type="checkbox" checked={state.ambient} onChange={e=>onAmbient(e.target.checked)}/><span>บรรยากาศประจำสถานที่<small>ลูปเบาระหว่างช่วงอ่านและพูด</small></span></label>
  <button className="sound-preview" onClick={onPreview} disabled={!state.enabled||state.status!=='ready'}>ทดสอบเสียง</button>
  <p className="sound-help" role="status">{locked?'เปิดเสียงที่จอฉายหนึ่งครั้งก่อน แล้วควบคุมจากหน้าต่างนี้ได้':state.error||'หยุดภาพหรือดับจอจะหยุดเสียงด้วย · M เปิด/ปิดเสียง'}</p>
 </section>;
}
