import fs from 'node:fs/promises';
import {allCues} from '../src/content.ts';
import {actionSeconds,LOOP_REST_SECONDS} from '../src/MotionTiming.ts';
import {narrativeIntent} from '../src/NarrativeMotion.ts';
let story=await fs.readFile('docs/storyboard.md','utf8');
let table='# Card rhythm — current reading motion\n\nAll content cards have gentle independent drift and a moving ambient material light. Headlines stay fixed after arrival. Narrative actions rest for 2.5 seconds; a few authored settling intervals extend that pause by less than 0.5 seconds. Game, score and award placeholders stay plain. Human nerve impulses travel along thirteen vector branches. ECG is attached above its card and sized to the available width.\n\n| Cue | Visual | Active window (s) | Rest (s) | Period (s) | Narrative purpose |\n|---|---|---:|---:|---:|---|\n';
for(const {cue} of allCues){
 if(cue.kind!=='content')continue;
 table+=`| ${cue.id} | ${cue.visual} | ${actionSeconds[cue.visual]} | ${LOOP_REST_SECONDS} | ${cue.loop} | ${narrativeIntent[cue.visual]} |\n`;
 const heading=new RegExp(`(### ${cue.id.replace('.','\\.')} ·[\\s\\S]*?- Hold: )[^\\n]*`);
 story=story.replace(heading,(_,prefix)=>`${prefix}gentle card drift and ambient material light; narrative window ${actionSeconds[cue.visual]}s, then ${LOOP_REST_SECONDS}s rest; full phase repeats every ${cue.loop}s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.`);
}
story=story.replace('เสียง: ไม่มีทุกคิว.','เสียง: เอฟเฟกต์เข้า/เดินทาง/ลงจอดหลังเปิดเสียงหนึ่งครั้ง แล้วเงียบระหว่างอ่านตามค่าตั้งต้น. ดู docs/sound-direction.md.');
await fs.writeFile('docs/storyboard.md',story);await fs.writeFile('docs/card-rhythm-map.md',table);
console.log('UPDATED storyboard and 31-cue rhythm map');
