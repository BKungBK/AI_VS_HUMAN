export type Role='player'|'host'|'display';
export type Side='HUMAN'|'AI'|'UNSELECTED';
export interface GroupScore {id:number;name:string;numerator:number;denominator:number}
export interface SwipeAssetView {id:string;path:string;width:number;height:number}
export interface SwipeReveal {
 round:number;imageId:string;path:string;width:number;height:number;classification:'HUMAN'|'AI';creator:string;provenance:string;sourceUrl:string;license:string;revealText:string;generationPrompt:string|null;
 answered:number;humanVotes:number;aiVotes:number;correctVotes:number;groupVotes:{groupId:number;groupName:string;human:number;ai:number;correct:number}[]
}
export interface SwipeSnapshot {
 contentVersion:string;assets:SwipeAssetView[];round:number;rounds:number;currentImageId:string|null;answered:number;rosterCount:number;myChoice:'HUMAN'|'AI'|null;
 revealed:boolean;revealStartedAt?:number|null;revealDeadline?:number|null;reveals:SwipeReveal[];myAnswers:{imageId:string;choice:'HUMAN'|'AI';correct:boolean}[]
}
export interface Snapshot {
 serverNow:number;role:Role;
 room:{code:string;cue:string;version:number;capacity:number;teamLocked:boolean;previewId:string;practiceId:string|null;practiceUntil:number|null;activeRunId:string|null;confirmedRunId:string|null};
 run:{id:string;gameId:string;status:string;phase:string;phaseToken:string;version:number;paused:boolean;remainingMs:number|null;deadline:number|null;phaseStart:number;contentVersion:string;scoringVersion:string}|null;
 groups:{id:number;name:string;members:number}[];
 sides:Partial<Record<Side,{taps:number;members:number}>>;
 scores:GroupScore[]|null;confirmedScores:GroupScore[]|null;
 swipe?:SwipeSnapshot|null;
 caption?:CaptionSnapshot|null;
 roulette?:RouletteSnapshot|null;
 whack?:WhackSnapshot|null;
 shield?:ShieldSnapshot|null;
 piece?:PieceSnapshot|null;
 me:{memberId:string;nickname:string;groupId:number;side:Side;sideRevision:number;ready:boolean;inRoster:boolean;lockedSide:Side|null;roster:{nickname:string}[];
 state:{accepted:number;last_sequence:number;input_epoch:number;writer_id:string|null}|null}|null;
 host:{controllerId:string|null;controllerEpoch:number;leaseUntil:number|null;unready:number;inputDigest:string|null;members:{id:string;nickname:string;groupId:number;side:Side;ready:boolean;online:boolean}[]}|null;
}
export interface CaptionSubmission {id:string;text:string;revision:number;submitted:boolean;decision:'PENDING'|'APPROVED'|'REJECTED'|'WITHHELD';reason:string|null;lockedRevision:number|null}
export interface CaptionReview extends CaptionSubmission {reviewVersion:number;author:string;groupId:number}
export interface CaptionResult {id:string;text:string;position:number;groupId:number|null;groupName:string;author:string;votes:number;support:number;supportExact:string;score:number;winner:boolean}
export interface CaptionSnapshot {
 contentVersion:string;imagePath:string;imageAlt:string;task:string;rosterCount:number;submittedCount:number;pendingCount:number|null;contentApproved:boolean;
 aiCaption:string|null;aiMetadata:{prompt:string;model:string;generatedAt:string;selectionMethod:string;imageOrigin:string}|null;
 ownSubmission:CaptionSubmission|null;internalCandidates:{id:string;text:string;author:string}[];
 finalCandidates:{id:string;text:string;position:number;ownGroup:boolean|null}[];reviewQueue:CaptionReview[];revealed:boolean;results:CaptionResult[];
 internalVote:{candidateId:string;revision:number}|null;finalVote:{candidateId:string;revision:number}|null;
}

export type RouletteLifeState = 'ALIVE' | 'DEAD';
export type RouletteChoice = 'BELIEVE' | 'DOUBT';
export type RouletteRoundPhase = 'COUNTDOWN' | 'ANSWERING' | 'REVEAL' | 'TRANSITION' | 'RESULT' | 'PREVIEW';

export interface RouletteRoundInfo {
 roundNo: number;
 title: string;
 contextText: string;
 claimText: string;
 confidence: number;
 imagePath: string | null;
 isFinalRisk: boolean;
 isCorrect?: boolean | null;
 explanation?: string | null;
}

export interface RouletteRoundHistory {
 roundNo: number;
 title: string;
 claimText: string;
 confidence: number;
 isCorrect: boolean;
 explanation: string;
 isFinalRisk: boolean;
 totalAlive: number;
 totalDeaths: number;
}

export interface RoulettePlayerState {
 lifeState: RouletteLifeState;
 score: number;
 eliminatedAtRound: number | null;
 eliminatedReason: string | null;
 currentChoice: RouletteChoice | null;
 myAnswers: {
  roundNo: number;
  choice: RouletteChoice;
  acceptedAt: string;
 }[];
}

export interface RouletteGroupSurvival {
 groupId: number;
 groupName: string;
 alive: number;
 total: number;
 totalScore: number;
}

export interface RouletteSnapshot {
 contentVersion: string;
 round: number;
 totalRounds: number;
 roundPhase: RouletteRoundPhase;
 currentRound: RouletteRoundInfo | null;
 myState: RoulettePlayerState | null;
 pastRounds: RouletteRoundHistory[];
 groupSurvival: RouletteGroupSurvival[];
 revealed: boolean;
 stats: {
  rosterCount: number;
  aliveCount: number;
  deadCount: number;
  answeredCount: number;
 };
}

export type WhackPhase = 'PREVIEW' | 'COUNTDOWN' | 'PLAYING' | 'RESULT';

export interface WhackBubbleItem {
 bubbleId: string;
 slot: number;
 text: string;
 spawnAtSec: number;
 expiresAtSec: number;
 classification?: 'STOP' | 'PASS' | null;
 explanation?: string | null;
}

export interface WhackHitReceipt {
 bubbleId: string;
 hitAt: string;
 isCorrect?: boolean | null;
}

export interface WhackPlayerState {
 correctHits: number;
 wrongHits: number;
 rawScore: number;
 score: number;
 hits: WhackHitReceipt[];
}

export interface WhackBubbleHitStat {
 bubbleId: string;
 totalHits: number;
}

export interface WhackRoomStats {
 rosterCount: number;
 totalHits: number;
 totalCorrectHits: number;
 totalWrongHits: number;
 missedRiskCount: number;
 bubbleHits: WhackBubbleHitStat[];
}

export interface WhackComparisonPair {
 teachingPoint: string;
 stopBubble: {
  bubbleId: string;
  text: string;
  classification: 'STOP';
  explanation: string;
 };
 passBubble: {
  bubbleId: string;
  text: string;
  classification: 'PASS';
  explanation: string;
 };
}

export interface WhackSnapshot {
 contentVersion: string;
 phase: WhackPhase;
 contextBanner: string;
 bubbles: WhackBubbleItem[];
 myState: WhackPlayerState | null;
 revealed: boolean;
 keyPairs?: WhackComparisonPair[] | null;
 stats: WhackRoomStats;
}

// Game 6: Company Shield Contracts
export type ShieldPhase = 'PREVIEW' | 'COUNTDOWN' | 'PLAYING' | 'RESULT';

export interface ShieldPacketItem {
 packetId: string;
 packetNo: number;
 aimAtSec: number;
 railAtSec: number;
 customerAtSec: number;
 targetLane: number; // 0: Left, 1: Center, 2: Right
 botClaim: string;
 companyTask: string;
 customerName: string;
}

export type ShieldInterceptStatus = 'BLOCKED' | 'MISSED';

export interface ShieldInterceptReceipt {
 packetId: string;
 status: ShieldInterceptStatus;
 lane: number;
 evaluatedAt: string;
 points: number; // 50 if BLOCKED, 0 if MISSED
}

export interface ShieldPlayerState {
 currentLane: number;
 normalizedX: number;
 blockedCount: number;
 missedCount: number;
 score: number; // blockedCount * 50 (max 500)
 intercepts: ShieldInterceptReceipt[];
}

export interface ShieldPacketStat {
 packetId: string;
 blockedCount: number;
 missedCount: number;
}

export interface ShieldRoomStats {
 rosterCount: number;
 totalPacketsBlocked: number;
 totalPacketsMissed: number;
 customerTrustSlots: number;
 packetStats: ShieldPacketStat[];
}

export interface ShieldSnapshot {
 contentVersion: string;
 phase: ShieldPhase;
 contextBanner: string;
 packets: ShieldPacketItem[];
 myState: ShieldPlayerState | null;
 revealed: boolean;
 stats: ShieldRoomStats;
}


export type PiecePhase = 'PREVIEW' | 'COUNTDOWN' | 'DRAWING' | 'REVIEW_REQUIRED' | 'INTERNAL_VOTE' | 'FINAL_VOTE' | 'RESULT';

export interface PiecePoint {
  x: number; // 0.0 to 1.0
  y: number; // 0.0 to 1.0
}

export interface PieceStroke {
  color: string;
  width: number;
  points: PiecePoint[];
}

export interface PieceArtwork {
  id: string;
  strokes: PieceStroke[];
  strokeCount: number;
  revision: number;
  lockedRevision: number | null;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHHELD';
  reason?: string | null;
  author?: string;
  groupId?: number;
  isMe?: boolean;
}

export interface PieceCandidate {
  id: string;
  position: number;
  groupId: number;
  strokes: PieceStroke[];
  artworkId: string;
}

export interface PieceResult {
  id: string;
  position: number;
  groupId: number;
  artworkId: string;
  author: string;
  groupName: string;
  votes: number;
  support: number;
  supportExact: string;
  supportNumerator: number;
  supportDenominator: number;
  score: number;
  winner: boolean;
  strokes: PieceStroke[];
}

export interface PieceSnapshot {
  version: string;
  prompt: string;
  task: string;
  baseAssetId: string;
  baseSvg: string;
  metadata: {
    title: string;
    description: string;
    drawingZones: {
      left: {x: number; y: number; width: number; height: number; label: string};
      right: {x: number; y: number; width: number; height: number; label: string};
    };
  };
  phase: PiecePhase;
  myArtwork: PieceArtwork | null;
  myInternalVote: string | null;
  myFinalVote: string | null;
  internalArtworks: PieceArtwork[];
  candidates: PieceCandidate[];
  results: PieceResult[];
  moderation: PieceArtwork[];
  moderationStats: {
    pending: number;
    approved: number;
    submitted: number;
  };
}
