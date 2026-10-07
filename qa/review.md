# ผลตรวจชุดสร้างใหม่ — บันทึกก่อน Spatial Motion Revision

รายงานนี้บันทึกชุดสร้างใหม่ก่อนปรับ motion ล่าสุด ผลของ revision ปัจจุบันอยู่ใน `qa/spatial-review.md` และผล machine checks ที่ระบุในรายงานนั้น

วันที่ตรวจ: 6 ตุลาคม 2026 · เครื่อง Windows นี้ · Chrome / ANGLE D3D11 · stage 1920×1080

## ผลที่ยืนยันได้

- Production build `npm run build` ผ่าน TypeScript และ Vite; local server อ่านจาก dist จริง
- `65` browser checks ผ่าน: รวม layout 42/42 คิว, ภาพโหลดครบ, Thai copy ไม่ล้นกล่อง, card safe bounds, navigation ข้ามบท, กดรัว, pause เปลี่ยนคิว, resume, blackout, chapter index, reduced motion, WebGL context loss, presenter sync/control, assets delay, local-only network และ 16:9 บน viewport มือถือ
- 42/42 คิวมี contrast ของ off-white foreground ผ่าน >=8.5:1; ต่ำสุด **10.869:1** ที่ตรวจบนภาพประกอบจริง ณ hold 4s วิธีเทียบ interior glyph mask กับภาพพื้นหลังที่ซ่อนข้อความ รวมกระจก ภาพถ่าย grain และอนุภาค; ขอบ antialias และตัวอักษร accent ตกแต่งไม่ถูกใช้แทนข้อความหลัก
- นาฬิกากลางขับ paused GSAP timelines, particles และ contextual phases; deterministic seek จับภาพซ้ำ hash ตรงใน browser checks
- Dolly เปลี่ยน Z และ FOV จริง; cards ยังคงขนาดอ่านง่ายหลังกล้องลงจอด
- บทพูดฉบับปรับข้อมูลครบ 42 คิว; เวลาซ้อมรวมกิจกรรมและอภิปรายตรวจผลรวมได้ 3000 วินาที ไม่อ้างว่าข้อความพูดอย่างเดียวมีความยาว 50 นาที
- ตัวอย่างเวลา frame ใน `qa/motion-samples.json` และ contact sheets ตรวจ Punch-in, Push-through, Dolly และรอยต่อลูป Token / Hazard / Confidence / ECG / Equation

## รอบปรับภาพและโมชัน

1. ตรวจ opening / frontier / empathy ที่ 1080p; ปรับพื้นที่ข้อความ Thai และขนาดไอคอน เพื่อไม่ให้การ์ดตัดเนื้อหา
2. ตรวจครบ 42 คิว; ลดอนุภาคที่ทำให้พื้นใต้ตัวอักษรสว่างเกินไป ปรับ safe margins ของการ์ดเห็ด ย้ายเครดิตภาพขึ้นด้านบน และจัดขนาดหัวข้อหลักตามข้อกำหนด
3. ตรวจเฟรมต่อเนื่อง; ข้อความเก่า fade 0.18s ก่อนหัวข้อใหม่ขึ้น การ์ดเก่า fade 0.28s พร้อม scale 0.55s เพื่อไม่ให้สำเนาหัวเรื่องและ header ซ้อนกัน เพิ่ม breathing glow ของสมการ และให้ flow phase กลับจุดเดิมพร้อม fade ที่ปลายทาง

`qa/final-checks.json` ผ่าน 15/15 regression checks หลังรอบสุดท้าย รวม fullscreen เปิด/ปิด และ WebGL ไม่พร้อมตั้งแต่เริ่มโหลด แยกจากชุดตรวจ layout ทั้ง 42 คิว สถานะล่าสุดต้องดูไฟล์ผลจริง ไม่ใช้ข้อความรายงานนี้แทนผล machine checks

## สมรรถนะที่วัดบนเครื่องนี้

120 requestAnimationFrame intervals ใน headless Chrome ที่ 1920×1080: median 16.70 ms, P95 16.90 ms, ประมาณ 59.9 FPS จาก median interval. เป็น cadence ที่วัดบนเครื่องนี้ ไม่รับรองทุกเฟรมที่แสดงบนโปรเจกเตอร์จริง Particles 180 จุด / 1 draw call / mesh models 0

## หลักฐานที่ส่งมอบ

- ภาพ hold: `qa/captures/` ครบ 42 คิว และ `qa/contact-sheet.jpg`
- Prototypes: `qa/prototypes/` opening / frontier / empathy
- Transition samples และ sheets: `qa/motion/`
- คลิปตรวจ 14 วินาที: `qa/motion-preview.mp4` 30 FPS ไม่มีเสียง เป็นตัวอย่างเจ็ดฉาก ไม่ใช่วิดีโอสัมมนา 50 นาที
- `qa/media-checks.json`: ผ่าน probe dimensions, duration, codec และ decode ของไฟล์ MP4; ตรวจภาพจากไฟล์ที่ encode แล้วใน `qa/encoded-review.jpg`
- `qa/browser-checks.json`, `qa/contrast-checks.json`, `qa/final-checks.json`, `qa/performance.json`
- ซอร์สต้นฉบับทั้งสามพร้อม hashes: `sources/manifest.json`; ภาพและสิทธิ์: `sources/asset-provenance.json`

## ข้อจำกัดที่ยังต้องตรวจหน้างาน

ต้องซ้อมกับโปรเจกเตอร์จริงในสภาพแสง ระยะอ่าน และการต่อจอของสถานที่ ยังไม่ได้ตรวจเครื่องฉายหน้างาน การคุมเวลา 50 นาทีขึ้นกับผู้พูดและกิจกรรมภายนอก หน้าเกม คะแนน ลงทะเบียน และรางวัลเป็น text placeholders ไม่มี backend และไม่มีเสียงอัตโนมัติ

FLAMINGONE มีลิขสิทธิ์ Miles Astray ไม่อ้างสิทธิ์เผยแพร่ต่อหรือใช้เชิงพาณิชย์ ต้องจัดการ license ก่อนเผยแพร่งานออกนอกชุดอ้างอิงท้องถิ่น บางต้นทางของกรณี Tessa และคำวินิจฉัย Air Canada เข้าถึงต้นฉบับโดยตรงไม่ได้ จึงบันทึกแหล่งร่วมสมัยและขอบเขตไว้ใน `docs/facts-and-rights.md` ตัดข้ออ้างที่ยืนยันไม่ได้ออกจากบทใหม่
