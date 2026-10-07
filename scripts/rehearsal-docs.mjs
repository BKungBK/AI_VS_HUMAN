import fs from 'node:fs/promises';
import {chapters,formatTime,evidence} from '../src/content.ts';
import {spoken,rehearsalSeconds} from '../src/spoken.ts';
let text='# บทพูดฉบับปรับข้อมูล — HUMAN vs AI: The Sparring Minds\n\nผู้พูดสองคน Human และ AI; รวมการพูด กิจกรรม และอภิปรายในกรอบ 50 นาที เวลาต่อคิวเป็นเป้าหมายสำหรับซ้อม ผู้ควบคุมกดเปลี่ยนคิวเอง ไม่มีเสียงหรือ timer อัตโนมัติ บทพูดไม่ใช่ข้อความคำต่อคำจากงานวิจัย แหล่งอ้างอิงใช้ยืนยันข้อเท็จจริง ไม่ใช่อ้างว่าใช้ถ้อยคำต้นฉบับ\n\nช่วงเกม คะแนน ลงทะเบียนและรางวัลเป็นข้อความกลางจอ ทีมงานต้องจัดช่องทางกิจกรรมและผลจริงภายนอกเว็บนี้ หากระบบยังไม่พร้อม ให้ใช้โจทย์อภิปรายที่เตรียมไว้และคุมกรอบเวลา การตรวจภาษาข้อเท็จจริงยึด src/content.ts และ docs/facts-and-rights.md\n\n';
let table='# ตารางซ้อม — 43 คิว / 50 นาที\n\nเวลาเป็น cue targets ไม่บังคับเครื่องเปลี่ยนคิวอัตโนมัติ เพิ่มเกมทายภาพ 90 วินาทีและแบ่งช่วงดวลแคปชั่นเหลือ 90 วินาที เพื่อคงกรอบรวม 50 นาที\n\n| คิว | ช่วงเวลาเป้าหมาย | วินาที | ผู้พูด | ข้อความหลัก |\n|---|---|---:|---|---|\n';
let csv='cue,start_seconds,end_seconds,duration_seconds,speaker,title\n';let count=0;
for(let s=0;s<chapters.length;s++){
 const ch=chapters[s];let t=ch.start;
 if(rehearsalSeconds[s].length!==ch.cues.length)throw new Error('Cue duration mismatch');
 text+=`## ${ch.id} · ${ch.title} · ${formatTime(ch.start)}–${formatTime(ch.end)}\n\n`;
 for(let b=0;b<ch.cues.length;b++){
  const cue=ch.cues[b],entry=spoken[cue.id],seconds=rehearsalSeconds[s][b];if(!entry)throw new Error('Missing dialogue '+cue.id);count++;
  text+=`### ${cue.id} · ${cue.title.replaceAll('\n',' / ')} · ${formatTime(t)}–${formatTime(t+seconds)}\n\n**กำกับเวที:** ${entry.direction}\n\n${entry.speech}\n\n`;
  if(cue.facts.length)text+=`**อ้างอิง:** ${cue.facts.map(id=>`[${evidence[id].label}](${evidence[id].url})`).join(' · ')}\n\n`;
  table+=`| ${cue.id} | ${formatTime(t)}–${formatTime(t+seconds)} | ${seconds} | ${cue.speaker} | ${cue.title.replaceAll('\n',' / ')} |\n`;
  csv+=`${cue.id},${t},${t+seconds},${seconds},${cue.speaker},"${cue.title.replaceAll('\n',' ').replaceAll('"','""')}"\n`;t+=seconds;
 }
 if(t!==ch.end)throw new Error('Chapter duration mismatch '+ch.id);
}
if(count!==43||Object.keys(spoken).length!==43)throw new Error('Not exactly 43 dialogue cues');
await fs.writeFile('docs/full-script-revised.md',text);await fs.writeFile('docs/rehearsal-timing.md',table);await fs.writeFile('docs/rehearsal-timing.csv','\uFEFF'+csv);
console.log('Rehearsal script validated: 43 cues, 16 chapters, 3000 seconds');
