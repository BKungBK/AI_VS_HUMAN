# ผลตรวจระบบเสียง · 6 ตุลาคม 2026

## ผลรุ่นล่าสุด

| รายการ | ผล |
|---|---|
| Production build React/TypeScript/Vite | PASS; มีคำเตือนขนาด JS bundle 912.13 kB ก่อน gzip / 257.81 kB gzip ไม่มีข้อผิดพลาด build |
| Browser audio cases | 33/33 PASS |
| 42 cue mixes 48 kHz stereo | 42/42 PASS; peak สูงสุด -12.40 dBFS |
| PCM/loop/mono/reading silence/speech-space | 4/4 PASS |
| Ambient loop joins | 11/11 PASS; seam เป็น adjacent sample ตามปกติของ periodic signal |
| Mono compatibility | 42/42 PASS; mono RMS เกิน 80% ของ stereo RMS |
| เอฟเฟกต์หลัง 3.5 s ในค่าเริ่มต้น | 42/42 เป็น PCM silence |
| Speaker-space EQ | ย่าน 900–3000 Hz ของตัวอย่างลด -6.00 dB; fixed EQ ไม่มีการอ่านไมโครโฟน |
| เปลี่ยนคิวรัวพร้อม ambience | PASS; สูงสุด 6 tracked voices; ไม่มีการต่ออายุ tail ที่ยกเลิกแล้ว |
| Repeat render | PASS ภายใน 1 ขั้น PCM16 / 0.1% sample tolerance; ไม่อ้างว่าเหมือนทุก byte |
| วิดีโอพร้อมเสียง | 24 s / 1280×720 / 30 fps / 720 frames / H.264 + stereo AAC; full video/audio decode PASS |
| Navigation/layout/fonts/images/local playback | 65/65 PASS |
| Camera/place/type regression | 33/33 PASS |
| Fullscreen/presenter/reduced/WebGL/final | 15/15 PASS |
| Contrast ทั้ง 42 คิว | PASS ต่ำสุด 10.059:1; ไม่มีการเปลี่ยนเลย์เอาต์เนื้อหา |

เสียง 31 ไฟล์สังเคราะห์ต้นฉบับ ไม่มีตัวอย่างเสียงของบุคคลอื่น. Native in-app browser โหลดเวอร์ชันใหม่ เปิดเสียงได้ ตั้งค่า 65% / speech-space เปิด / ambience ปิด พร้อมรักษาคิวที่ผู้ใช้กำลังดู. เว็บใช้ engine เสียงตัวเดียวที่จอฉายและรับคำสั่งจาก presenter

## สิ่งที่ตรวจจริง

เปิดเสียงจาก gesture; หยุดกลาง flight; resume โดยไม่ย้อนเล่นทั้งเสียง; hold เงียบ; เปิด ambience; ดับจอ/เปิดจอ; M ปิด/เปิด; volume สะท้อนใน UI; test sound; เปลี่ยนคิวเร็วทั้ง effects และ ambience; pause ตัด retiring tails; placeholder ไม่มี ambience; reduced motion ตัดเสียง flight; WebGL fallback; render ครบ 42 คิว; presenter คุม volume/mute โดยไม่สร้าง AudioContext; mobile panel; refresh รอเปิดใหม่; audio โหลดช้าไม่ขวาง navigation; missing asset เปิดข้อความไทยและลองโหลดใหม่ได้; browser ไม่มี runtime errors

## ข้อที่พบและแก้

1. ข้อผิดพลาดโหลดเสียงใช้ข้อความระบบอังกฤษ: แปลเป็นข้อความไทย เปิด panel ให้เห็นสถานะและให้ retry โดยไม่หยุดสไลด์
2. การสั่งยกเลิกเสียงเดิมซ้ำอาจยืด ambience tail: เก็บ stop deadline ยอมให้ย่นได้แต่ไม่ยืด และยกเลิก future voices ก่อนเริ่ม; ตรวจ rapid navigation พร้อม ambience และ pause tails แล้วผ่าน
3. Repeat render เดิมตรวจทุก byte: วัดจริงต่างเพียง 1 ขั้น PCM16 ใน 440 samples จาก 2,304,000 (0.0191%), RMS error -127.50 dBFS. ปรับเกณฑ์เป็น numerical PCM tolerance ที่ระบุชัดและยังจับ timing/phase drift ได้; ไม่เปลี่ยน waveform เพื่อซ่อนความต่าง

## ขอบเขตการตรวจ

ผลเป็น software checks, PCM analysis และการตรวจ UI บนเครื่องนี้. ภาพในคลิปใช้ 720 frames ที่ตรวจจากรุ่น place journey แล้วโดย mux วิดีโอเดิม จึงไม่มีการเปลี่ยนการเคลื่อนกล้องในการเพิ่มเสียง. ตรวจไฟล์ AAC หลังเข้ารหัสและ full decode; ไม่อ้างว่าได้ฟังและรับรองรสนิยมเสียงบนลำโพงจริงหรือทำ soundcheck กับไมโครโฟนแล้ว. ต้องซ้อม PA/ไมโครโฟน/projector หน้างาน โดยเริ่ม master ต่ำแล้วปรับร่วมกับเสียงผู้พูด

เอฟเฟกต์เงียบช่วงอ่านเป็นค่าเริ่มต้น; ambience เป็นตัวเลือก. Clip เปิด ambience เพื่อให้เทียบสถานที่ได้ ไม่มีเพลงหรือบทผู้พูดอัตโนมัติ. รอยต่อทุก 4 s ใน clip เป็น cut ระหว่างตัวอย่างที่ตั้งใจไว้. ข้อเท็จจริงและสิทธิ์ภาพเดิมไม่ได้เปลี่ยน; FLAMINGONE ยังต้องรักษาข้อจำกัดสิทธิ์เดิม

ไฟล์ตรวจ: `audio-checks.json`, `audio-measurements.json`, `audio-rounding.json`, `audio-video-verification.json`. แนวทาง: `docs/sound-direction.md`, `docs/sound-cue-sheet.md`, `docs/sound-map.json`
