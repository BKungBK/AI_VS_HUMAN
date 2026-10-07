import fs from 'node:fs/promises';
import {allCues} from '../src/content.ts';
import {scoreFor} from '../src/SoundScore.ts';
const rows=allCues.map((x,i)=>({cue:x.cue.id,title:x.cue.title.replaceAll('\n',' '),...scoreFor(x.cue,{hasExit:i>0,journey:i>0&&x.cue.kind==='content',direction:1})}));
await fs.writeFile('docs/sound-map.json',JSON.stringify({note:'Forward sequential cue plans. Live plans also inspect the actual camera journey. Full motion is consistent across system preferences.',rows},null,2));
let md='# ตารางเสียง 43 คิว\n\nเวลาเริ่มเสียงนับจากเริ่มคิว. ตารางนี้เป็นการเดินคิวไปข้างหน้าตามลำดับ; runtime ใช้เส้นทางกล้องจริง. ค่าเริ่มต้นเปิดเฉพาะเอฟเฟกต์หลังผู้ควบคุมกดเปิดเสียง โดยบรรยากาศเป็นตัวเลือก\n\n| คิว | หัวข้อ | สถานที่ | เอฟเฟกต์ @ วินาที | ลูป (เมื่อเปิด) |\n|---|---|---|---|---|\n';
rows.forEach(r=>md+=`| ${r.cue} | ${r.title} | ${r.place||'ข้อความกลางจอ'} | ${r.events.map(e=>`${e.asset} @ ${e.at.toFixed(2)}`).join(' · ')} | ${r.place?'8 s; fade เข้า 2.8 s':'ไม่มี'} |\n`);
await fs.writeFile('docs/sound-cue-sheet.md',md);
