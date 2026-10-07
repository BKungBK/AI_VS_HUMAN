const uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const id=(v:unknown)=>typeof v==='string'&&uuid.test(v);
const text=(v:unknown)=>typeof v==='string'&&v.length>0&&v.length<=200;
const integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=2147483647;
const group=(v:unknown)=>integer(v)&&Number(v)>=1&&Number(v)<=8;
type Rule=(v:unknown)=>boolean;
const schemas:Record<string,Record<string,Rule>>={
 join:{nickname:v=>typeof v==='string'&&[...v.trim()].length>=1&&[...v.trim()].length<=24,groupId:group},
 side:{previewId:id,side:v=>v==='HUMAN'||v==='AI',expectedRevision:integer},
 ready:{previewId:id,contentVersion:v=>v==='trust-tug-v1'||v==='swipe-court-v1'||v==='caption-battle-v1'||v==='roulette-v1'||v==='whack-a-mole-v1'||v==='shield-v1'||v==='piece-v1'},group:{groupId:group},leave:{},
 writer:{runId:id,writerId:text},
 tap:{runId:id,phaseToken:id,writerId:text,inputEpoch:integer,events:v=>Array.isArray(v)&&v.length>=1&&v.length<=20&&v.every(e=>e&&id(e.id)&&integer(e.sequence)&&e.sequence>0)&&new Set(v.map(e=>e.id)).size===v.length},
 answer:{runId:id,phaseToken:id,imageId:v=>typeof v==='string'&&/^sc-[a-f\d]{8}$/.test(v),choice:v=>v==='HUMAN'||v==='AI'},
 'roulette-decision':{runId:id,phaseToken:id,round:integer,choice:v=>v==='BELIEVE'||v==='DOUBT'},
 'whack-hit':{runId:id,phaseToken:id,bubbleId:v=>typeof v==='string'&&v.length>0&&v.length<=64,clientTimeMs:integer},
 'shield-move':{runId:id,phaseToken:id,lane:v=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<=2,normalizedX:v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1,clientTimeMs:integer},
 'piece-stroke':{runId:id,phaseToken:id,strokes:v=>Array.isArray(v)&&v.length<=100,revision:v=>integer(v)&&Number(v)>0,clientTimeMs:integer},
 'piece-finish-early':{runId:id,phaseToken:id},
 'piece-moderation':{runId:id,phaseToken:id,artworkId:id,decision:v=>['APPROVED','REJECTED','WITHHELD'].includes(String(v)),reason:v=>typeof v==='string'&&v.length<=200},
 'piece-approve-all':{runId:id,phaseToken:id,reviewedArtworkIds:v=>Array.isArray(v)&&v.length<=256&&v.every(id)&&new Set(v).size===v.length},
 'piece-open-internal-vote':{runId:id,phaseToken:id},
 'piece-open-final-vote':{runId:id,phaseToken:id},
 'piece-internal-vote':{runId:id,phaseToken:id,candidateId:id,revision:v=>integer(v)&&Number(v)>0},
 'piece-final-vote':{runId:id,phaseToken:id,candidateId:id,revision:v=>integer(v)&&Number(v)>0},
 'piece-reveal':{runId:id,phaseToken:id},
 caption:{runId:id,phaseToken:id,text:v=>typeof v==='string'&&v.length<=1600,revision:v=>integer(v)&&Number(v)>0,submitted:v=>typeof v==='boolean'},
 'internal-vote':{runId:id,phaseToken:id,candidateId:id,revision:v=>integer(v)&&Number(v)>0},
 'final-vote':{runId:id,phaseToken:id,candidateId:id,revision:v=>integer(v)&&Number(v)>0},
 moderation:{runId:id,phaseToken:id,submissionId:id,lockedRevision:v=>integer(v)&&Number(v)>0,expectedReviewVersion:integer,decision:v=>['APPROVED','REJECTED','WITHHELD'].includes(String(v)),reason:v=>typeof v==='string'&&v.length<=200},
 'caption-content-approve':{},'caption-open-vote':{runId:id,phaseToken:id},
 acquire:{controllerId:text},heartbeat:{controllerId:text,controllerEpoch:integer},
 practice:{},start:{timingProfile:v=>v==='normal'||v==='compact'},pause:{},resume:{},
 finish:{inputDigest:text},cancel:{reason:text},replay:{reason:text},cue:{cue:v=>typeof v==='string'&&/^\d{2}\.\d{2}$/.test(v)},
 rename:{groupId:group,name:v=>typeof v==='string'&&v.trim().length>=1&&v.trim().length<=32},
 move:{memberId:id,groupId:group,reason:text}
};
export function validateCommand(kind:string,p:Record<string,unknown>):boolean {
 const base=schemas[kind];if(!base)return false;
 const rules={...base};
 if(['practice','start','pause','resume','finish','cancel','replay','cue','rename','move','moderation','caption-content-approve','caption-open-vote','piece-moderation','piece-approve-all','piece-open-internal-vote','piece-open-final-vote','piece-reveal'].includes(kind)) Object.assign(rules,{controllerId:text,controllerEpoch:integer,expectedVersion:integer});
 const optional=kind==='acquire'?['reason']:[];
 return Object.entries(rules).every(([key,rule])=>rule(p[key]))&&Object.keys(p).every(key=>key in rules||optional.includes(key))&&(!('reason' in p)||kind==='moderation'||kind==='piece-moderation'||text(p.reason));
}
