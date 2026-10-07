import gsap from 'gsap';
import type {Cue} from './content';

export const READ_Z=1500;
export const READ_FOV=2*Math.atan(1080/(2*READ_Z))*180/Math.PI;
export type CameraPose={z:number;x:number;y:number;yaw:number;pitch:number;roll:number};
export const readPose=():CameraPose=>({z:READ_Z,x:0,y:0,yaw:0,pitch:0,roll:0});

/** Finite camera keys. A navigation handoff starts at the captured previous pose. */
export function cameraMotion(tl:gsap.core.Timeline,state:CameraPose,cue:Cue,previous:CameraPose,direction:number,hasExit:boolean){
 const neutral=readPose();
 if(cue.kind==='placeholder'){gsap.set(state,neutral);return;}
 // Dolly looks back toward the focus plane as FOV tightens, keeping incoming Thai copy inside the frame.
 const wide:CameraPose={z:cue.motion==='dolly'?2520:cue.motion==='push'?2600:cue.motion==='punch'?1930:2050,x:direction*(cue.motion==='arc'?170:cue.motion==='dolly'?35:65),y:cue.motion==='arc'?-70:28,yaw:direction*(cue.motion==='arc'?-4.2:cue.motion==='dolly'?.8:-1.8),pitch:cue.motion==='arc'?1.6:cue.motion==='dolly'?-.6:.6,roll:direction*(cue.motion==='arc'?-1:cue.motion==='dolly'?0:-.35)};
 gsap.set(state,hasExit?previous:wide);
 const transit=hasExit?.52:.16;
 if(hasExit)tl.to(state,{...wide,duration:.44,ease:'power3.inOut'},.08);
 if(cue.motion==='punch'){
  tl.to(state,{...neutral,z:1430,duration:.6,ease:'expo.inOut'},transit);
  tl.to(state,{...neutral,duration:1.05,ease:'power3.out'},transit+.6);
 }else if(cue.motion==='push'){
  tl.to(state,{...neutral,z:1440,x:direction*12,yaw:direction*.25,duration:1.05,ease:'expo.inOut'},transit);
  tl.to(state,{...neutral,duration:.7,ease:'power3.out'},transit+1.05);
 }else{
  tl.to(state,{...neutral,duration:cue.motion==='dolly'?1.45:1.68,ease:'power4.inOut'},transit);
 }
}

/** Native HTML lines occupy Z planes; Thai shaping stays intact. */
export function textMotion(tl:gsap.core.Timeline,root:HTMLElement,cue:Cue,direction:number,hasExit:boolean,journey=false){
 const heading=root.querySelector('h1');
 const lines=[...root.querySelectorAll<HTMLElement>('[data-text-line]')];
 const supporting=[...root.querySelectorAll<HTMLElement>('[data-reveal]:not(h1)')];
 const identity={opacity:1,x:0,y:0,z:0,rotationX:0,rotationY:0,rotationZ:0,scale:1};
 gsap.set(heading,identity);
 if(cue.kind==='placeholder'){
  gsap.set([...lines,...supporting],identity);
  tl.fromTo(heading,{opacity:0},{opacity:1,duration:.35,ease:'sine.out'},hasExit?.18:0);
  tl.fromTo(supporting,{opacity:0},{opacity:1,duration:.35,ease:'sine.out'},hasExit?.24:.08);
  return;
 }
 const arrival=journey?1.25:hasExit?.57:.3;
 lines.forEach((el,i)=>{
  gsap.set(el,{transformOrigin:'0% 65%'});
  tl.fromTo(el,{opacity:0,z:-260,x:direction*34,y:36,rotationX:11,rotationY:-direction*14,rotationZ:-direction*.5,scale:.98},{...identity,duration:1.08,ease:'back.out(1.12)'},arrival+i*.105);
 });
 supporting.forEach((el,i)=>{
  const eyebrow=el.classList.contains('eyebrow');
  tl.fromTo(el,{opacity:0,z:eyebrow?-80:-150,x:direction*(eyebrow?15:22),y:eyebrow?-10:26,rotationX:eyebrow?-5:7,rotationY:-direction*5},{...identity,duration:eyebrow?.72:.95,ease:'power3.out'},arrival+(eyebrow?-.13:.2)+i*.04);
 });
}

export function exitText(tl:gsap.core.Timeline,root:HTMLElement,direction:number,plain:boolean){
 const lines=root.querySelectorAll('[data-text-line]');
 if(plain){tl.fromTo(root,{opacity:1},{opacity:0,duration:.22,ease:'sine.inOut'},0);return;}
 lines.forEach((el,i)=>tl.to(el,{z:210+i*45,x:-direction*(58+i*16),y:-24-i*9,rotationY:direction*13,rotationX:-7,rotationZ:direction*.8,opacity:0,duration:.38,ease:'power3.in'},i*.04));
 tl.to(root.querySelectorAll('[data-reveal]:not(h1)'),{z:100,x:-direction*30,y:-14,rotationY:direction*7,opacity:0,duration:.28,stagger:.025,ease:'power2.in'},.03);
 tl.fromTo(root,{opacity:1},{opacity:0,duration:.44,ease:'power3.in'},0);
}
