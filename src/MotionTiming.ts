import type {Visual} from './content';

export const LOOP_REST_SECONDS=2.5;
/** Duration of each narrative event, followed by a quiet 2.5-second rest. */
export const actionSeconds:Record<Visual,number>={
 opening:3.6,biology:3.6,question:3.5,art:2.9,poetry:3,flamingo:2.9,
 attribution:3.5,individual:4.5,diversity:4.5,tensor:3,protein:4,
 strategy:3.4,frontier:3,'frontier-data':3.5,mushroom:2.9,chat:2.9,
 empathy:2.9,tokens:3.2,tessa:3,gate:3.3,case:2.45,liability:2.7,
 synergy:2.45,design:3.3,outage:3.3,oversight:3.3,formula:3.5,
 different:4,future:4,responsibility:4,thanks:4
};
export const loopDuration=(visual:Visual)=>actionSeconds[visual]+LOOP_REST_SECONDS;
