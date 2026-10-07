import type {PlaceName} from './Places';

const path=(d:string,cls='architecture')=>`<path class="${cls}" d="${d}"/>`;
const rect=(x:number,y:number,w:number,h:number,r=60,cls='surface')=>`<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
const svg=(body:string)=>`<svg viewBox="-2400 -1350 4800 2700" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">${body}</svg>`;

/** Broad peripheral masses establish places. Reading is protected in screen space. */
export function scenery(name:PlaceName,layer:number){
 const far=layer===0,near=layer===2;
 if(layer===3)return svg(path('M-2100 1350 L-400-1100 H400 L2100 1350Z','floor-surface')+path(name==='grove'?'M-1900 1150 Q-250 80-180-1100 M1900 1150 Q250 80 180-1100':'M-2050 1250 L-400-1100 M2050 1250 L400-1100','floor-edge')+path('M-1800 900 H1800 M-1350 260 H1350','floor-rule'));
 if(near)return svg(name==='frontier'?path('M-2400 700 L-1880 920 L-1500 1350 H-2400Z M2400 560 L1950 880 L1530 1350 H2400Z','rock-face'):name==='grove'?path('M-2300 1350 Q-1900 0-2100-1350 M2300 1350 Q1900 0 2100-1350','canopy'):rect(-2400,-1350,570,2700,100,'near-wing')+rect(1830,-1350,570,2700,100,'near-wing'));
 switch(name){
  case 'confluence':return svg(path('M-2400 1350 V-700 Q-2000-1400-1520-950 V1350Z','surface')+path('M2400 1350 V-700 Q2000-1400 1520-950 V1350Z','surface')+path('M-1520-700 V800','human-rib')+path('M1520-700 V800','light-rail')+(far?path('M-1500-950 Q0-1300 1500-950','ceiling-cove'):''));
  case 'gallery':return svg(rect(-2180,-930,820,2050,55,'surface')+rect(1360,-930,820,2050,55,'surface')+rect(-2070,-760,600,1240,20,'inset-plane')+rect(1470,-760,600,1240,20,'inset-plane')+path('M-2100-870 H-1440 M1440-870 H2100','gallery-light')+(far?path('M-2400 1050 H2400','ground-curve'):''));
  case 'atrium':return svg(path('M-2350 1350 V0 Q-1980-520-1530-1110 L-1120-1350 M2350 1350 V0 Q1980-520 1530-1110 L1120-1350','branch-surface')+path('M-2100 1100 V100 Q-1880-540-1280-1000 M2100 1100 V100 Q1880-540 1280-1000','mint-rib'));
  case 'laboratory':return svg(rect(-2280,-1120,880,2200,35,'surface')+rect(1400,-1120,880,2200,35,'surface')+rect(-2120,-850,560,340,24,'lab-cell')+rect(1560,-850,560,340,24,'lab-cell')+path('M-2110-180 H-1570 M1570-180 H2110','scan-rail')+path('M-2110 670 H-1570 M1570 670 H2110','light-rail'));
  case 'frontier':return svg(path(far?'M-2400 980 L-1770 620 L-1150 840 L-530 380 L0 690 L460 480 L1140 820 L1770 550 L2400 880 V1350 H-2400Z':'M-2400 1180 L-1520 1020 L-600 1200 L0 980 L550 1240 L1640 950 L2400 1080 V1350 H-2400Z','rock-face')+path('M-2400 1180 L-1520 1020 L-600 1200 L0 980 L550 1240 L1640 950 L2400 1080','hazard-rail'));
  case 'grove':return svg(path('M-1850 1350 Q-1500 160-1850-1230 M1850 1350 Q1500 160 1850-1230','trunk-surface')+path('M-1810-900 Q-2350-1190-2380-420 Q-2100-300-1810-900 M1810-900 Q2350-1190 2380-420 Q2100-300 1810-900','canopy')+'<circle class="spore" data-place-spore="0" cx="-1500" cy="-450" r="9"/><circle class="spore" data-place-spore="1" cx="1620" cy="-50" r="7"/>'+path('M-2400 1100 Q0 780 2400 1100','ground-curve'));
  case 'listening':return svg(path('M-2400 1350 Q-1570 240-1980-1350 H-2400Z M2400 1350 Q1570 240 1980-1350 H2400Z','soft-wall')+path('M-1810 800 Q-1500 200-1720-900 M1810 800 Q1500 200 1720-900','listening-light'));
  case 'checkpoint':return svg(rect(-2400,-1350,880,2700,140,'surface')+rect(1520,-1350,880,2700,140,'surface')+path('M-1460-820 V800 M1460-820 V800','checkpoint-light')+(far?path('M-1500-1030 Q0-1290 1500-1030','ceiling-cove'):''));
  case 'forum':return svg(rect(-2320,-1180,650,2530,20,'column-mass')+rect(1670,-1180,650,2530,20,'column-mass')+path('M-2100-1110 H-1670 M1670-1110 H2100','entablature')+(far?path('M-2400-1200 Q0-1440 2400-1200','ceiling-cove'):''));
  case 'observatory':return svg(path('M-2400 1090 L-1600 430 L-1000 430 L-450-80 L0-80 L800-720 L2400-720','bridge')+path('M-2200 1350 V-1180 M2200 1350 V-1180','support-cable')+'<circle class="signal-node" data-place-node="0" cx="-1600" cy="430" r="18"/><circle class="signal-node" data-place-node="1" cx="800" cy="-720" r="18"/>');
  case 'horizon':return svg(path(far?'M-2400 1100 Q-1200 260 0 880 Q1300 380 2400 1080 V1350 H-2400Z':'M-2400 1210 Q-1000 850 0 1200 Q1400 770 2400 1210 V1350 H-2400Z','horizon-land')+path('M-2400 880 Q0 670 2400 880','horizon-light'));
 }
}

export type ScenicProfile='quiet'|'balanced'|'immersive';
export function scenicProfile(visual?:string):ScenicProfile{
 if(['question','poetry','attribution','frontier-data','empathy','tokens','gate','case','liability','synergy','design','outage','oversight','formula'].includes(visual||''))return 'quiet';
 if(['art','flamingo','protein','frontier','mushroom','different','future','responsibility','thanks'].includes(visual||''))return 'immersive';
 return 'balanced';
}
