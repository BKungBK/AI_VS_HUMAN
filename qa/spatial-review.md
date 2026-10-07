> Historical revision 3. Superseded by place journeys; current results are in qa/place-review.md and qa/place-checks.json.

# ผลตรวจ Spatial Motion Revision

6 ตุลาคม 2026 · Windows · Chrome/ANGLE D3D11 · stage 1920×1080

กล้อง PerspectiveCamera ตัวเดียวขับการ์ด HTML text ระนาบพื้นหลังสามระยะ และ particles. ข้อความเข้าทีละบรรทัดด้วย Z/rotateX/rotateY แล้วกลับ identity ภายใน 2.4s; ไม่แยกตัวอักษรไทย. ข้อความเดิมเลื่อนออกในระยะลึกและจางก่อน headline ใหม่ปรากฏ. Header/footer อยู่ screen space. พื้นหลังเกิด parallax จริงและ blend สีแสง 1.05s. กล้องเก็บ pose ก่อนเปลี่ยนคิว จึงรับช่วงการเคลื่อนไหวกลางทางได้; ย้อนคิวกลับทิศกล้อง. เกมยังเป็นข้อความกลางจอและ fade สั้น.

## ผลที่ตรวจได้

- Production build ผ่าน TypeScript/Vite; browser เล่นจาก dist. Source/build hashes อยู่ใน `spatial-motion/build-manifest.json`.
- `browser-checks.json`: 65/65 ผ่าน รวม layout 42 คิว, font/image readiness, navigation, pause, reduced motion, local-only assets, presenter และ context loss.
- `spatial-checks.json`: 22/22 ผ่าน รวม native text entry/exit ใน Z และสองแกนหมุน, camera arc/punch/push/dolly, reverse, projection counter-zoom, Thai safe bounds ระหว่าง dolly, light blending, interrupted handoff, deterministic seek, rapid changes, plain placeholders และ fallback.
- `final-checks.json`: 15/15 ผ่าน รวม fullscreen, synchronized full presenter dialogue, ห้ารอยต่อลูป และ WebGL unavailable ตั้งแต่เริ่ม.
- `contrast-checks.json`: 42/42 ผ่าน ≥8.5:1; ต่ำสุด 10.869:1 บนภาพประกอบจริงที่ hold 4s. ใช้ off-white glyph interiors เทียบกับภาพซ่อนข้อความ รวมกระจก/ภาพ/grain/particles; ไม่ใช้ขอบ antialias แทนสีหลัก.
- เส้นทางข้อความและกล้องกลับมาตรงที่ hold; ambient loops ยังคง Token/Hazard/Confidence/ECG/Equation ตามเนื้อหา.
- `performance.json`: 120 rAF intervals ที่ 1920×1080, median 16.70ms, P95 17ms, median cadence ประมาณ 59.9 FPS. เป็น headless Chrome บนเครื่องนี้; ไม่รับรองเครื่องฉายหน้างาน. Particles 180 / one draw call / zero mesh models.

## การตรวจภาพและรอบปรับ

1. ตรวจ opening/frontier/empathy หลังย้าย native text เข้า CSS3D world และเพิ่ม far planes. Hold ยังคงลำดับชั้นข้อความและการจัดวางเดิม.
2. ตรวจ transition strips; เพิ่ม light blending และตรวจ seek ทั้งไปและกลับ. Camera pose/DOM เหมือนเดิมทุกครั้ง. GPU raster บางภาพต่างเพียง 1 RGB level ใน 17 pixels; จึงตรวจ DOM และ camera แบบ exact พร้อม raster tolerance ≤1 RGB level ใน ≤0.1% pixels แทนการอ้างว่า PNG ทุกเฟรม bitwise identical.
3. ปรับ dolly aim เพื่อกันหัวข้อเข้าใกล้ขอบจอ; ตรวจ safe bounds ที่ 0.8/1.05/1.4/1.8/2.4s ผ่าน. ตัวทดสอบ presenter รอ BroadcastChannel sync ก่อนอ่าน dialogue. ตรวจห้ารอยต่อลูป; การ์ดเห็ดมี GPU rounding ≤1 RGB level ใน 142 pixels โดย DOM/phase ตรงกัน ไม่มีการกระโดดของ animation.

เฟรมต่อเนื่อง 72 ภาพที่ 1080p พร้อมหก contact sheets อยู่ใน `spatial-motion/`: arc, punch, push, dolly, reverse และ formula ที่เวลา 0/0.15/0.3/0.45/0.6/0.8/1.05/1.4/1.8/2.4/4/10s. ตรวจด้วยสายตาที่ full frame และ strips: ไม่มี headline ซ้อน ไม่มีบรรทัดไทยถูกตัดที่ hold และช่วงเข้าของ dolly ผ่าน safe bounds. Outgoing text เดินออกจากระนาบเป็นการเคลื่อนที่ตาม choreography.

## คลิปและขอบเขต

คลิปตรวจใหม่ `spatial-transition-preview.mp4` เป็นหกตัวอย่างช่วงละ 3s, รวม 18s, 30 FPS, capture 1280×720 จาก stage 1920×1080, ไม่มีเสียง. ผล probe/decode ผ่าน: H.264 / yuv420p / 1280×720 / 30 FPS / 540 frames / 18.0s / audio absent. บันทึกใน `spatial-media-checks.json`. ดึง 14 เฟรมจาก MP4 จริงใน `spatial-encoded/` แล้วตรวจ contact sheet และเฟรมตัวแทนเต็มภาพ: ภาษาไทยคมครบ ไม่มี layer หาย และ tail ลงจอดตรง. ภาพและสถานะ visual review อยู่ใน `spatial-encoded-checks.json`.

ตรวจพรีวิวจริงใน Codex Browser โดยโหลด build ใหม่และคงคิว Tessa (10.01) ที่ผู้ใช้เปิดไว้. ยังต้องซ้อมระยะอ่าน แสง และจอฉายจริงหน้างาน. ไม่มีแทร็กเสียงที่วางไว้สำหรับมิกซ์; อ่าน hyperframes-audio แล้วคง silent ตามแผนเดิม. เนื้อหาและสิทธิ์ภาพคงตาม `docs/facts-and-rights.md`.

