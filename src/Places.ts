import * as THREE from 'three';
import {CSS3DObject,CSS3DRenderer} from 'three/addons/renderers/CSS3DRenderer.js';
import type {Cue} from './content';
import {scenery,scenicProfile,type ScenicProfile} from './Scenery.ts';

export type PlaceName='confluence'|'gallery'|'atrium'|'laboratory'|'frontier'|'grove'|'listening'|'checkpoint'|'forum'|'observatory'|'horizon';
export type Point={x:number;y:number;z:number};
export type Place={id:string;name:PlaceName;anchor:Point;route:'walk'|'descend'|'threshold'|'rise';label:string};
const districts:Record<PlaceName,{anchor:Point;label:string}>={
 confluence:{anchor:{x:0,y:0,z:0},label:'Confluence hall'},
 gallery:{anchor:{x:5800,y:0,z:-1800},label:'Gallery of human experience'},
 atrium:{anchor:{x:11000,y:500,z:-3400},label:'Atrium of branching ideas'},
 laboratory:{anchor:{x:15400,y:500,z:-5500},label:'Calculation laboratory'},
 frontier:{anchor:{x:18000,y:-1300,z:-8900},label:'Edge of the frontier'},
 grove:{anchor:{x:15000,y:-1300,z:-12300},label:'Botanical grove'},
 listening:{anchor:{x:9200,y:-300,z:-15200},label:'Listening room'},
 checkpoint:{anchor:{x:14000,y:300,z:-18800},label:'Safety checkpoint'},
 forum:{anchor:{x:18800,y:650,z:-21800},label:'Forum of responsibility'},
 observatory:{anchor:{x:23000,y:1800,z:-25600},label:'Systems observatory'},
 horizon:{anchor:{x:28700,y:700,z:-29600},label:'Shared horizon'}
};
const visualPlaces:Record<string,PlaceName>={opening:'confluence',biology:'confluence',question:'confluence',art:'gallery',poetry:'gallery',flamingo:'gallery',attribution:'gallery',individual:'atrium',diversity:'atrium',tensor:'laboratory',protein:'laboratory',strategy:'laboratory',frontier:'frontier','frontier-data':'frontier',mushroom:'grove',chat:'listening',empathy:'listening',tokens:'listening',tessa:'checkpoint',gate:'checkpoint',case:'forum',liability:'forum',synergy:'observatory',design:'observatory',outage:'observatory',oversight:'observatory',formula:'horizon',different:'horizon',future:'horizon',responsibility:'horizon',thanks:'horizon'};
const chapterPlaces:PlaceName[]=['confluence','confluence','gallery','atrium','atrium','laboratory','grove','grove','listening','checkpoint','forum','forum','observatory','observatory','horizon','horizon'];
export function placeFor(cue:Cue):Place{
 const [chapter,beat]=cue.id.split('.').map(Number),name=visualPlaces[cue.visual||'']||chapterPlaces[chapter-1];
 const district=districts[name];
 const finale=chapter===16?6750:0;
 return {id:cue.id,name,label:district.label,anchor:{x:district.anchor.x+(beat-1)*1350+finale,y:district.anchor.y+(beat%2===0?120:0),z:district.anchor.z-(beat-1)*460-finale*.3},route:name==='frontier'?'descend':name==='checkpoint'?'threshold':name==='horizon'||name==='observatory'?'rise':'walk'};
}
const svg=(body:string)=>`<svg viewBox="-2400 -1350 4800 2700" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">${body}</svg>`;
const path=(d:string,cls='architecture')=>`<path class="${cls}" d="${d}"/>`;
const rect=(x:number,y:number,w:number,h:number,r=20,cls='architecture')=>`<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
function safeProjection(object:CSS3DObject,camera:THREE.PerspectiveCamera){
 object.updateWorldMatrix(true,false);const view=new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse,object.matrixWorld);
 return [[-1200,-675],[1200,-675],[-1200,675],[1200,675]].every(([x,y])=>new THREE.Vector3(x,y,0).applyMatrix4(view).z<-300);
}

export class PlaceSet {
 group=new THREE.Group();planes:CSS3DObject[]=[];renderers:CSS3DRenderer[]=[];scenes:THREE.Scene[]=[];opacity=1;groundOpacity=1;detail=1;readDetail:number;profile:ScenicProfile;
 place:Place;
 constructor(place:Place,host:HTMLElement,visual?:string){
  this.place=place;
  this.profile=scenicProfile(visual);this.readDetail={quiet:.2,balanced:.36,immersive:.6}[this.profile];
  this.group.position.set(place.anchor.x,place.anchor.y,place.anchor.z);
  [0,1,2,3].forEach(i=>{
   const el=document.createElement('div');el.className=`place-plane place-${place.name} place-layer-${i}`;el.dataset.place=place.id;el.dataset.district=place.name;el.dataset.profile=this.profile;el.setAttribute('aria-hidden','true');el.innerHTML=scenery(place.name,i);
   const plane=new CSS3DObject(el);
   if(i===0){plane.position.set(0,40,-1400);}
   if(i===1){plane.position.set(0,0,-620);plane.scale.setScalar(.82);}
   if(i===2){plane.position.set(0,0,250);plane.scale.setScalar(.65);}
   if(i===3){plane.position.set(0,-940,-500);plane.rotation.x=-Math.PI*.36;plane.scale.setScalar(.8);}
   plane.scale.multiplyScalar(2);
   plane.position.add(this.group.position);
   const scene=new THREE.Scene(),renderer=new CSS3DRenderer();scene.add(plane);renderer.setSize(1920,1080);renderer.domElement.className='place-renderer';host.appendChild(renderer.domElement);
   this.planes.push(plane);this.scenes.push(scene);this.renderers.push(renderer);
  });
 }
 render(angle:number,camera:THREE.PerspectiveCamera){
  this.planes.forEach((plane,i)=>{
   // Overlapping tilted floors confuse browser depth sorting when seeking across opacity=0.
   // Keep one ground plane; the old walls and path thresholds carry the departure.
   plane.element.style.opacity=String(this.opacity*this.detail*(i===0?.8:i===1?.6:i===2?.52:.3*this.groundOpacity));
   const el=plane.element,s=Math.sin(angle),c=Math.cos(angle);
   // A moving light belongs to the walls, leaves sway in the grove, signals belong to bridges.
   el.querySelectorAll<SVGElement>('.gallery-light,.listening-light,.horizon-light,.checkpoint-light,.light-rail,.entablature,.mint-rib,.human-rib').forEach((p,j)=>{p.style.opacity=String(.45+(.5+.5*Math.sin(angle-j*.6))*.25);});
   el.querySelectorAll<SVGElement>('.canopy').forEach((p,j)=>{p.style.transform=`translate(${s*(j%2?8:-8)}px,${c*4}px)`;});
   el.querySelectorAll<SVGElement>('[data-place-spore]').forEach((p,j)=>{p.style.transform=`translate(${Math.sin(angle+j)*30}px,${Math.cos(angle+j)*45}px)`;p.style.opacity=String(.3+.25*(.5+.5*Math.sin(angle+j)));});
   el.querySelectorAll<SVGElement>('[data-place-node]').forEach((p,j)=>{p.style.opacity=String(.25+.5*(.5+.5*Math.sin(angle-j*.7)));});
   el.querySelectorAll<SVGElement>('.scan-rail').forEach(p=>{p.style.transform=`translateY(${s*90}px)`;});
   el.querySelectorAll<SVGElement>('.hazard-rail').forEach(p=>{p.style.opacity=String(.45+.25*(.5+.5*s));});
   // Independent perspective contexts avoid history-dependent transparent-plane sorting.
   // Projection still uses the same world camera; painter order is explicit and seek-safe.
   const view=plane.position.clone().applyMatrix4(camera.matrixWorldInverse);
   this.renderers[i].domElement.style.zIndex=String(Math.round(100000+view.z));
   this.renderers[i].domElement.style.display=this.group.visible&&this.opacity>.001&&view.z<-750&&safeProjection(plane,camera)?'block':'none';
   this.renderers[i].render(this.scenes[i],camera);
  });
 }
 dispose(){this.group.removeFromParent();this.planes.forEach(p=>p.element.remove());this.renderers.forEach(r=>r.domElement.remove());}
}
export function bezier(a:Point,b:Point,c:Point,d:Point,t:number):Point{
 const k=1-t;return {x:k*k*k*a.x+3*k*k*t*b.x+3*k*t*t*c.x+t*t*t*d.x,y:k*k*k*a.y+3*k*k*t*b.y+3*k*t*t*c.y+t*t*t*d.y,z:k*k*k*a.z+3*k*k*t*b.z+3*k*t*t*c.z+t*t*t*d.z};
}
export class Journey {
 progress={value:1};start:Point;end:Point;controlA:Point;controlB:Point;gates:CSS3DObject[]=[];renderers:CSS3DRenderer[]=[];scenes:THREE.Scene[]=[];distance:number;active:boolean;place:Place;
 constructor(from:Point,place:Place,active:boolean,host:HTMLElement,direction:number){
  this.place=place;
  this.start={...from};this.end={...place.anchor};this.active=active;this.distance=Math.hypot(from.x-this.end.x,from.y-this.end.y,from.z-this.end.z);
  const delta={x:this.end.x-from.x,y:this.end.y-from.y,z:this.end.z-from.z};
  const bend=Math.min(1250,Math.max(420,this.distance*.19));
  this.controlA={x:from.x+delta.x*.18,y:from.y+delta.y*.12+(place.route==='descend'?400:place.route==='rise'?350:120),z:from.z+delta.z*.22+bend};
  this.controlB={x:from.x+delta.x*.78,y:from.y+delta.y*.78+(place.route==='descend'?-350:place.route==='rise'?300:-80),z:from.z+delta.z*.76+bend*.6};
  if(!active)return;
  this.progress.value=0;
  [.23,.48,.73].forEach((u,i)=>{
   const p=this.at(u),el=document.createElement('div');el.className=`journey-gate journey-${place.route}`;el.setAttribute('aria-hidden','true');
   el.innerHTML=svg(place.route==='descend'?path('M-2400-1200 V850 L-1400 1200 M2400-1200 V700 L1400 1200','route-wall'):place.route==='rise'?path('M-2400 950 H-1650 V-850 M2400 950 H1650 V-850','route-wall'):rect(-1950,-1220,3900,2440,place.route==='threshold'?100:360,'route-wall')+path('M-1950-820 V300 M1950-820 V300','route-light'));
   const gate=new CSS3DObject(el);gate.position.set(p.x,p.y,p.z+700);gate.rotation.y=THREE.MathUtils.degToRad(direction*(i-1)*8);
   gate.scale.setScalar(2);
   const scene=new THREE.Scene(),renderer=new CSS3DRenderer();scene.add(gate);renderer.setSize(1920,1080);renderer.domElement.className='place-renderer journey-renderer';host.appendChild(renderer.domElement);
   this.gates.push(gate);this.scenes.push(scene);this.renderers.push(renderer);
  });
 }
 at(u=this.progress.value){return this.active?bezier(this.start,this.controlA,this.controlB,this.end,u):this.end;}
 render(camera:THREE.PerspectiveCamera){const fade=this.progress.value<.9?1:Math.max(0,(1-this.progress.value)*10);this.gates.forEach((g,i)=>{
  g.element.style.opacity=String(fade*(.48+i*.07));const view=g.position.clone().applyMatrix4(camera.matrixWorldInverse);
  this.renderers[i].domElement.style.zIndex=String(Math.round(100000+view.z));this.renderers[i].domElement.style.display=fade>.001&&view.z<-750&&safeProjection(g,camera)?'block':'none';this.renderers[i].render(this.scenes[i],camera);
 });}
 dispose(){this.gates.forEach(g=>{g.removeFromParent();g.element.remove();});this.renderers.forEach(r=>r.domElement.remove());}
}
