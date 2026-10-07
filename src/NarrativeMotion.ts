import gsap from 'gsap';
import type {Cue} from './content';
import {LOOP_REST_SECONDS} from './MotionTiming.ts';

export const NARRATIVE_START=2.8;
export const narrativeIntent:Record<string,string>={
 opening:'two rhythms: human pulse and propagation through a network',biology:'biological pulse contrasted with column-wise computation',question:'attention moves from capability to verification to accountability',art:'gallery light passes over the glass, preserving the painting',poetry:'language tokens rise and dissolve',flamingo:'a gallery reflection reveals the photographic surface',attribution:'the same picture remains while attention alternates between labels',individual:'signals diverge along different idea paths',diversity:'signals converge along similar idea paths',tensor:'a bounded column scan across a fixed matrix',protein:'light traces a connected protein diagram',strategy:'a clear equation contrasted with a sequence of contextual factors',frontier:'hazard dashes mark the irregular boundary','frontier-data':'light connects the fixed evidence panels',mushroom:'the explicitly simulated confidence gauge fluctuates',chat:'a quiet response rhythm surrounds a stable quote',empathy:'a travelling highlight in a bar with a fixed 78.6% boundary',tokens:'context flows toward the response without moving its text',tessa:'illustrative ECG and a restrained risk marker',gate:'a packet pauses at each verification step',case:'attention traces the mismatch in an illustrative sequence',liability:'anticipation, strike, rebound and rest of a solid gavel',synergy:'two groups receive attention without changing the study figures',design:'a packet pauses at the designed handoff',outage:'a bounded pulse around the fault indicator',oversight:'attention steps through understanding, checking and intervention',formula:'light travels from proposal to verification to responsibility',different:'two contours move with different rhythms',future:'the contours approach a shared horizon',responsibility:'a quiet gold focus at the shared horizon',thanks:'a slow final breath in the horizon'
};

/** Every idle action is a finite paused timeline sought from the deck's one clock. */
export function createNarrativeMotion(root:HTMLElement,cue:Cue){
 const period=cue.loop,activeDuration=period-LOOP_REST_SECONDS,tl=gsap.timeline({paused:true}),v=cue.visual||'';
 const q=(selector:string)=>[...root.querySelectorAll<HTMLElement|SVGElement>(selector)];
 // React reuses card nodes across cues; a prior cue's light must not survive a handoff.
 gsap.set(q('.material-sheen'),{x:-520,opacity:0});
 gsap.set(q('.spatial-card,.flow-node,.context-cloud b,.study-numbers>div,[data-token-chip],.fault-symbol,.case-sequence span'),{'--attention':0});
 const pulse=(els:(HTMLElement|SVGElement)[],start:number,spacing=.22,peak=.9)=>els.forEach((el,i)=>{
  gsap.set(el,{opacity:.38});const at=start+i*spacing;
  tl.to(el,{opacity:peak,duration:.27,ease:'sine.inOut'},at).to(el,{opacity:.38,duration:.55,ease:'sine.inOut'},at+.27);
 });
 const attention=(els:(HTMLElement|SVGElement)[],start:number,spacing=1.35)=>els.forEach((el,i)=>{
  gsap.set(el,{'--attention':0});const at=start+i*spacing;
  tl.to(el,{'--attention':1,duration:.35,ease:'power2.out'},at).to(el,{'--attention':0,duration:.65,ease:'sine.inOut'},at+.8);
 });
 const reflect=(selectors:string,start=.05,spacing=1.2)=>q(selectors).forEach((card,i)=>{
  const sheen=card.querySelector<HTMLElement>('.material-sheen');if(!sheen)return;
  gsap.set(sheen,{x:-520,opacity:0});const at=start+i*spacing;
  tl.to(sheen,{opacity:.16,duration:.6,ease:'sine.inOut'},at).to(sheen,{x:760,duration:2.75,ease:'sine.inOut'},at).to(sheen,{opacity:0,duration:.7,ease:'sine.inOut'},at+2.05).set(sheen,{x:-520},at+2.85);
 });

 if(v==='opening'||v==='biology'){
  q('[data-neural-runner]').forEach((el,i)=>{
   const path=el as SVGPathElement,len=path.getTotalLength(),head=Math.min(26,len*.35),at=.05+i*.12;
   gsap.set(path,{strokeDasharray:`${head} ${len+head}`,strokeDashoffset:head,opacity:0});
   tl.to(path,{opacity:.95,duration:.18,ease:'sine.out'},at)
    .to(path,{strokeDashoffset:-len,duration:1.7,ease:'sine.inOut'},at)
    .to(path,{opacity:0,duration:.22,ease:'sine.in'},at+1.5)
    .set(path,{strokeDashoffset:head},at+1.75);
  });
  pulse(q('.brain-symbol circle'),.35,.15);
  const nodes=q('.network-symbol .node-core');nodes.forEach((node,i)=>{
   gsap.set(node,{opacity:.3});const at=1.1+Math.floor(i/3)*.36;
   tl.to(node,{opacity:1,duration:.22,ease:'power2.out'},at).to(node,{opacity:.3,duration:.75,ease:'sine.inOut'},at+.25);
  });pulse(q('.network-symbol line'),1.2,.018,.7);
 }else if(v==='liability'){
  const tool=q('.gavel-tool'),block=q('.gavel-block'),shadow=q('.gavel-contact-shadow'),impact=q('.gavel-impact');
  gsap.set(tool,{svgOrigin:'452 211',rotation:10,y:-2});gsap.set(block,{y:0});gsap.set(shadow,{svgOrigin:'263 279',scaleX:.8,opacity:.25});gsap.set(impact,{svgOrigin:'261 280',scale:1,opacity:0});
  tl.to(tool,{rotation:38,y:-4,duration:.72,ease:'power2.inOut'},0)
   .to(tool,{rotation:-4,y:7,duration:.2,ease:'power3.in'},.72)
   .to(tool,{rotation:5,y:-1,duration:.15,ease:'power2.out'},.92)
   .to(tool,{rotation:-2,y:5,duration:.23,ease:'sine.inOut'},1.07)
   .to(tool,{rotation:10,y:-2,duration:1.05,ease:'power3.inOut'},1.65);
  tl.to(shadow,{scaleX:1.15,opacity:.65,duration:.2,ease:'power3.in'},.72).to(shadow,{scaleX:.8,opacity:.25,duration:.7,ease:'sine.inOut'},.95);
  tl.to(block,{y:1.5,duration:.06,ease:'power2.out'},.92).to(block,{y:0,duration:.35,ease:'power2.out'},.98);
  tl.to(impact,{opacity:.55,duration:.05,ease:'power2.out'},.92).to(impact,{scale:2.1,opacity:0,duration:.7,ease:'power3.out'},.97).set(impact,{scale:1},1.8);
 }else if(v==='individual'||v==='diversity'){
  q('[data-idea-runner]').forEach((el,i)=>{
   const path=el as SVGPathElement,len=path.getTotalLength(),at=i*.3;
   gsap.set(path,{strokeDasharray:`12 ${len+12}`,strokeDashoffset:12,opacity:0});
   tl.to(path,{opacity:1,duration:.3,ease:'sine.out'},at).to(path,{strokeDashoffset:-len,duration:2.6,ease:'power2.inOut'},at).to(path,{opacity:0,duration:.35,ease:'sine.in'},at+2.6).set(path,{strokeDashoffset:12},at+3);
  });
 }else if(v==='empathy'){
  const runner=q('[data-evidence-runner]');gsap.set(runner,{x:-80,opacity:0});
  tl.to(runner,{opacity:1,duration:.5,ease:'sine.out'},.05).to(runner,{x:490,duration:2.4,ease:'power2.inOut'},.05).to(runner,{opacity:0,duration:.5,ease:'sine.in'},2.1).set(runner,{x:-80},2.9);
 }else if(v==='gate'||v==='design'||v==='oversight'){
  attention(q('.flow-node'),.05,.9);
 }else if(v==='tokens'){
  attention(q('[data-token-chip]:nth-child(odd)'),.05,.85);pulse(q('[data-token-chip]:nth-child(even)'),.55,.85,1);
 }else if(v==='tensor'){
  q('[data-cell]').forEach((cell,i)=>{const at=.05+i%4*.5;
   gsap.set(cell,{backgroundColor:'rgba(116,143,252,0.06)'});
   tl.to(cell,{backgroundColor:'rgba(116,143,252,0.25)',duration:.38,ease:'sine.inOut'},at).to(cell,{backgroundColor:'rgba(116,143,252,0.06)',duration:.8,ease:'sine.inOut'},at+.55);
  });
 }else if(v==='protein'){
  pulse(q('.protein-svg circle'),.05,.075,1);gsap.set(q('.protein-svg'),{rotation:0,transformOrigin:'50% 50%'});
  tl.to(q('.protein-svg'),{rotation:.8,duration:activeDuration/2,ease:'sine.inOut'},0).to(q('.protein-svg'),{rotation:0,duration:activeDuration/2,ease:'sine.inOut'},activeDuration/2);
 }else if(v==='question'||v==='strategy'||v==='frontier-data'||v==='synergy'){
  attention(q(v==='strategy'?'.context-cloud b':v==='synergy'?'.study-numbers>div':'.spatial-card'),.05,.95);
  if(v==='strategy')reflect('.spatial-card:first-child',.15,0);
 }else if(v==='attribution'){
  attention(q('.compact-card'),.05,1.6);reflect('.photo-card',.6,0);
 }else if(v==='art'||v==='flamingo'||v==='mushroom'){
  reflect('.photo-card',.05,0);
 }else if(v==='chat'){
  reflect('.spatial-card:first-child',.05,0);attention(q('.spatial-card:last-child'),.6);
 }else if(v==='case'){
  attention(q('.case-sequence span'),.05,.95);pulse(q('.case-sequence i'),.65,0,1);
 }else if(v==='outage'){
  attention(q('.fault-symbol'),.05);reflect('.compact-card',.4,0);
 }else if(v==='tessa'){
  pulse(q('.alert-line i'),.1,.2,1);
 }else if(['different','future','responsibility','thanks'].includes(v)){
  q('.horizon-svg>path').forEach((path,i)=>{
   gsap.set(path,{y:0});const shift=v==='different'?(i%2?8:-8):v==='future'?-(4+i):v==='thanks'?3:2;
   tl.to(path,{y:shift,duration:activeDuration/2,ease:'sine.inOut'},0).to(path,{y:0,duration:activeDuration/2,ease:'sine.inOut'},activeDuration/2);
  });
 }
 const actionEnd=Math.max(tl.duration(),['poetry','frontier','mushroom','tessa','gate','formula'].includes(v)?activeDuration:0)||activeDuration;
 // A finite carrier supplies the rest. Gentle card drift is an independent material layer.
 const carrier={progress:0};tl.to(carrier,{progress:1,duration:period,ease:'none'},0);
 const cards=q('.spatial-card,.formula-step,.horizon-world') as HTMLElement[];
 cards.forEach(card=>{card.style.translate='0px 0px';card.style.setProperty('--ambient-light','.3');});
 const render=(time:number)=>{
  const local=Math.max(0,time-NARRATIVE_START),phase=local%period,angle=phase/period*Math.PI*2;
  tl.totalTime(phase,false);
  const ramp=Math.min(local/.8,1),settled=ramp*ramp*(3-2*ramp);
  cards.forEach((card,i)=>{
   const seed=i*.82,x=(Math.sin(angle+seed)-Math.sin(seed))*3*settled,y=(Math.cos(angle+seed)-Math.cos(seed))*5*settled;
   // Individual CSS translate composes with the existing camera/entry transform.
   card.style.translate=`${x.toFixed(3)}px ${y.toFixed(3)}px`;
   card.style.setProperty('--ambient-light',(.3+(.5+.5*Math.sin(angle+seed))*.45).toFixed(4));
  });
 };
 return {timeline:tl,period,activeDuration,actionEnd,rest:period-actionEnd,intent:narrativeIntent[v]||'',render,dispose:()=>{tl.kill();cards.forEach(card=>{card.style.translate='';card.style.removeProperty('--ambient-light');});}};
}
