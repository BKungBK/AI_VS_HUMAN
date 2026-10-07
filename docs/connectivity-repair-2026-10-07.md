# การซ่อมการเชื่อมต่อผู้จัด ผู้เล่น และจอฉาย — 7 ตุลาคม 2026

## อาการและหลักฐานก่อนแก้

- เปิด Chrome ใหม่บน production `/display/0C3712` แล้วทำให้เกิดแถบ “ยังติดต่อระบบไม่ได้ กำลังเชื่อมต่อใหม่” ได้ โดยไม่ต้องใช้ cookie เก่า
- `/session` และ snapshot แรกตอบสำเร็จ หลังเปิด `/events` มี snapshot ถูก browser ยกเลิก 3 ครั้งที่ 6,015 / 6,006 / 6,014 ms ตรงกับ timeout 6 วินาทีใน client
- `/events` ใช้เวลาถึง 17,416 ms ก่อนเริ่มตอบ snapshot ที่สำเร็จก็ใช้เวลาประมาณ 2.7–4.4 วินาที จึงมีเวลาสำรองก่อน timeout น้อย
- ทดลอง browser อีกชุดโดยบล็อก `/events` เป็นเวลา 30 วินาที: snapshot สำเร็จ 7 ครั้ง ไม่มี snapshot timeout และไม่มีแถบเตือน การทดลองนี้ชี้ว่าการเปิด stream มีส่วนกับปัญหา แต่ไม่ได้แยกสัดส่วน latency ของแต่ละระบบทั้งหมด
- cookie ของจอฉายมีอยู่ ใช้ path `/api` และ Secure การกล่าวว่าเกิดจาก cookie อย่างเดียวจึงไม่ตรงกับหลักฐาน
- ระบบเกมใช้ cookie และรหัสผู้จัด ไม่มีการเข้าสู่ระบบผู้เล่นผ่าน email ส่วนหน้า login ของ Vercel ต้องแยกจาก login ของเกม

## จุดที่พบจากโค้ด

1. Client เปิด SSE พร้อม polling ทุก 500 ms ฝั่งผู้จัด/จอฉาย เมื่อคำขอยังไม่จบจะตั้งสถานะให้ดึงซ้ำทันที ทำให้ไม่มีช่วงพักเมื่อระบบตอบช้า
2. ทุก instance ของ Vercel รัน schema ทั้งหกไฟล์และ seed ทุกชุดตอนเริ่ม API มี ALTER TABLE และการแก้ function ซึ่งเป็นงานติดตั้งฐานข้อมูล ไม่ควรเกิดระหว่างรับผู้เล่น และเสี่ยงให้ query รอ lock
3. Stream เดิมเปิดตลอดและ query ฐานข้อมูลทุก 500 ms ต่อผู้ใช้ แต่ function ถูกตั้ง maxDuration 60 วินาที การเชื่อมต่อจึงไม่สามารถค้างตลอดกิจกรรมได้ ดู [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration)
4. Promise สำหรับเริ่ม API ถูก cache แม้ล้มเหลว instance เดิมจึงอาจตอบล้มเหลวต่อจนถูกแทนที่
5. Pool ไม่มี timeout สำหรับรอ connection/query และไม่มี handler สำหรับ idle connection error ดู [node-postgres pool](https://node-postgres.com/apis/pool)

## สิ่งที่แก้

- Hosted API ประกาศ `X-Game-Transport: poll`; client ใช้ polling ต่อเนื่องโดยรอคำขอเดิมจบ ไม่เปิด SSE ซ้ำบน Vercel
- เว้นรอบ idle 1.5 วินาที / เกมกำลังเล่น 0.75 วินาที / แท็บซ่อน 5 วินาที หลังจบคำขอ เพิ่มช่วงพักเมื่อเกิดข้อผิดพลาด
- เพิ่ม client timeout เป็น 15 วินาที พร้อมแยกข้อความระบบตอบช้าออกจาก network error
- ยกเลิกคำขอเมื่อออกจากหน้าและเมื่อ offline ป้องกันผลเก่ากลับมาทับห้องใหม่
- Snapshot และคำสั่งตรวจ actor กับเรียก database function ใน query เดียว ลดจำนวนรอบไปฐานข้อมูล
- Hosted API ตรวจว่ามี database function ที่จำเป็นแทนการรัน schema/seed ซ้ำ การติดตั้ง local ยังทำงานเดิม
- เพิ่ม pool acquisition/query timeout และ idle error handler รีเซ็ต initialization promise เมื่อเริ่ม API ไม่สำเร็จ
- รองรับ client เก่าที่เปิด `/events` ด้วย SSE สั้นที่จบคำขอและเว้น reconnect 15 วินาที เก็บ SSE แบบเดิมสำหรับ local
- คำสั่งที่ส่งไม่สำเร็จ retry ด้วย key และ payload เดิม ป้องกันการนับซ้ำ ไม่ retry ข้อผิดพลาดของกติกาเกม
- รวมการซ่อม session ที่เกิดพร้อมกันเป็นคำขอเดียว แยกผู้จัดจาก session สาธารณะ และตัดช่องว่างรอบรหัสผู้จัด
- เพิ่ม `Server-Timing` และ release `connection-v2` เพื่อวัดเวลาจริงและตรวจ deployment

## ตรวจสอบก่อน deploy

- Build server/client/API bundle ผ่าน
- ชุดทดสอบกติกาเกมเดิมผ่าน 22 กรณี
- API connectivity ผ่าน 6 กรณี: host login, role authorization, player join/idempotency, finite hosted SSE, concurrent snapshots, missing migrations
- Client connectivity ผ่าน 5 กรณี รวม response ช้ากว่า cutoff เดิม 6 วินาที, retry คำสั่งเดิม, session repair พร้อมกัน และ host authentication
- Browser local เปิดผู้จัด/ผู้เล่น/จอฉาย ล็อกอิน สร้างห้องทดสอบ เข้าร่วม เปลี่ยนคิว เริ่มเกม แตะ จบเกม และเปิดต่ออีก 60 วินาที: snapshot สำเร็จ 192 ครั้ง ไม่มี request failure หรือ JavaScript error ไม่มี `/events`
- ตัดอินเทอร์เน็ตแล้วเปิดกลับ: แถบเตือนแสดงเมื่อ offline และหายเมื่อ snapshot สำเร็จ ผู้เล่นยังมี id ชื่อ และกลุ่มเดิม reload แล้วไม่ต้องสมัครใหม่

ข้อมูลการทดสอบละเอียดอยู่ใน `scratch/connectivity-local.json` ซึ่งไม่ส่งขึ้น Git และไม่มีค่า cookie หรือรหัสผ่าน
