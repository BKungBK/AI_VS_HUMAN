import type {Cue} from './content';
import {placeFor,type PlaceName} from './Places.ts';

export const soundAssets={departure:.5,'travel-walk':1.65,'travel-descend':1.65,'travel-threshold':1.65,'travel-rise':1.65,glass:.62,human:.7,ai:.7,duet:1.25,gallery:1.05,atrium:1.05,laboratory:1.05,frontier:1.1,grove:1.05,listening:1.1,checkpoint:.95,forum:.95,observatory:1.1,horizon:1.7,placeholder:.25} as const;
export type SoundName=keyof typeof soundAssets;
export type SoundEvent={asset:SoundName;at:number;gain:number;pan:number;panEnd?:number;duration:number;role:'departure'|'travel'|'arrival'|'title'};
export type SoundPlan={cue:string;place:PlaceName|null;events:SoundEvent[];loop:number;ambientStart:number;journey:boolean;direction:number};
const tone:Record<PlaceName,SoundName>={confluence:'duet',gallery:'gallery',atrium:'atrium',laboratory:'laboratory',frontier:'frontier',grove:'grove',listening:'listening',checkpoint:'checkpoint',forum:'forum',observatory:'observatory',horizon:'horizon'};

/** The sound clock is cue time, the same clock as the paused GSAP camera. */
export function scoreFor(cue:Cue,options:{hasExit?:boolean;journey?:boolean;direction?:number}={}):SoundPlan{
 const {hasExit=false,journey=false,direction=1}=options;
 const place=cue.kind==='content'?placeFor(cue).name:null,events:SoundEvent[]=[];
 const add=(asset:SoundName,at:number,gain:number,role:SoundEvent['role'],pan=0)=>events.push({asset,at,gain,role,pan,duration:soundAssets[asset]});
 if(!place){add('placeholder',hasExit?.18:0,.24,'title');return {cue:cue.id,place:null,events,loop:0,ambientStart:0,journey:false,direction};}
 if(hasExit)add('departure',0,.3,'departure',-direction*.06);
 if(journey){add(`travel-${placeFor(cue).route}`,.16,.48,'travel',-direction*.12);events[events.length-1].panEnd=direction*.12;}
 const arrival=journey?1.72:hasExit?.62:.32;
 // One quiet landing cue after the flight; avoid stacking a second glass ping.
 add(tone[place],arrival,place==='grove'?.3:place==='frontier'||place==='checkpoint'?.32:.38,'arrival',direction*.06);
 return {cue:cue.id,place,events,loop:8,ambientStart:2.8,journey,direction};
}

export const places:PlaceName[]=['confluence','gallery','atrium','laboratory','frontier','grove','listening','checkpoint','forum','observatory','horizon'];
export const audioFiles=[...Object.keys(soundAssets),...places.map(p=>`ambient-${p}`)];
export const audioPath=(name:string)=>`/assets/audio/${name}.wav`;
