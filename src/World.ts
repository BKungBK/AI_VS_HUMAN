import * as THREE from 'three';
import {CSS3DObject,CSS3DRenderer} from 'three/addons/renderers/CSS3DRenderer.js';
import gsap from 'gsap';
import type {Cue} from './content';
import {cameraMotion,textMotion,exitText,readPose,READ_Z,READ_FOV,type CameraPose} from './SpatialMotion';
import {Journey,PlaceSet,placeFor,type Point} from './Places';
import {createNarrativeMotion,NARRATIVE_START} from './NarrativeMotion';
import {LOOP_REST_SECONDS} from './MotionTiming';

export class World {
 camera=new THREE.PerspectiveCamera(READ_FOV,1920/1080,1,200000);
 scene=new THREE.Scene(); cssScene=new THREE.Scene(); css=new CSS3DRenderer();
 exitScene=new THREE.Scene(); exitRenderer=new CSS3DRenderer();
 object:CSS3DObject; textObject:CSS3DObject; focus=new THREE.Group();
 place:PlaceSet|null=null; retired:{set:PlaceSet;angle:number}[]=[]; journey:Journey|null=null; origin:Point={x:0,y:0,z:0};ambientAngle=0;
 exitObjects:CSS3DObject[]=[]; previousPose:CameraPose=readPose(); previousDolly=0; projection={dolly:0};
 lightState={r:116,g:143,b:252};
 renderer:THREE.WebGLRenderer|null=null;
 particle:THREE.Points|null=null; seeds:Float32Array; positions:Float32Array;
 cameraState=readPose(); timeline:gsap.core.Timeline|null=null;
 fallback=false; cue:Cue|null=null; narrative:ReturnType<typeof createNarrativeMotion>|null=null; host:HTMLElement; environmentHost:HTMLElement; element:HTMLElement; textElement:HTMLElement; onFallback:()=>void; canvas:HTMLCanvasElement;
 constructor(canvas:HTMLCanvasElement,host:HTMLElement,element:HTMLElement,textElement:HTMLElement,outgoing:HTMLElement,onFallback:()=>void){
  this.canvas=canvas;this.host=host;this.element=element;this.textElement=textElement;this.onFallback=onFallback;
  this.environmentHost=document.createElement('div');this.environmentHost.className='scene-architecture-host';host.appendChild(this.environmentHost);
  this.css.setSize(1920,1080);this.css.domElement.className='css3d-renderer';host.appendChild(this.css.domElement);
  this.exitRenderer.setSize(1920,1080);this.exitRenderer.domElement.className='css3d-renderer';outgoing.appendChild(this.exitRenderer.domElement);
  this.cssScene.add(this.focus);
  this.object=new CSS3DObject(element);this.object.position.set(415,-4,0);this.focus.add(this.object);
  this.textObject=new CSS3DObject(textElement);this.focus.add(this.textObject);
  this.camera.position.z=READ_Z;
  const count=180;this.seeds=new Float32Array(count*4);this.positions=new Float32Array(count*3);
  let seed=1945;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const color=new Float32Array(count*3);
  for(let i=0;i<count;i++){
   this.seeds.set([(random()-.5)*3000,(random()-.5)*1700,-1000+random()*1600,random()*Math.PI*2],i*4);
   const c=new THREE.Color(i%3===0?'#FF6B6B':i%3===1?'#748FFC':'#F8F9FA');color.set([c.r,c.g,c.b],i*3);
  }
  try{
   this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
   this.renderer.setPixelRatio(1);this.renderer.setSize(1920,1080,false);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(this.positions,3));geo.setAttribute('color',new THREE.BufferAttribute(color,3));
   const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:false,uniforms:{opacity:{value:.16}},vertexShader:'attribute vec3 color; varying vec3 vColor; void main(){vColor=color;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(3.0*1500.0/-mv.z,1.0,5.0);gl_Position=projectionMatrix*mv;}',fragmentShader:'uniform float opacity;varying vec3 vColor;void main(){float d=length(gl_PointCoord-0.5);float a=smoothstep(0.5,0.1,d);gl_FragColor=vec4(vColor,a*opacity);}' });
   this.particle=new THREE.Points(geo,material);this.scene.add(this.particle);
  }catch{this.setFallback();}
  canvas.addEventListener('webglcontextlost',this.contextLost);
 }
 contextLost=(e:Event)=>{e.preventDefault();this.setFallback();};
 setFallback(){this.fallback=true;this.onFallback();}
 clearOutgoing(){this.exitObjects.forEach(obj=>this.exitScene.remove(obj));this.exitObjects=[];}
 /** Snapshot semantic layers before React commits the next cue. Both share the live camera. */
 captureOutgoing(){
  this.clearOutgoing();this.previousPose={...this.cameraState,yaw:THREE.MathUtils.radToDeg(this.camera.rotation.y),pitch:THREE.MathUtils.radToDeg(this.camera.rotation.x),roll:THREE.MathUtils.radToDeg(this.camera.rotation.z)};this.previousDolly=this.projection.dolly;
  if(!this.cue)return;
  [this.object,this.textObject].forEach((source,i)=>{
   const el=source.element.cloneNode(true) as HTMLElement;el.classList.add(i===0?'outgoing-world':'outgoing-copy');
   const clone=new CSS3DObject(el);source.updateWorldMatrix(true,false);source.getWorldPosition(clone.position);source.getWorldQuaternion(clone.quaternion);source.getWorldScale(clone.scale);
   this.exitObjects.push(clone);this.exitScene.add(clone);
  });
 }
 enter(cue:Cue,direction=1){
  const previousCue=this.cue;this.cue=cue;this.timeline?.kill();this.narrative?.dispose();this.narrative=null;
  const tl=gsap.timeline({paused:true});this.timeline=tl;
  const placeholder=cue.kind==='placeholder',centered=cue.visual==='formula',hasExit=this.exitObjects.length>0;
  const destination=placeFor(cue),distance=Math.hypot(destination.anchor.x-this.origin.x,destination.anchor.y-this.origin.y,destination.anchor.z-this.origin.z);
  const traveling=!!previousCue&&previousCue.id!==cue.id&&distance>1&&!placeholder;
  this.journey?.dispose();this.journey=new Journey(this.origin,destination,traveling,this.environmentHost,direction);
  if(traveling)tl.to(this.journey.progress,{value:1,duration:1.55,ease:'power3.inOut'},.16);
  this.focus.position.set(destination.anchor.x,destination.anchor.y,destination.anchor.z);
  if(this.place){this.retired.push({set:this.place,angle:this.ambientAngle});this.place=null;}
  while(this.retired.length>2)this.retired.shift()?.set.dispose();
  this.retired.forEach(({set})=>{
   set.group.visible=!placeholder;
   if(traveling)tl.to(set,{detail:1,duration:.44,ease:'power3.inOut'},0);
   if(traveling)tl.to(set,{opacity:0,duration:1.05,ease:'power2.inOut'},.65);
   else set.opacity=0;
   if(traveling)tl.to(set,{groundOpacity:0,duration:.35,ease:'power2.in'},0);
   else set.groundOpacity=0;
  });
  if(!placeholder){this.place=new PlaceSet(destination,this.environmentHost,cue.visual);tl.to(this.place,{detail:this.place.readDetail,duration:.95,ease:'sine.inOut'},1.8);}
  this.element.dataset.visual=cue.visual||'placeholder';this.textElement.dataset.visual=cue.visual||'placeholder';this.textElement.dataset.kind=cue.kind;
  this.textElement.dataset.closing=String(['formula','different','future','responsibility','thanks'].includes(cue.visual||''));
  this.object.position.x=centered?0:415;
  this.object.position.y=centered?-100:-4;
  this.element.style.width=centered?'1640px':'820px';this.element.style.height='680px';
  this.object.visible=!placeholder;
  const light=cue.speaker==='Human'?{r:255,g:107,b:107}:cue.speaker==='Both'?{r:99,g:230,b:190}:{r:116,g:143,b:252};
  if(placeholder)gsap.set(this.lightState,light);
  else tl.to(this.lightState,{...light,duration:1.05,ease:'sine.inOut'},0);
  cameraMotion(tl,this.cameraState,cue,this.previousPose,direction,hasExit);
  gsap.set(this.projection,{dolly:hasExit?this.previousDolly:cue.motion==='dolly'?1:0});
  if(placeholder)gsap.set(this.projection,{dolly:0});
  else tl.to(this.projection,{dolly:cue.motion==='dolly'?1:0,duration:.44,ease:'power3.inOut'},.08);
  textMotion(tl,this.textElement,cue,direction,hasExit,traveling);
  if(hasExit){
   const [oldWorld,oldText]=this.exitObjects;
    const plain=placeholder||oldText.element.dataset.kind==='placeholder';
    exitText(tl,oldText.element,direction,plain);
    tl.fromTo(oldWorld.element,{opacity:1},{opacity:0,duration:plain?.2:.46,ease:'power3.in'},0);
    if(!plain){
     tl.to(oldWorld.position,{z:oldWorld.position.z+280,x:oldWorld.position.x-direction*150,y:oldWorld.position.y-40,duration:.5,ease:'power3.in'},0);
     tl.to(oldWorld.rotation,{y:direction*THREE.MathUtils.degToRad(9),x:THREE.MathUtils.degToRad(-4),duration:.5,ease:'power3.in'},0);
    }
  }
  const cards=[...this.element.querySelectorAll<HTMLElement>('[data-card]')];
  cards.forEach((el,i)=>{
   const z=Number(el.dataset.z)||0,rx=Number(el.dataset.rx)||0,ry=Number(el.dataset.ry)||0;
   tl.fromTo(el,{opacity:0,z:z-270,x:direction*(i%2?-35:35),rotationX:rx+7,rotationY:ry+direction*(i%2?13:-13),y:i%2?-24:24,scale:.96},{opacity:1,z,x:0,rotationX:rx,rotationY:ry,y:0,scale:1,duration:1.05,ease:i%2?'back.out(1.2)':'power3.out'},(traveling?1.15:hasExit?.53:.22)+Math.min(i*.12,.36));
  });
   const photos=this.element.querySelectorAll('[data-photo]');tl.fromTo(photos,{scale:1},{scale:1.035,duration:4.5,ease:'sine.out'},1.3);
   const paths=this.element.querySelectorAll<SVGPathElement>('[data-idea]');paths.forEach((p,i)=>{const len=p.getTotalLength();tl.fromTo(p,{strokeDasharray:len,strokeDashoffset:len},{strokeDashoffset:0,duration:1.1,ease:'power3.out'},.55+i*.08);});
  if(!placeholder)this.narrative=createNarrativeMotion(this.element,cue);
  return tl;
 }
 render(time:number){
  const cue=this.cue;if(!cue)return;
  const t=Math.max(0,time);this.timeline?.totalTime(t,false);
  this.origin=this.journey?.at()||this.origin;
  const progress=this.journey?.progress.value||0,bank=this.journey?.active&&progress>0&&progress<1?Math.sin(progress*Math.PI)**2:0;
  const travelSign=Math.sign((this.journey?.end.x||0)-(this.journey?.start.x||0))||1;
  this.camera.position.set(this.origin.x+this.cameraState.x,this.origin.y+this.cameraState.y,this.origin.z+this.cameraState.z);
  this.camera.rotation.set(THREE.MathUtils.degToRad(this.cameraState.pitch+bank*(this.journey?.place.route==='descend'?-5:3)),THREE.MathUtils.degToRad(this.cameraState.yaw-bank*travelSign*9),THREE.MathUtils.degToRad(this.cameraState.roll-bank*travelSign*1.4),'YXZ');
  const dollyFOV=2*Math.atan(1080/(2*this.cameraState.z))*180/Math.PI;
  this.camera.fov=THREE.MathUtils.lerp(READ_FOV,dollyFOV,this.projection.dolly);
  this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
  const loop=Math.max(1,cue.loop),phase=t<NARRATIVE_START?0:(t-NARRATIVE_START)%loop,angle=phase/loop*Math.PI*2;
  const activeDuration=Math.max(.1,loop-LOOP_REST_SECONDS),actionProgress=Math.min(phase/activeDuration,1),actionAngle=actionProgress*Math.PI*2;
  const eventEnvelope=Math.min(1,phase/.3,Math.max(0,(activeDuration-phase)/.4));
  this.ambientAngle=angle;
  this.environmentHost.style.setProperty('--scenic-center',String(.02+bank*.72));
  this.place?.planes.forEach(p=>p.element.style.setProperty('--place-rgb',`${this.lightState.r},${this.lightState.g},${this.lightState.b}`));
  this.place?.render(angle,this.camera);this.retired.forEach(({set,angle})=>set.render(angle,this.camera));this.journey?.render(this.camera);
  this.css.render(this.cssScene,this.camera);this.exitRenderer.render(this.exitScene,this.camera);
  this.element.querySelectorAll<HTMLElement>('[data-confidence]').forEach(el=>{el.textContent='99.8';});
  this.element.querySelectorAll<HTMLElement>('[data-breath]').forEach(el=>{el.style.opacity=String(.72+.28*(.5+.5*Math.sin(actionAngle)));});
  this.element.querySelectorAll<HTMLElement>('[data-glow]').forEach((el,i)=>{const rgb=['116,143,252','255,107,107','255,212,59'][i%3],pulse=.5+.5*Math.sin(actionAngle);el.style.boxShadow=`0 0 ${36+pulse*18}px rgba(${rgb},${.07+pulse*.09}),0 30px 50px rgba(0,0,0,.25)`;const text=el.querySelector<HTMLElement>('strong');if(text)text.style.textShadow=`0 0 ${18+pulse*10}px rgba(${rgb},${.08+pulse*.13})`;});
  this.element.querySelectorAll<SVGElement>('[data-hazard]').forEach(el=>{el.style.opacity=String(.6+.4*(.5+.5*Math.sin(actionAngle)));el.style.strokeDashoffset=String(-actionProgress*180);});
  this.element.querySelectorAll<SVGPathElement>('[data-ecg]').forEach(el=>{const length=el.getTotalLength();el.style.strokeDasharray=`${length*.34} ${length*.66}`;el.style.strokeDashoffset=String(-actionProgress*length*2);});
  this.element.querySelectorAll<HTMLElement>('[data-flow]').forEach((el,i)=>{const p=(actionProgress+i*.225)%1;el.style.transform=`translateY(${p*40}px)`;el.style.opacity=String(Math.sin(p*Math.PI)*eventEnvelope);});
  this.element.querySelectorAll<HTMLElement>('[data-token]').forEach((el,i)=>{const p=(actionProgress+i*.11)%1;el.style.opacity=String(Math.sin(p*Math.PI)*.6*eventEnvelope);el.style.transform=`translateY(${-p*160}px)`;});
  this.narrative?.render(t);
  if(this.renderer&&!this.fallback){
   this.particle?.position.set(this.origin.x,this.origin.y,this.origin.z);
   const hidden=cue.kind==='placeholder';if(this.particle)this.particle.visible=!hidden;
   for(let i=0;i<this.positions.length/3;i++){
    const a=i*4,b=i*3,phi=this.seeds[a+3];
    this.positions[b]=this.seeds[a]+Math.sin(angle+phi)*20;
    this.positions[b+1]=this.seeds[a+1]+Math.cos(angle+phi)*15;
    this.positions[b+2]=this.seeds[a+2]+(t<2.1&&cue.motion==='push'?(1-t/2.1)*650:0);
   }
   this.particle?.geometry.attributes.position && (this.particle.geometry.attributes.position.needsUpdate=true);
   this.renderer.render(this.scene,this.camera);
  }
 }
 state(){return {motionTiming:this.narrative?{period:this.narrative.period,activeDuration:this.narrative.activeDuration,actionEnd:this.narrative.actionEnd,rest:this.narrative.rest}:null,fallback:this.fallback,cameraZ:this.cameraState.z,cameraX:this.cameraState.x,cameraYaw:THREE.MathUtils.radToDeg(this.camera.rotation.y),cameraPitch:THREE.MathUtils.radToDeg(this.camera.rotation.x),cameraRoll:THREE.MathUtils.radToDeg(this.camera.rotation.z),worldCamera:{x:this.camera.position.x,y:this.camera.position.y,z:this.camera.position.z},place:this.place?.place.name||'placeholder',placeId:this.place?.place.id||null,placeAnchor:this.journey?.end,journey:{progress:this.journey?.progress.value??1,distance:this.journey?.distance||0,route:this.journey?.place.route,active:!!this.journey?.active},fov:this.camera.fov,backgroundLayers:this.place?.planes.length||0,travelGates:this.journey?.gates.length||0,retainedSets:this.retired.length+(this.place?1:0),nativeText3D:true,particles:this.particle?.visible?180:0,models:0,drawCalls:this.renderer?.info.render.calls||0};}
 dispose(){this.timeline?.kill();this.narrative?.dispose();this.canvas.removeEventListener('webglcontextlost',this.contextLost);this.clearOutgoing();this.place?.dispose();this.retired.forEach(({set})=>set.dispose());this.journey?.dispose();this.cssScene.clear();this.particle?.geometry.dispose();(this.particle?.material as THREE.Material|undefined)?.dispose();this.renderer?.dispose();this.environmentHost.remove();this.css.domElement.remove();this.exitRenderer.domElement.remove();}
}
