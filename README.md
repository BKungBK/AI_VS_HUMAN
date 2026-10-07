# HUMAN vs AI — The Sparring Minds

## สถานะปัจจุบัน

สไลด์และเกมทั้ง 7 ใช้ห้องเดียวกันผ่าน API/ฐานข้อมูล: ห้องใหม่เริ่มที่คิว `01.02` พร้อม QR บนจอ, ผู้เล่นกรอกชื่อและกลุ่มครั้งเดียว แล้วมือถือรอเกมจากคิวสไลด์ เมื่อผู้จัดกดเริ่ม เกมเปิดพร้อมกัน ผลบนจอค้างจนผู้จัดกดจบและไปต่อ

- เปิดสไลด์ที่ `/` และเกม/ห้องที่ `/games`.
- รันในเครื่องด้วย `npm run game:build` แล้ว `npm run game:start` (ค่าเริ่มต้นพอร์ต 5180; ตั้ง `GAME_PORT` เพื่อเปลี่ยนพอร์ต).
- ผู้จัดสร้างห้องจาก `/games`; เปิดสไลด์จากหน้าห้อง แล้วเปิด `บทผู้พูด` เพื่อให้การเปลี่ยนคิวบันทึกเข้าห้อง ผู้เล่นและจอฉายอ่าน cue/run/result จากฐานข้อมูลเดียวกัน.
- ผู้เล่นเข้าจาก QR หรือ `/play/:code`; จอฉายเปิด `/display/:code`.
- UI เกมใช้ SVG สำหรับสัญลักษณ์และ motion แบบเต็มตามงานออกแบบ ไม่มี emoji หรือ OS reduced-motion override.

โครง deploy ใช้ Vercel Functions กับ Supabase Postgres. Migration เริ่มต้นถูก apply ไปยัง Supabase project ที่ link ไว้แล้ว; ยังต้อง login/เชื่อม Vercel project และตั้ง `GAME_DATABASE_URL` กับ `GAME_HOST_KEY` ก่อนเปิดใช้งานบนอินเทอร์เน็ต

## เกมที่ห้าพร้อมทดสอบในเครื่อง: Chat Whack-a-Mole (ทุบแชตที่ควรหยุด)

เปิด `Start-Game5.cmd` แล้วเข้า [Chat Whack-a-Mole](http://localhost:5186/games?game=chat-whack-a-mole) เลือกเกม 5 สำหรับห้องใหม่ หรือเปลี่ยนคิวห้องเดิมเป็น `10.02` (เมื่อจบจะก้าวสู่ `10.03` “ตรวจก่อนปล่อยคำตอบ”):
- **กติกา:** แตะทุบเฉพาะแชตที่ควรหยุด ปล่อยข้อความที่ช่วยเหลือให้ผ่าน เล่นจริงต่อเนื่อง **25 วินาที** (ไม่มีการหยุดรอเฉลยระหว่างเล่น)
- **แบนเนอร์บริบทค้าง:** “ผู้ใช้ขอคุยกับเจ้าหน้าที่ และบอกว่าคำแนะนำเดิมทำให้ไม่สบายใจ”
- **สนามกริด 2×3:** 6 ช่อง ฟองแชตอายุ 2.4 วินาที โผล่พร้อมกันสูงสุด 3 ฟอง รวม 18 ฟอง (ควรหยุด 9 / ควรปล่อย 9)
- **คะแนน:** ทุบข้อความควรหยุด +100 แต้ม | ทุบข้อความดีหัก -100 แต้มจากคะแนนดิบ | พลาดข้อความควรหยุด 0 แต้ม | หมดเวลาคำนวณ clamp(0, 900)
- **คะแนนกลุ่ม:** ผลรวมคะแนนในกลุ่ม ÷ สมาชิกเริ่มต้นทั้งหมดใน Roster (คนได้ 0 ยังคงอยู่ในตัวส่วน)
- **เฉลย 2 คู่เปรียบเทียบ:** ไฮไลต์ประเด็นการเปิดทางให้มนุษย์เข้าแทรกแซง และความซื่อสัตย์ในขอบเขตความปลอดภัย

คู่มือ: [ปรับ UI Chat Whack-a-Mole](docs/ui_Chat_Whack_a_Mole.md) · [รายงานตรวจ QA อัตโนมัติ](qa/game5/report.json) เกมนี้ใช้พอร์ต 5186 และฐานข้อมูล `data/pg-game5` แยกจากเซิร์ฟเวอร์เกมเดิมที่เปิดอยู่

## เกมที่สี่พร้อมทดสอบในเครื่อง: Death Cap Roulette (เชื่อ รอด หรือจบเกม)

เปิด `Start-Game4.cmd` แล้วเข้า [Death Cap Roulette](http://localhost:5184/games?game=confidence-roulette) เลือกเกม 4 สำหรับห้องใหม่ หรือเปลี่ยนคิวห้องเดิมเป็น `07.01` กติกา 6 รอบ รอบละ 4 วินาที (ตัดสินใจ 4s → เฉลย 5s → เปลี่ยนรอบ 3s):
- **เชื่อ:** ถูกได้ +300 แต้ม | **ผิดคือ “ตายทันที” (คะแนนเป็น 0 และกลายเป็นผู้ชมตลอดเกมที่เหลือ)**
- **ไม่เชื่อ:** ผิดได้ +100 แต้ม | ถูกได้ +0 แต้ม (รอดชีวิตทั้งคู่)
- **ไม่ตอบ / หมดเวลา:** ได้ +0 แต้ม (รอดชีวิต)
- **คะแนนกลุ่ม:** ผลรวมคะแนนผู้รอดชีวิตในกลุ่ม ÷ สมาชิกเริ่มต้นทั้งหมดใน Roster (คนตายยังคงถูกนับเป็นตัวหาร)
- **ด่านที่ 6 (The Death Cap Finale):** แสดงภาพเห็ดระโงกหินจริง (`/assets/images/death-cap.jpg`) พร้อมระดับความมั่นใจ 99.8% และป้ายเตือน `LETHAL RISK`

คู่มือ: [ปรับ UI Death Cap Roulette](docs/ui_Death_Cap_Roulette.md) · [รายงานตรวจ QA อัตโนมัติ](qa/game4/report.json) เกมนี้ใช้พอร์ต 5184 และฐานข้อมูล `data/pg-game4` แยกจากเซิร์ฟเวอร์เกมเดิมที่เปิดอยู่

## เกมที่สามพร้อมทดสอบในเครื่อง

เปิด `Start-Game3.cmd` แล้วเข้า [Caption & Prompt Battle](http://localhost:5182/games?game=caption-battle) เลือกเกม 3 สำหรับห้องใหม่ หรือเปลี่ยนคิวห้องเดิมเป็น `04.01` ผู้จัดตรวจ/อนุมัติแคปชั่น AI ก่อนเริ่ม จากนั้นเขียน 20 วิ → ตรวจ 60 วิ → เลือกตัวแทน 10 วิ → โหวต 20 วิ → ยืนยันผลกลับ `04.02` งานค้างตรวจทำให้หยุดรออย่างชัดเจน ไม่มีการเผยแพร่งานที่ยังไม่ตรวจ

คู่มือ: [ทดสอบเกม 3](docs/test-game3.md) · [ปรับ UI Caption & Prompt Battle](docs/ui_Caption_&_Prompt_Battle.md) · [ผลตรวจอัตโนมัติ](qa/game3/report.json) เกมนี้ใช้พอร์ต 5182 และฐานข้อมูล `data/pg-game3` แยกจากเซิร์ฟเวอร์เกมเดิมที่เปิดอยู่

เว็บสไลด์สร้างใหม่ทั้งหมด: **16 บท / 43 คิว / กรอบนำเสนอ 50 นาที** Modern Dark Neo-Pastel, 2.5D spatial glass cards, SVG, ภาพถ่ายจริง และ 3D particles ไม่มี mesh models หน้าเกม/คะแนน/รางวัลเป็นข้อความกลางจอ

## เกมแรกพร้อมทดสอบในเครื่อง

Trust Tug-of-War มี Player/Host/Display และฐานข้อมูลคะแนนแล้ว เปิดด้วย `Start-Game.cmd` แล้วเข้า [หน้าเกม](http://localhost:5180/games) ดูรหัสผู้จัดที่ `data/host-key.txt` มือถือใช้ LAN URL ที่ server แสดง

คู่มือ: [ทดสอบเกมแรก](docs/test-game1.md) · [ปรับ UI Trust Tug-of-War](docs/ui_Trust_Tug-of-War.md) · [ผลตรวจเกมแรก](qa/game1/review.md)

ระบบเกมใช้ Elysia และ PGlite ในเครื่อง หรือเชื่อม PostgreSQL ด้วย `GAME_DATABASE_URL` เมื่อ deploy. API ปัจจุบันใช้ session cookie, SSE และ snapshot polling จากฐานข้อมูลเดียวกัน; ยังไม่ได้ต่อ Supabase Auth/Realtime ตาม target architecture ใน `spec.md`.

## Deploy ออนไลน์

1. เชื่อม GitHub repo นี้กับ Vercel แล้วตั้งค่า Production Environment Variables: `GAME_DATABASE_URL` เป็น Supabase Transaction Pooler URI ที่ลงท้ายด้วย `sslmode=require` และ `GAME_HOST_KEY` เป็นรหัสผู้จัดแบบสุ่มที่เก็บเป็น secret. ค่า pool ของแอปเริ่มที่ 1 connection ต่อ function instance.
2. ตรวจว่า `GAME_PUBLIC_ORIGIN` ตรงกับโดเมนจริงถ้า Vercel URL ที่ให้มาไม่ใช่โดเมนสุดท้าย.
3. Deploy ด้วย `vercel.json`; API เป็น Node function และหน้าเว็บ build จาก `npm run game:build`.

อย่า commit `.env` หรือส่ง connection string และ host key ผ่านแชต; ใช้หน้า Environment Variables ของ hosting provider.

## เปิดนำเสนอ

สำหรับชุดส่งมอบที่ build แล้ว: ดับเบิลคลิก `Start-Presentation.cmd` (ต้องมี Node.js) แล้วเปิด http://127.0.0.1:5173/. ตัว server ใช้ Node มาตรฐาน ไม่ต้องติดตั้ง dependencies หรือเชื่อมต่ออินเทอร์เน็ต ปิดด้วย Ctrl+C ในหน้าต่าง server

```powershell
npm ci
npm run dev
```

เปิด http://127.0.0.1:5173/ แล้วกด F เต็มจอ และ H ซ่อนแถบควบคุม เปิดจอสะอาดโดยตรงด้วย `/?clean=1`. พื้นที่ออกแบบ 1920×1080 ปรับสเกลตามหน้าจอและรักษา 16:9. เปิดด้วย local HTTP server; ไม่ใช้ file://

**→ / Space** คิวถัดไป · **←** ย้อน · **P** หยุดภาพ · **B** fade ดับจอ · **C** เลือกบท · **N** เปิดหน้าต่างบทผู้พูด · **H** ซ่อน controls

หน้าต่างผู้พูดใช้ BroadcastChannel ควบคุมจอฉายบน origin เดียวกัน ต้องใช้ browser เดียวกัน เช่น `/?presenter=1`. บท ข้อจำกัดหลักฐาน และคิวถัดไปอยู่เฉพาะหน้าต่างผู้พูด เปิดคิวเฉพาะด้วย `/?scene=5&cue=3&clean=1` (เลขเริ่มจาก 0). เกมทั้ง 7 อยู่ที่ `/games`; ห้องผู้จัดเชื่อม cue, run และผลกับสไลด์และจอฉาย

**เสียง:** กด “เสียง · ปิด” หรือ **M** ที่จอฉายเพื่อเปิดเสียงหนึ่งครั้ง จากนั้นเดินคิวได้ตามปกติ. “ตั้งเสียง” ปรับระดับ (เริ่ม 65%) ทดสอบเสียง เว้นย่านเสียงผู้พูด และเปิดบรรยากาศประจำสถานที่. ค่าเริ่มต้นใช้เอฟเฟกต์เข้า/เดินทาง/ลงจอด แล้วเงียบช่วงอ่าน. หยุดภาพ ดับจอ หรือซ่อนแท็บจะหยุดเสียงด้วย. หน้าต่างผู้พูดปรับ/ปิดเสียงของจอฉายได้หลังเปิดครั้งแรก โดยไม่เล่นเสียงซ้ำ. WAV ต้นฉบับทั้ง 31 ไฟล์อยู่ในเครื่อง ไม่มีเพลงหรือเสียงผู้พูดอัตโนมัติ. ลำโพงและไมโครโฟนหน้างานยังต้องซ้อมระดับจริง

## Production และตรวจงาน

```powershell
npm run build
npm run preview
npm run qa
python scripts/contrast-and-sheet.py
node scripts/final-check.mjs
node scripts/place-check.mjs
node scripts/place-capture.mjs
python scripts/place-sheets.py
node scripts/place-capture.mjs --film
node scripts/audio-check.mjs
python scripts/audio-measure.py
node scripts/creative-audit.mjs
node scripts/narrative-loop-check.mjs
node scripts/creative-sound-check.mjs
python scripts/creative-audio-measure.py
node scripts/creative-preview.mjs --video
node scripts/card-rhythm-check.mjs
node scripts/card-rhythm-docs.mjs
node scripts/creative-preview.mjs --video --rhythm
```

ใช้ dev หรือ preview เพียงตัวเดียวบน port 5173. QA ใช้ Chrome ที่ `C:/Program Files/Google/Chrome/Application/chrome.exe`; แก้ executablePath หากย้ายเครื่อง. Playwright อยู่ใน dev dependencies. Python scripts ใช้ Pillow. Motion encode ใช้ FFmpeg. ฟอนต์ รูปภาพ และ runtime ทั้งหมดอยู่ใน local build; ไม่โหลด CDN ขณะนำเสนอ

เครื่องที่ผลิตและตรวจงานใช้ Node.js 24.19.0; scripts ตรวจงาน import TypeScript โดยตรง จึงแนะนำ Node 24 สำหรับทำซ้ำทั้ง pipeline. การเล่นชุด dist ใช้เพียง Node กับ browser โดยไม่เรียก npm หรือ QA dependencies

`window.deck`: ready, go(sceneIndex|chapterId, cueIndex|cueId), seek(seconds), next(), previous(), pause(), resume(), state(), setFallback(). `go('06','06.04')` เปิด frontier; seek ใช้เวลานับจากเริ่มคิวนั้น. ทุกเครื่องใช้กล้องและแอนิเมชันเต็มเหมือนกัน โดยไม่อ่านค่า Reduce Motion จากระบบหรือเบราว์เซอร์. ทุก animation ถูกขับจากนาฬิกากลางเดียว สามารถจับภาพตามเวลาเดิมซ้ำได้

`window.deck.audio`: enable(bool), volume(0–1), ambient(bool), speechSafe(bool), preview(), state(), render(duration, ambient). enable ต้องเรียกจาก user gesture บนจอฉาย. render ใช้ OfflineAudioContext กับ mix graph เดียวกับ live แล้วคืน PCM16 WAV base64 พร้อมค่าระดับ; ไม่เปิดลำโพงอัตโนมัติ. ดู `src/SoundScore.ts` สำหรับคิวเสียง และ `scripts/make-sounds.py` สำหรับสร้างไฟล์ต้นฉบับซ้ำ (ต้องมี NumPy)

## เอกสารส่งมอบ

- `spec.md` - ข้อกำหนดระบบ real-time, Vercel/Git, Supabase/Elysia, session, สิทธิ์ผู้เล่นทุกคน และคะแนนเฉลี่ยกลุ่ม
- [ข้อกำหนดเกมทั้ง 7](docs/game-build-plan.md) - กติกา API คะแนน การตรวจงาน และเกณฑ์รับมอบที่ใช้เทียบกับ implementation
- [สัญญาระบบกลาง](docs/game-foundation-contract.md) - เวลา/transaction/roster/สิทธิ์/ส่งซ้ำ/หลายแท็บ/reconnect ที่ทุกเกมต้องใช้ร่วมกัน
- แผนล่าสุด: 32 คน กลุ่มละประมาณ 4–6 คนโดยไม่บังคับขนาด ไม่มีผู้ช่วยผู้จัดตรวจเอง และทุกเกมรอกด “จบเกม / ไปต่อ”; ตารางซ้อม .md/.csv ปรับเป้าหมายแล้ว เวลาใน source/บทที่สร้างจาก source จะ sync ในขั้นพัฒนา
- `output/pdf/human-vs-ai-slides.pdf` - ภาพหน้าสไลด์ครบ 43 คิวตามลำดับนำเสนอ

- `docs/presentation-summary-with-sources.md` — สรุปครบ 16 บท / 43 คิว เรียงตามนำเสนอ พร้อมเวลา ที่มารายเรื่อง ลิงก์อ้างอิง และขอบเขตหลักฐาน
- `docs/mobile-games-spec.md` — คู่มือเกมมือถือครบ 7 เกม วิธีเล่น คะแนน การเชื่อมคิวสไลด์ และข้อกำหนดสำหรับพัฒนาต่อ
- `frame.md` — สี ฟอนต์ และข้อกำหนดภาพ
- `docs/place-journey-direction.md`, `docs/place-map.json` — ฉาก 11 สถานที่ เส้นทางกล้อง ลูปประจำฉาก และพิกัดคิว
- `docs/storyboard.md` — ข้อความ ภาพ กล้อง entry/hold/exit ของทุกคิว
- `docs/cue-sheet.md` — ตารางคิวสำหรับผู้ควบคุม
- `docs/presenter-script.md` — บทสำหรับซ้อมฉบับข้อมูลตรงสไลด์ เป็น cue notes ควบคู่ต้นฉบับ ไม่อ้างว่าอ่าน notes อย่างเดียวครบ 50 นาที
- `docs/full-script-revised.md` — บทพูด Human/AI ฉบับปรับข้อมูลพร้อมกำกับเวที ครบ 43 คิว; ใช้ข้อความชุดเดียวกับ presenter window
- `docs/rehearsal-timing.md` และ `.csv` — เวลาซ้อมรายคิว รวมกิจกรรมและอภิปรายครบ 3000 วินาที
- `docs/facts-and-rights.md` — แหล่งข้อมูล การแก้ข้ออ้าง และสิทธิ์ภาพ
- `docs/sound-direction.md`, `docs/sound-cue-sheet.md`, `docs/sound-map.json` — การเลือกเสียง มิกซ์ และคิวเสียงครบชุด
- `docs/creative-refinement-direction.md` — แนวทางปรับฉาก ลูป ค้อน และเสียงตามคำตอบของผู้ใช้
- `docs/card-rhythm-map.md` — เวลาเหตุการณ์ ช่วงพัก และรอบลูปของทั้ง 31 คิวเนื้อหา
- `qa/card-rhythm/creative-preview.mp4`, `qa/card-rhythm/review.md` — คลิปพร้อมเสียง 30 วินาทีและผลตรวจรุ่นปัจจุบัน: สมอง หน้าเห็ด และ ECG
- `qa/card-rhythm/checks.json` — ตรวจการลอย แสง ระยะอ่าน ช่วงพัก และการจัดวาง 101/101 ข้อ
- `qa/creative-direction/loop-checks.json` — ผลตรวจใหม่ของการวนรอบและ seek ย้อนกลับ 34/34 ข้อ
- `qa/creative-direction/creative-preview.mp4`, `qa/creative-direction/review.md`, `qa/creative-direction/refined-motion-audit.json` — ประวัติรุ่นก่อนปรับการลอย ช่วงพัก และเสียงเข้าหน้าเห็ด
- `qa/creative-direction/sound-checks.json`, `qa/creative-direction/sound-measurements.json` — ผลตรวจมิกซ์ปัจจุบันและเปรียบเทียบเสียงเดินทางก่อน/หลัง
- `qa/sound-journey-preview.mp4`, `qa/audio-review.md` — ประวัติคลิปและผลตรวจระบบเสียงก่อนปรับเสียงเดินทาง
- `qa/review.md` — ผลตรวจและข้อจำกัด; `qa/contact-sheet.jpg` และ `qa/motion-preview.mp4` ใช้ตรวจภาพ/โมชัน
- `qa/place-checks.json` — ผลตรวจเส้นทางกล้องและสถานที่; `qa/place-review.md`, `qa/place-journey-preview.mp4` และ `qa/place-journey/` เป็นประวัติภาพก่อนปรับฉากให้สงบขึ้น

คลิปและรายงานใน `qa/card-rhythm/` แสดงภาพและเสียงปัจจุบัน พร้อม `qa/contact-sheet.jpg` และผล browser/contrast/final/place/full-motion ที่ตรวจใหม่. ผล `loop-checks.json`, `sound-checks.json` และ `sound-measurements.json` ใน `qa/creative-direction/` ตรวจใหม่แล้วด้วย. คลิป 24 วินาทีในโฟลเดอร์นั้นและคลิปที่ขึ้นต้น `motion`, `spatial`, `place` และ `sound-journey` เป็นประวัติรุ่นก่อน จึงอาจมีฉาก จังหวะ หรือเสียงต่างจากเว็บปัจจุบัน.

ซอร์สใหม่อยู่ใน `src/`. ต้นฉบับสามเอกสารอยู่ใน `sources/` พร้อม SHA-256. งานเก่าเก็บนอกโปรเจกต์ที่ `D:/Project/AI_VS_HUMAN_before_rebuild_20261005_183618.zip` และ `D:/Project/AI_VS_HUMAN_archived_20261005_183618` ไม่ถูกนำกลับมาใช้

ใช้ cinematic-motion-studio และ hyperframes-creative สำหรับแนวทางผลิต/ภาพ พร้อม hyperframes-animation สำหรับ GSAP/Three.js patterns และ hyperframes-audio สำหรับแนวทางมิกซ์. Renderer ของงานคือ browser React/GSAP/Three.js + Web Audio ไม่ใช่ HyperFrames CLI. ยังต้องซ้อม projector ระยะอ่าน แสง ลำโพง และไมโครโฟนจริงก่อนใช้บนเวที ภาพ FLAMINGONE มีลิขสิทธิ์ผู้สร้าง ดูข้อจำกัดก่อนเผยแพร่
