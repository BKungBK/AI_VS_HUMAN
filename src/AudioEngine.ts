import {audioFiles,audioPath,type SoundPlan} from './SoundScore';

export type AudioSettings={enabled:boolean;volume:number;ambient:boolean;speechSafe:boolean};
export type AudioState=AudioSettings&{status:'locked'|'loading'|'ready'|'error';error:string;context:string;voices:number;cue:string|null;playing:boolean;resyncs:number};
type Voice={source:AudioBufferSourceNode;gain:GainNode;pan:StereoPannerNode;ambient:boolean;startsAt:number;stopsAt?:number};
type Mix={input:BiquadFilterNode;presence:BiquadFilterNode;master:GainNode;meter:AnalyserNode};
const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));

/** Same filter, dynamics and bounded output graph in live and offline rendering. */
function mixGraph(ctx:BaseAudioContext,volume:number,speechSafe:boolean):Mix{
 const input=ctx.createBiquadFilter();input.type='highpass';input.frequency.value=65;input.Q.value=.707;
 const presence=ctx.createBiquadFilter();presence.type='peaking';presence.frequency.value=1600;presence.Q.value=.65;presence.gain.value=speechSafe?-8:0;
 const darken=ctx.createBiquadFilter();darken.type='lowpass';darken.frequency.value=7800;darken.Q.value=.707;
 const compression=ctx.createDynamicsCompressor();compression.threshold.value=-20;compression.knee.value=12;compression.ratio.value=3;compression.attack.value=.008;compression.release.value=.18;
 const master=ctx.createGain();master.gain.value=clamp(volume);
 const ceiling=ctx.createWaveShaper();const curve=new Float32Array(8193);for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=.7*Math.tanh(x/.7);}ceiling.curve=curve;ceiling.oversample='4x';
 const meter=ctx.createAnalyser();meter.fftSize=256;
 input.connect(presence).connect(darken).connect(compression).connect(master).connect(ceiling).connect(meter).connect(ctx.destination);
 return {input,presence,master,meter};
}

async function loadBuffers(ctx:BaseAudioContext,signal?:AbortSignal){
 const entries=await Promise.all(audioFiles.map(async id=>{try{const r=await fetch(audioPath(id),{signal});if(!r.ok)throw new Error('Missing asset');return [id,await ctx.decodeAudioData(await r.arrayBuffer())] as const;}catch(e){if(signal?.aborted)throw e;throw new Error('เตรียมเอฟเฟกต์เสียงไม่สำเร็จ ลองเปิดเสียงอีกครั้ง');}}));
 return new Map(entries);
}
function voice(ctx:BaseAudioContext,mix:Mix,buffer:AudioBuffer,gain:number,pan:number,at:number,offset=0,loop=false,fade=0,panEnd?:number):Voice{
 const source=ctx.createBufferSource();source.buffer=buffer;source.loop=loop;
 const fader=ctx.createGain(),panner=ctx.createStereoPanner();panner.pan.value=Math.max(-.25,Math.min(.25,pan));
 if(panEnd!==undefined&&buffer.duration-offset>.005){const curve=new Float32Array(64);for(let i=0;i<curve.length;i++){const p=(offset+(buffer.duration-offset)*i/(curve.length-1))/buffer.duration,e=p<.5?4*p*p*p:1-(-2*p+2)**3/2;curve[i]=pan+(panEnd-pan)*e;}panner.pan.setValueCurveAtTime(curve,at,buffer.duration-offset);}
 fader.gain.setValueAtTime(fade?0:gain,at);if(fade)fader.gain.linearRampToValueAtTime(gain,at+fade);
 source.connect(fader).connect(panner).connect(mix.input);source.start(at,offset);
 return {source,gain:fader,pan:panner,ambient:loop,startsAt:at};
}
function endVoice(v:Voice,now:number,fade=.025){
 // Repeated navigation may shorten a release, but must never postpone its end.
 // Future ambience is cancelled before it starts instead of retaining a 400 ms tail.
 const release=now<v.startsAt?.005:fade,stopAt=now+release+.005;
 if(v.stopsAt!==undefined&&v.stopsAt<=stopAt)return;v.stopsAt=stopAt;
 const p=v.gain.gain;
 p.cancelAndHoldAtTime(now);p.linearRampToValueAtTime(0,now+release);
 try{v.source.stop(stopAt);}catch{/* An ended source is already silent. */}
}

export class AudioEngine{
 settings:AudioSettings={enabled:false,volume:.65,ambient:false,speechSafe:true};
 status:AudioState['status']='locked';error='';context:AudioContext|null=null;mix:Mix|null=null;
 buffers=new Map<string,AudioBuffer>();voices=new Set<Voice>();plan:SoundPlan|null=null;
 onChange:()=>void;abort=new AbortController();loading:Promise<void>|null=null;disposed=false;
 time=0;playing=false;dirty=false;baseTime=0;baseClock=0;resyncs=0;previewUntil=0;
 constructor(onChange:()=>void){this.onChange=onChange;
  try{const p=JSON.parse(localStorage.getItem('sparring-audio-settings')||'{}');this.settings.volume=typeof p.volume==='number'?clamp(p.volume):.65;this.settings.ambient=p.ambient===true;this.settings.speechSafe=p.speechSafe!==false;}catch{/* Safe defaults when storage is unavailable. */}
 }
 state():AudioState{return {...this.settings,status:this.status,error:this.error,context:this.context?.state||'uninitialized',voices:this.voices.size,cue:this.plan?.cue||null,playing:this.playing,resyncs:this.resyncs};}
 notify(){if(!this.disposed)this.onChange();}
 save(){try{localStorage.setItem('sparring-audio-settings',JSON.stringify({...this.settings,enabled:false}));}catch{/* Presentation works without local storage. */}this.notify();}
 async enable(value=true){
  this.settings.enabled=value;this.save();
  if(!value){this.hold();return;}
  try{
   // Called directly by a click or M key, before the first await: browser gesture unlock.
   if(!this.context){if(typeof AudioContext==='undefined')throw new Error('เบราว์เซอร์นี้ยังไม่รองรับเสียงสำหรับการนำเสนอ');this.context=new AudioContext({latencyHint:'interactive'});this.mix=mixGraph(this.context,this.settings.volume,this.settings.speechSafe);}
   const resume=this.context.resume();
   if(!this.loading&&this.status!=='ready'){
    this.status='loading';this.error='';this.notify();
    this.loading=loadBuffers(this.context,this.abort.signal).then(b=>{this.buffers=b;this.status='ready';}).finally(()=>{this.loading=null;});
   }
   await Promise.all([resume,this.loading]);if(this.disposed)return;
   this.dirty=true;this.notify();
  }catch(e){if(this.disposed)return;this.status='error';this.error=e instanceof Error?e.message:String(e);this.settings.enabled=false;this.hold();this.notify();}
 }
 setVolume(value:number){this.settings.volume=clamp(value);if(this.context&&this.mix){const p=this.mix.master.gain;p.cancelAndHoldAtTime(this.context.currentTime);p.linearRampToValueAtTime(this.settings.volume,this.context.currentTime+.06);}this.save();}
 setAmbient(value:boolean){this.settings.ambient=value;this.dirty=true;this.save();}
 setSpeechSafe(value:boolean){this.settings.speechSafe=value;if(this.context&&this.mix){const p=this.mix.presence.gain;p.cancelAndHoldAtTime(this.context.currentTime);p.linearRampToValueAtTime(value?-8:0,this.context.currentTime+.12);}this.save();}
 configure(plan:SoundPlan,t:number){this.plan=plan;this.time=t;this.dirty=true;this.previewUntil=0;}
 seek(t:number){this.time=t;this.dirty=true;}
 hold(){if(this.context)this.voices.forEach(v=>endVoice(v,this.context!.currentTime));this.playing=false;this.dirty=true;this.previewUntil=0;}
 private track(v:Voice){this.voices.add(v);v.source.onended=()=>{v.source.disconnect();v.gain.disconnect();v.pan.disconnect();this.voices.delete(v);};}
 private schedule(t:number){
  const ctx=this.context,mix=this.mix,plan=this.plan;if(!ctx||!mix||!plan)return;
  const now=ctx.currentTime,base=now+.012;
  this.voices.forEach(v=>endVoice(v,now,v.ambient?.4:.025));
  for(const e of plan.events){const offset=Math.max(0,t-e.at);if(offset>=e.duration)continue;const b=this.buffers.get(e.asset);if(b)this.track(voice(ctx,mix,b,e.gain,e.pan,base+Math.max(0,e.at-t),offset,false,offset>.001?.012:0,e.panEnd));}
  if(this.settings.ambient&&plan.place){const b=this.buffers.get(`ambient-${plan.place}`);if(b){const offset=Math.max(0,t-plan.ambientStart)%plan.loop;this.track(voice(ctx,mix,b,.16,0,base+Math.max(0,plan.ambientStart-t),offset,true,.65));}}
  this.baseTime=t;this.baseClock=base;this.dirty=false;
 }
 /** No audio timer or second animation loop. The deck's rAF supplies cue time. */
 sync(t:number,paused:boolean){
  this.time=t;const playable=!paused&&this.settings.enabled&&this.status==='ready'&&this.context?.state==='running';
  if(this.settings.enabled&&this.context&&this.context.currentTime<this.previewUntil)return;
  if(!playable){if(this.playing)this.hold();return;}
  const drift=this.playing&&this.context?Math.abs((this.context.currentTime-this.baseClock)-(t-this.baseTime)):0;
  if(!this.playing||this.dirty||drift>.09){if(drift>.09)this.resyncs++;this.schedule(t);}
  this.playing=true;
 }
 preview(){
  if(!this.context||!this.mix||this.status!=='ready'||!this.settings.enabled)return;
  this.hold();const now=this.context.currentTime+.015;this.previewUntil=now+1.5;
  for(const [id,at,gain] of [['departure',0,.25],['duet',.22,.55]] as const){const b=this.buffers.get(id);if(b)this.track(voice(this.context,this.mix,b,gain,0,now+at));}
 }
 async render(duration=4,ambient=this.settings.ambient){
  if(!this.plan)throw new Error('No cue score');return renderScore(this.plan,duration,{...this.settings,ambient},this.buffers);
 }
 dispose(){this.disposed=true;this.abort.abort();this.hold();void this.context?.close().catch(()=>{});}
}

export async function renderScore(plan:SoundPlan,duration=4,options:Partial<AudioSettings>={},cached?:Map<string,AudioBuffer>){
 const seconds=Math.max(.1,Math.min(30,duration)),ctx=new OfflineAudioContext(2,Math.ceil(seconds*48000),48000),mix=mixGraph(ctx,options.volume??.65,options.speechSafe??true);
 const buffers=cached?.size===audioFiles.length?cached:await loadBuffers(ctx);
 plan.events.forEach(e=>{if(e.at<seconds)voice(ctx,mix,buffers.get(e.asset)!,e.gain,e.pan,e.at,0,false,0,e.panEnd);});
 if(options.ambient&&plan.place)voice(ctx,mix,buffers.get(`ambient-${plan.place}`)!, .16,0,plan.ambientStart,0,true,.65);
 return ctx.startRendering();
}
export function wavResult(buffer:AudioBuffer){
 const n=buffer.length,bytes=new Uint8Array(44+n*4),view=new DataView(bytes.buffer),ascii=(offset:number,s:string)=>[...s].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
 ascii(0,'RIFF');view.setUint32(4,bytes.length-8,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,n*4,true);
 let peak=0,sum=0;const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
 for(let i=0;i<n;i++)for(let c=0;c<2;c++){const v=(c?right:left)[i];peak=Math.max(peak,Math.abs(v));sum+=v*v;view.setInt16(44+(i*2+c)*2,Math.round(Math.max(-1,Math.min(1,v))*32767),true);}
 let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
 return {base64:btoa(binary),duration:buffer.duration,sampleRate:buffer.sampleRate,channels:2,peakDbFS:20*Math.log10(peak||1e-12),rmsDbFS:20*Math.log10(Math.sqrt(sum/(n*2))||1e-12)};
}
