# Trust Tug-of-War — ผลตรวจชุดทดสอบในเครื่อง

6 ตุลาคม 2026 · Elysia/Node 24.19.0 · PostgreSQL ผ่าน PGlite 0.5.8 · Windows · Chrome

## ผลที่ผ่าน

- `npm run game:build`: TypeScript ทั้ง API/frontend และ production build ผ่าน เกมโหลดแยก chunk จาก 3D ของเว็บสไลด์
- `npm run game:test`: 9 integration scenarios ผ่าน บังคับ transaction ผ่าน PostgreSQL จริงแบบ in-memory ไม่จำลอง scorer ใน browser
- `npm run game:qa`: 16 browser checks ผ่าน ครบ join/ready/Start/ดึง/Pause/Resume/refresh/two tabs/takeover/offline/RESULT/finish/slide03.01/export/forbidden Host mutation ไม่มี uncaught browser errors
- Display RESULT ไม่ต้องเลื่อนที่ 1920×1080; Player ไม่มี horizontal overflow ที่ 390×844
- Schema migration จากรุ่น capped เดิมทำงานโดยไม่ลบข้อมูล rehearsal; run ใหม่รองรับ accepted taps เกิน 50 ต่อคน
- `npm audit`: 0 vulnerabilities หลังอัปเดต Vite เป็น 7.3.7
- Impeccable detector: `[]`; finish reviewer disposition **ship** ในขอบเขต local rehearsal หลังถ่าย ready state ใหม่เมื่อ side-choice acknowledgement เสร็จแล้ว

## คะแนนและสัญญาที่ตรวจ

Start พร้อมกันสองคำขอสร้าง run เดียว; roster/side ล็อก; late join และ leave/rejoin ไม่ได้สิทธิ์ย้อนหลัง; ย้ายกลุ่มไม่แก้ roster เดิม; repeat key คืน receipt เดิมหลังหมดเวลา; payload ต่างด้วย key เดิมถูกปฏิเสธ; event ซ้ำไม่เพิ่มคะแนน; แตะได้ไม่จำกัดและคะแนนคิด 10 ต่อ accepted tap; ทดสอบผู้เล่นหนึ่งคนเกิน 50 แตะแล้วคะแนนกลุ่มยังเฉลี่ยตาม roster รวมคนที่ไม่ได้แตะ; Pause/Resume เปลี่ยน phaseToken แต่คงแตะ; writer/controller takeover ปิดคำสั่งแท็บเก่า; RESULT ไม่มี deadline จบเกม; digest เปลี่ยนแล้ว Finish ไม่ commit; Player/Display ไม่ได้ private score คนอื่นหรือ Host payload; cross-room Host ถูกปฏิเสธ

## โหลด HTTP ในเครื่อง

| ผู้เล่น | แตะที่พยายาม | แตะที่รับ | p95 / p99 | ข้อผิดพลาด transport | ผล |
|---:|---:|---:|---:|---:|---|
| 32 | 1,920 | 1,920 | 122.44 / 133.32 ms | 0 | ทุกคนได้ 60 แตะ คะแนนยืนยันครั้งเดียว |
| 48 | 4,800 | 2,147 | 5,131.40 / 6,053.46 ms | 865 | ไม่ผ่าน stress gate |
| 64 | 6,400 | 2,630 | 4,384.74 / 6,076.82 ms | 1,563 | ไม่ผ่าน stress gate |

ผล 32 คนเป็นการตรวจใหม่หลังเปลี่ยนเป็น unlimited taps โดยส่งเป็น batch 10 event และทุกคนรับครบ 60 taps เกินเพดานเดิม ข้อมูลเต็มอยู่ `load-32.json`; ไฟล์ `load-48.json` และ `load-64.json` เป็นหลักฐาน stress ของ build capped ก่อนหน้าและไม่ใช้ยืนยันกติกาใหม่ ตัว runner ใช้ session/สิทธิ์จริงผ่าน HTTP และฐาน persistent แต่ไม่ได้เปิด browser/Realtime consumers พร้อมกันครบ 34 เครื่อง จึงยังไม่ใช่ผล full topology หรือ staging

## ภาพที่ตรวจ

`home.png`, `host-ready.png`, `mobile-join.png`, `mobile-ready.png`, `mobile-pulling.png`, `mobile-offline.png`, `mobile-result.png`, `display-ready.png`, `display-result.png`, `host-result.png` เป็นภาพชุดปัจจุบัน ห้อง C3769A เปิดตรวจภาพจริงแล้ว สีและฟอนต์รักษาเว็บเดิม ปุ่มดึงใหญ่ สถานะพร้อมไม่สับสนกับการเลือกฝั่ง จอฉายไม่มีอันดับรายคน

## ขอบเขตที่ยังไม่ได้ตรวจรับ

ชุดนี้พร้อมให้ผู้ใช้เล่นทดสอบในเครื่อง/LAN ยังไม่มี Vercel/Supabase deployment ของเกม; local Host ใช้รหัสเครื่องและ HttpOnly session แทนบัญชี Supabase; ใช้ SSE แทน Supabase Realtime; ไม่ได้ทดสอบ grants/RLS ผ่าน Supabase Data API จริง หรือหลาย API instances บน cloud

ยังไม่ได้ซ้อม physical iPhone/Android, Wi-Fi งานจริง, projector ระยะอ่าน, เครื่อง Host สำรองจริง, การเล่น 50 นาที และ adapter ของเกมอื่น เกม 2–7 / workers ภาพ / moderation ยังอยู่นอกงานสร้างเกมแรกนี้ ผล UI reviewer ไม่รับรองสิ่งเหล่านี้
