# แผนสร้างระบบเกมพร้อมใช้งาน — HUMAN vs AI

แผนรุ่นแรกลงมือทำแล้วในเครื่อง · ตรวจ build, API contracts และ Browser QA ครบทั้ง 7 เกม · ยังไม่รับรองกำลังรองรับบน deployment จริง

เอกสารนี้แปลง [spec.md](../spec.md) และ [คู่มือเกม](mobile-games-spec.md) เป็นงานที่ลงมือทำและตรวจรับได้ แบ่งรายละเอียดครบทั้ง 7 เกม ใช้สไลด์เดิม 16 บท / 43 คิว / 50 นาที

อ่าน [สัญญาระบบกลาง](game-foundation-contract.md) ก่อน P01–P03 เพื่อยึดเวลา transaction สิทธิ์ idempotency การเปิดหลายแท็บ และ publication barrier ชุดเดียวกันทุกเกม

**ขอบเขตครั้งนี้:** วางกติกา ข้อมูล เวลา อินพุต คะแนน การกู้สถานะ ชุดเนื้อหา และเกณฑ์พร้อมใช้ก่อนพัฒนา รายละเอียดการจัดวางจอ Host จะออกแบบภายหลัง แต่ระบุคำสั่งและข้อมูลที่ Host ต้องใช้เพื่อไม่ให้ backend ต้องรื้อใหม่

## 1. ข้อตกลงและสมมติฐานสำหรับแผน

| ประเด็น | ข้อกำหนดสำหรับสร้าง |
|---|---|
| ผู้เล่นเป้าหมาย | **32 คนพร้อมกัน / 8 กลุ่ม**; ไม่บังคับจำนวนต่อกลุ่ม เป็นฐานออกแบบและซ้อม ไม่ใช่จำนวนที่ทดสอบผ่านแล้ว |
| ชื่อกลุ่ม | `1234`, `สีกุมาร`, `Humanเนต`, `ท้ายกลีกร`, `เทเลทับบี้`, `Cry4`, `cybertud67`, `ท้ายไทยพาณิชย์`; ชื่อแสดงตามลำดับ ID และการแก้ชื่อไม่เปลี่ยน roster/คะแนน |
| ทดสอบเกินเป้าหมาย | 48 และ 64 คนเพื่อหาจุดที่เริ่มช้า; ผลทดสอบเกินเป้าหมายไม่เปลี่ยนจำนวนพร้อมใช้โดยอัตโนมัติ |
| ทีมหน้างาน | **ไม่มีผู้ช่วย ผู้จัดตรวจเอง ตามที่ผู้ใช้ยืนยัน**; ช่วงตรวจหยุดบทพูดและตรวจด้วยกริด/คีย์ลัด ใช้ 60 วินาทีต่อเกม 3/7 ต้องซ้อมความเร็วจริงก่อนรับรอง |
| ทุกคนมีสิทธิ์ | ทุกคนเล่น ส่งงาน เลือกตัวแทน และโหวตเองตาม roster ไม่มีหัวหน้ากลุ่มเล่นแทน |
| เริ่มเกม | ผู้จัดกด Start หลังอธิบาย; มีคนไม่พร้อมให้ **เตือนแต่ไม่บล็อก** ไม่ต้องกดยืนยันคำเตือนรอบที่สอง |
| จบเกม | ทุกเกมค้างหน้าผลจนผู้จัดกด **“จบเกม / ไปต่อ”** เอง; ปุ่มเดียว confirm คะแนน → complete run → Player WAITING → cue ถัดไป ไม่มี auto-finish/auto-next |
| ทีมและ QR | QR พร้อมรหัสห้องค้างแบบย่อจากคิว 01.02 จน transaction Start เกม 1 ล็อกทีมสำเร็จ แล้วซ่อน QR; ผู้มาช้าใช้ลิงก์/รหัสเดิมและรอเกมถัดไป |
| คะแนน | เกมรายคนเฉลี่ยจาก roster ตอนเริ่มเกม; คนไม่เล่นเป็น 0; เกม 3/7 ใช้คะแนนตัวแทนกลุ่มจากเสียงโหวตที่ normalize |
| จอฉาย | อันดับกลุ่มทั้ง 6 แสดงคะแนนและจำนวนสมาชิกใน roster ของเกมนั้น; หน้ารอแสดงจำนวนสมาชิกปัจจุบัน |
| Realtime หลุด | จอค้างภาพ/ผลล่าสุดที่ยืนยันจาก server ไม่ขึ้นจอว่าง; HTTP snapshot ใช้กู้สถานะ; Host มีสถานะ Realtime และ API แยกกัน |
| Host ล่ม | เปิดห้องเดิมจากเครื่องสำรองที่เตรียมบัญชีไว้ กู้ cue/run/คะแนนจากฐานข้อมูล และรับสิทธิ์ควบคุมต่อ |
| สไลด์ 07.02 | งานแก้ก่อนเชื่อมเกม: ล็อกเลขจำลอง 99.8% ให้ตรงทั้งหัวข้อ การ์ด บทพูด และทุกเฟรมของแอนิเมชัน |

หากจำนวนจริงเกิน 32 ให้ปรับ room capacity, โหลด, เวลาตรวจ และขนาดแกลเลอรีก่อนซ้อมใหม่ ไม่ขยายจำนวนด้วยการแก้ตัวเลขในเอกสารอย่างเดียว จำนวน 32 คนและผู้จัดตรวจเองยืนยันแล้ว ส่วนผลการซ้อมยังเป็นเงื่อนไขการตรวจรับ ไม่รอชื่อกลุ่มเพื่อเริ่มพัฒนา

## 2. งบเวลา 50 นาทีและวิธีรับมือเมื่อช้า

### 2.1 คิวเกมและจุดจบเป้าหมาย

| เกม | cueId → คิวถัดไป | ช่วงเวลาในงาน | ปกติ | โหมดกระชับ | เต็ม |
|---|---|---|---:|---:|---:|
| 1 Trust Tug-of-War | 02.01 → 03.01 | 03:00–05:10 | 130 s | 110 s | ไม่กำหนดเพดาน |
| 2 Swipe Court | 03.05 → 03.03 | 07:35–09:05 | 90 s | 80 s | 800 |
| 3 Caption & Prompt Battle | 04.01 → 04.02 | 11:10–13:30 | 140 s | 130 s | 1,000 |
| 4 Death Cap Roulette | 07.01 → 07.02 | 22:00–24:40 | 160 s | 140 s | 1,200 |
| 5 Chat Whack-a-Mole | 10.02 → 10.03 | 31:45–33:15 | 90 s | 75 s | 900 |
| 6 Company Shield | 11.02 → 11.03 | 35:45–36:50 | 65 s | 60 s | 500 |
| 7 Missing Piece | 14.01 → 15.01 | 44:00–47:00 | 180 s | 165 s | 1,000 |
| รวมเกม | | | **855 s / 14:15** | **760 s / 12:40** | **ไม่กำหนดเพดาน (เกมอื่นรวมสูงสุด 5,400)** |

เนื้อหา ลงทะเบียน อันดับ และรางวัลรวม 2,145 วินาที / 35:45; รวมทั้งงาน 3,000 วินาที ไม่มีเวลาเผื่อซ่อนอยู่ โหมดกระชับประหยัดได้สูงสุด 95 วินาทีจากเกม โดยตัดบทอภิปราย/สรุป/ช่วงโชว์ที่ยังไม่มีอินพุตเท่านั้น

**ปรับตามผู้จัดตรวจเอง:** ย้าย 50 วินาทีจากบทอภิปราย/เชื่อมเกม 1 ไปเกม 3 และเพิ่มเวลาตรวจภาพเกม 7 โดยตัดช่วงชวนเล่าทางเลือกหลังเกม ไม่ลดเวลาวาดหรือโหวต ตารางซ้อม .md/.csv อัปเดตเป็นเป้าหมายแผนนี้แล้ว แต่เวลาใน src/spoken.ts และบทที่สร้างจาก source ยังต้อง sync ตอนเริ่มพัฒนา

เวลาตารางนับตั้งแต่เข้าคิวเกม รวมอธิบาย ทดลอง โหลดผล ยืนยัน และคืนสไลด์ ส่วนเวลาเล่นที่มีคะแนนเริ่มหลัง Start และนับถอยหลังจาก server; GAME_READY ไม่เริ่มเองเมื่อถึงนาฬิกา

### 2.2 จุดตัดเวลา

1. เปรียบเทียบเวลางานจริงกับปลายคิว 05.01 = 16:00, 08.01 = 26:00, 12.01 = 38:00 และก่อนเกม 7 = 44:00
2. ช้าถึง 30 วินาที: แสดงคำเตือนและเวลาที่เกิน ผู้พูดย่อคำถามปิด/บทเชื่อมในคิวปัจจุบัน
3. ช้าถึง 60 วินาที: เสนอใช้โหมดกระชับกับเกมที่ยังไม่เริ่ม ผู้จัดเลือกก่อน Start; บันทึก timingProfile ใน run
4. ช้าถึง 95 วินาที: ประหยัดจากเกมอย่างเดียวไม่พอ ให้ใช้บทพูดฉบับสั้นที่เตรียมไว้ในคิวเนื้อหาที่ยังไม่ผ่าน; ต้องยังสื่อข้อจำกัดหลักฐานและความรับผิดชอบครบ
5. เมื่อเกมเริ่มแล้ว ไม่ลดหน้าต่างตอบ/วาด/โหวต ไม่ลดจำนวนโจทย์ ไม่ข้ามงานบางกลุ่ม และไม่จบอินพุตกลางรอบเพื่อไล่เวลา
6. เมื่อถึงปลายคิวเป้าหมายและอยู่ RESULT/อภิปราย ให้เตือนจบอภิปรายและให้ผู้จัดกด “จบเกม / ไปต่อ” เอง ปลายคิวเป็นเป้าหมายซ้อม ไม่ยืนยันคะแนน/จบเกม/เลื่อนสไลด์แทน Host
7. หากเป็นเหตุขัดข้องจนเล่นต่อไม่ได้ ผู้จัด Cancel พร้อมเหตุผล เกมนั้นแสดง “ยกเลิก / ไม่นับคะแนน”; ห้ามใส่ 0 สมมติแทนเกมที่ยังไม่จบ
8. รอบตรวจงานไม่ผ่านเวลาซ้อมให้ปรับตาราง/เพดานความยาวเนื้อหาและซ้อมใหม่ก่อนวันงาน โดยยังยึดผู้จัดตรวจเอง ไม่ใช้การปล่อยงานที่ยังไม่ตรวจเป็นทางลัด

โหมดกระชับต้องกำหนดครบในเนื้อหาเกมก่อนเริ่มห้อง การเปลี่ยนหลัง Start เปลี่ยนได้เฉพาะช่วงพูดที่ยังไม่เริ่มและไม่มีผลต่อสิทธิ์/เวลาอินพุต โดยมี audit log

## 3. ระบบกลางที่ต้องเสร็จก่อนเกม

### 3.1 ห้อง สมาชิก และความพร้อม

- หน้า Player ที่เสนอ: `/play/:roomCode`; ผู้จัด `/presenter/:roomCode`; จอ `/display/:roomCode` ต้องกำหนดตัวตนอ่านข้อมูลจอแยกจากสิทธิ์ควบคุม
- สร้าง anonymous identity เฉพาะครั้งแรก ตรวจ session เดิมก่อนสร้างใหม่ ผูก auth user กับ membership ของห้อง
- กรอกชื่อเล่น 1–24 ตัวอักษรที่มองเห็นและเลือกหนึ่งใน 8 กลุ่ม; trim ช่องว่าง ใช้ข้อความธรรมดา ชื่อซ้ำได้โดยมีรหัสสั้น
- เลือกกลุ่มเองได้ก่อนล็อกทีม; หลังล็อก Host ย้ายได้พร้อมเหตุผล มีผลกับ roster เกมถัดไป ไม่แก้ผลเกมที่เริ่มแล้ว
- ไม่ตั้ง min/max สมาชิกบังคับต่อกลุ่ม; 4–6 คนเป็นแนวทางจัดงาน แสดงจำนวนให้ผู้เล่นเลือกและผู้จัดดูได้ แม้กลุ่มไม่เท่ากันสูตรคะแนนยังใช้ roster จริง
- ผู้มาช้าหลังล็อกทีมยังเลือกกลุ่มที่มีที่ว่างได้; ไม่มีสิทธิ์เกมที่เริ่มแล้ว; capacity เต็มให้สถานะผู้ชม/รอ ไม่สร้าง roster เกินจำนวนที่อนุมัติ
- สมาชิกอ่านสมาชิกกลุ่มตนเอง จำนวนคน และ Presence; คนหลุดยังเป็นสมาชิก ไม่ลดตัวหารคะแนน
- `readyForRun` = session ใช้ได้ + snapshot ล่าสุด + asset ของเกมโหลดและ decode แล้ว + contentVersion ตรง; ส่งหลักฐานความพร้อมสำหรับ preview เกมนั้น
- Start เตือนจำนวนไม่พร้อม แต่ไม่บล็อกเพราะผู้เล่นไม่พร้อม; guard ที่ยังบล็อกคือไม่มีสิทธิ์ Host, run อื่นยังไม่จบ, cue ไม่ตรง, ชุดเนื้อหาขาด/ยังไม่อนุมัติ หรือ backend ยืนยันคำสั่งไม่ได้
- คนไม่พร้อมอยู่ใน roster ตาม membership เมื่อ Start; กลับมาแล้วใช้เวลาร่วมที่เหลือ คนที่ยังไม่เห็นโจทย์ไม่เปิดปุ่มตอบและไม่มีเวลาชดเชยส่วนบุคคล
- ออกจากห้องต้อง explicit leave; ไม่ sign-out เมื่อพับจอหรือหลุด Realtime

### 3.2 วงจรเกมและเวลา

```text
WAITING → GAME_READY → COUNTDOWN → เฟสของแต่ละเกม
        → RESULT → CONFIRMED → COMPLETED → WAITING
```

- ถึง cue เกมแล้วสร้าง/คืน preview ที่ GAME_READY; Start จึงสร้าง run และ roster ครั้งเดียว ล็อกทีมด้วย transaction เดียวกันถ้าเป็นเกม 1
- ทุก run เก็บ gameId, contentVersion, scoringVersion, timingProfile, roster, startAt, phaseToken, deadline, version, pauseHistory และ controllerEpoch
- ใช้นาฬิกา server; frontend คำนวณภาพจาก serverNow/deadline และชดเชย clock offset เมื่อ snapshot ไม่ส่ง timer ทุกเฟรม
- ช่วงทดลองมี practiceId แยกจาก run ที่คิดคะแนน ไม่รับคะแนนทดลองเข้าผลจริง
- ช่วงรับอินพุตใช้ startAt ≤ acceptedAt < deadline โดย acceptedAt มาจาก DB ใน transaction เดียวกับการรับ ไม่ใช้เวลาของ browser/แต่ละ API instance; phaseToken เปลี่ยนเมื่อ Pause/Resume เพื่อกันคำขอค้างจากเฟสเดิม
- Pause ปิดรับอินพุตและหยุด active elapsed time; Resume ต่อเวลาที่เหลือด้วย deadline ใหม่ ไม่ reset คำตอบ ชีวิต หรือเส้น
- Backend reconcile เฟสที่หมดเวลาใน snapshot/advance/อินพุต transaction; จอและผู้เล่นดึง snapshot ขณะ active เพื่อให้เดินเฟสได้แม้ Host ล่ม
- คำสั่ง Host ใช้ expectedVersion และ idempotencyKey; อินพุต Player ใช้ runId/phaseToken/revision/sequence ตามชนิด ไม่บังคับ global room version ที่เปลี่ยนจากคนอื่นกับทุกคำตอบ
- รับอินพุตตามเวลาถึง server ไม่มีการ backdate จากเวลาในเครื่อง; retry คำขอเดิมต้องคืน acknowledgement เดิมโดยไม่คิดซ้ำ
- Lock navigation ตั้งแต่ COUNTDOWN ถึง Host Complete รวมปุ่ม keyboard, window.deck adapter และ API เปลี่ยน cue
- RESULT ไม่มี deadline สำหรับ complete/next ค้างได้จน Host กดเอง คำสั่งไปต่อในบริบท RESULT ต้องเรียก finish-and-next ไม่ใช่ cue API ที่ข้ามการยืนยันคะแนน
- `finish-and-next` ตรวจ input digest/result/Host/controllerEpoch แล้ว commit คะแนน + COMPLETED + room nextCue/activeRun pointer + receipt/outbox พร้อมกัน ถ้า error ยังค้างผล ถ้ากดซ้ำไม่ข้าม cue เพิ่ม
- กลับคิวที่จบแล้วคืนผลเดิม Replay เป็นคำสั่งแยกที่ supersede run เก่าและเก็บเหตุผล

### 3.3 คะแนนและการโหวตร่วม

```text
individual games: groupScore = sum(finalPlayerScores) / rosterCount
rosterCount = 0 → groupScore = 0 และแสดง “ไม่มีผู้เล่น”

creative games:
support(candidate) = average(votesFromGroup / rosterCountOfGroup)
เฉลี่ยเฉพาะกลุ่มที่มีสมาชิกและมีสิทธิ์โหวต candidate นี้
candidate ของคน: ยกเว้นกลุ่มเจ้าของ; candidate AI: รวมทุกกลุ่ม
best = support สูงสุดของ candidate ที่ผ่านตรวจ
sharedScore = best > 0 ? round(1000 × support / best) : 0
```

- คะแนนตัวแทนให้ทุกสมาชิกใน roster เท่ากัน; กลุ่มไม่มี candidate ได้ 0 แต่ยังโหวตกลุ่มอื่นได้
- สมาชิกมี internal vote หนึ่งเสียงและ final vote หนึ่งเสียง เปลี่ยนได้ตาม revision ก่อนปิดเฟสนั้น
- Internal vote เลือกผลงานตนเองได้; final vote ห้ามกลุ่มตนเอง ตรวจจาก roster ฝั่ง server
- Internal tie เลือกงานที่รับถูกกติกาครั้งแรกเร็วกว่า ถ้า timestamp เท่ากันใช้ submission ID เป็นลำดับคงที่; ไม่มีเสียงใช้ตัวเลือกเดียวกัน; ไม่มีงานให้ไม่มี candidate
- Final tie แสดงผู้ชนะร่วม ไม่มีตัวตัดสินความเร็ว; ไม่มีเสียงเลยทุกกลุ่มได้ 0
- สุ่มตำแหน่ง candidate ครั้งเดียวต่อ run แล้วคงตำแหน่งเมื่อ reconnect; ไม่เผยเจ้าของก่อนจบ final vote
- เก็บเศษส่วนผลรวม/ตัวหารสำหรับคะแนนเฉลี่ยและคำนวณอันดับแบบไม่เสียความแม่นยำจาก float; ปัดสองทศนิยมเฉพาะการแสดง
- Finish-and-next commit คะแนน, active scoring run, COMPLETED, cue ถัดไป และ event outbox ใน transaction เดียวกัน; กดซ้ำและ Replay ไม่เพิ่มคะแนนซ้ำ Confirm/Complete เป็นขั้นภายใน ไม่ต้องกดสองปุ่ม
- จอใหญ่แสดง `คะแนน / สมาชิกใน roster N คน`; หน้าสรุปรวมระบุ roster ของเกมล่าสุด และเปิด breakdown ของแต่ละเกมได้ ไม่ใช้สมาชิกปัจจุบันแอบแทนตัวหารย้อนหลัง

### 3.4 Realtime และ Host สำรอง

**เมื่อ Realtime หลุดแต่ API ใช้ได้:** เก็บ snapshot ล่าสุดไว้ใน memory/cache ที่ผูก room/release; จอหยุดภาพที่ตรวจสอบแล้วไว้ ไม่แสดงผลใหม่ที่คาดเดา; fetch snapshot ทุก 2 วินาทีระหว่างเกมพร้อม jitter และ backoff เมื่อ error แล้วแสดง snapshot ที่ server ยืนยันใหม่ได้ Player ส่งคำตอบผ่าน HTTP ได้เมื่อ snapshot สดและ server อนุญาต

**เมื่อ API หลุดด้วย:** Player แสดง “ยังส่งไม่สำเร็จ” ปิดอินพุตที่ยืนยันเฟสไม่ได้ และไม่ replay คำตอบเก่าเป็นคำตอบใหม่; ข้อความร่าง/เส้นคงไว้สำหรับกู้ตามเฟสที่อนุญาต จอคงภาพ/ผลล่าสุดพร้อมข้อความสั้น “กำลังเชื่อมต่อ” ไม่เปลี่ยนเป็นหน้าว่างหรืออันดับ 0

**เมื่อเชื่อมกลับ:** subscribe ด้วย token ปัจจุบัน → fetch snapshot → reconcile room/run/version และคะแนน → คืนภาพตามเฟสจริง ไม่รับ event เก่าทับ snapshotใหม่ ไม่เดินสไลด์ย้อนหลัง ไม่ให้เวลาตอบเพิ่มเพราะมี event ตกหล่น

สถานะที่ต้องส่งให้ Host แม้ยังไม่ออกแบบ layout: Realtime `connected/reconnecting/disconnected`, API `reachable/unreachable`, lastSnapshotAt, lastConfirmedAt, version, จำนวนเครื่องพร้อม และจำนวนงานค้างตรวจ สีต้องมีข้อความกำกับ

การกู้เครื่อง Host:

1. เตรียมเครื่องสำรอง login บัญชีที่มีสิทธิ์ห้องจริงและ bookmark URL เดิมก่อนเริ่มงาน ไม่ให้ QR ผู้เล่นเป็นทางเข้า Host
2. เก็บ control lease ใน DB: heartbeat ทุก 5 วินาที, lease 20 วินาที; ถ้าเสียการติดต่อเกิน lease เครื่องสำรอง acquire ได้
3. เปิดห้องเดิมและ fetch activeCue/run/phase/deadline/roster/คะแนน/งานตรวจ ไม่สร้าง room หรือ run ใหม่
4. Takeover เพิ่ม controllerEpoch แบบ atomic; คำสั่งจากเครื่องเก่าที่กลับมาต้องถูกปฏิเสธด้วย stale controller token จนกว่าจะรับสิทธิ์ใหม่
5. ถ้า lease เดิมยัง valid ต้องมีคำสั่ง takeover ชัดเจนจาก Host ที่ได้รับสิทธิ์ พร้อม audit; ผู้ตรวจงานไม่ถือ control lease และกด Start/Confirm ไม่ได้
6. เกมเดินตามเวลาบันทึกเดิม ผู้จัดใหม่เลือก Pause ได้เมื่อ API กลับใช้ได้ เป้าหมายซ้อมคือกลับมาคุมได้ภายใน 60 วินาทีโดยคะแนนไม่ซ้ำ
7. เครื่องฉายเสียด้วยให้เปิด Display URL เดิมและใช้สิทธิ์จอจากเครื่องสำรอง; ตรวจ fullscreen และการเปิดเสียงด้วย user gesture อีกครั้ง

## 4. เกม 1 — Trust Tug-of-War

`gameId: trust-tug` · `cue: 02.01` · กลับ `03.01` · 10 คะแนนต่อแตะที่รับสำเร็จ ไม่มีเพดานรวม

### 4.1 ประสบการณ์และเฟส

1. GAME_READY แสดง “ตอนนี้ไว้ใจ Human หรือ AI มากกว่า?” ทุกคนเลือก/แก้ฝั่งได้ก่อน Start; ฝั่งส่วนบุคคลไม่เปลี่ยนกลุ่ม
2. ทดลองแตะในช่วง 15 วินาที ไม่นับคะแนนและไม่ใช้ counter เดียวกับ run จริง
3. Start snapshot roster, ล็อกทีมและฝั่ง, ซ่อน QR, COUNTDOWN 3 วินาที → PULLING 10 วินาที
4. ปุ่ม “ดึง!” รับ pointerdown หนึ่งครั้งต่อการแตะ ไม่มี auto-repeat เมื่อกดค้าง; ตัวเลข local ระบุชั่วคราวจนได้ acknowledgement
5. LOCKED → RESULT แสดงจำนวนแตะที่ยอมรับ คะแนนของตน และแรงเฉลี่ยของสองฝั่ง ค้างรอผู้จัดกด “จบเกม / ไปต่อ”

ถ้าไม่ได้เลือกฝั่งก่อน Start ให้เป็น `UNSELECTED`, ไม่ได้แตะทำคะแนนเกมนี้ และไม่นับในตัวหารฝั่ง Human/AI แต่ยังอยู่ในตัวหารกลุ่มแข่งขัน ไม่สุ่มฝั่งให้เอง

### 4.2 อินพุตและคะแนน

- `side-choice`: playerId จาก token, previewId, side, revision; รับเฉพาะ GAME_READY
- `tap-batch`: runId, phaseToken, batchId, event IDs/sequence; ส่งทุก 100 ms ขณะมีการแตะ ไม่ส่งคำขอว่าง
- Server จำกัด 10 taps ต่อหน้าต่าง 1 วินาทีตามเวลารับ แต่ไม่มีเพดานรวมต่อคน; รับบาง event ได้ให้ตอบ accepted/rejected แยกราย event
- ปิด PULLING แล้วไม่รับ tap ใหม่ แม้แตะบนเครื่องก่อนหมดแต่ส่งช้า; retry batch ที่ commit แล้วคืนผลเดิมได้
- คะแนนรายคน = 10 × acceptedTapCount ไม่มีเพดานคะแนน; คะแนนกลุ่ม = ค่าเฉลี่ยจาก roster
- แรงฝั่ง = accepted taps รวม / จำนวนคนที่ล็อกฝั่งนั้น; เสมอแสดงเสมอ ไม่มีฝ่ายหนึ่งให้ “ไม่มีคู่เปรียบเทียบ”; ผลฝั่งไม่มีโบนัสคะแนน

### 4.3 เวลาและจอฉาย

| ช่วง | วินาที |
|---|---:|
| อธิบาย/เลือกฝั่ง | 35 |
| ทดลอง | 15 |
| เช็กพร้อม 7 + countdown 3 | 10 |
| แตะจริง | 10 |
| ประมวลผล/ผล/ยืนยัน | 20 |
| อภิปราย | 20 |
| จบ/เชื่อมสไลด์ | 20 |
| รวม | **130** |

Display แสดงเชือก จำนวนผู้เลือกฝั่ง และแรงเฉลี่ย; อัปเดตผลรวมไม่เกิน 2 Hz ไม่เปิดอันดับรายคน โหมดกระชับลดผลเป็น 10 และเชื่อม 10 โดยอภิปราย 20 เท่าเดิม รวม 110 วินาที

### 4.4 งานสร้างและตรวจรับ

- สร้างหน้าตั้งฝั่ง/ทดลอง/ปุ่มแตะ/ผล, API batches, fixed roster และ aggregate สองฝั่ง
- เตรียมคำถามขึ้นจอและคำถามปิด ไม่ต้องเตรียมคำเฉลย
- รับเกิน 50 taps แล้วคะแนนยังเพิ่มตามจำนวนที่ยอมรับ; event ซ้ำไม่เพิ่มแต้ม; กดค้างไม่นับรัว และ rate limit 10 taps/วินาทียังทำงาน
- ผู้เล่น 4 คนได้ 600/400/100/0 → กลุ่ม 275.00; หลุดหนึ่งคนตัวหารยังเป็น 4
- Refresh ระหว่างแตะคืน counter ที่ยืนยันแล้ว เวลาไม่เริ่มใหม่; เลือกฝั่งหลัง Start ถูกปฏิเสธ
- ฝั่งเดียวและไม่มีคนเลือกฝั่งต้องแสดงตามจริง ไม่สร้างผู้ชนะจากข้อมูลว่าง

## 5. เกม 2 — Swipe Court

`gameId: ai-or-human` · `cue: 03.05` · กลับ `03.03` · เต็มรายคน 800

### 5.1 ชุดเนื้อหาที่ต้องเสร็จก่อนเริ่ม

- ภาพเดี่ยว 8 ภาพ: คนทำ 4 / AI 4 ไม่บอกสัดส่วนก่อนเล่น; ไม่ใช้ FLAMINGONE หรือภาพที่เฉลยไปแล้ว
- จัดง่าย 2, เนื้อหาใกล้กันแต่ที่มาต่างกัน 4, คนเหนือจริง/AI ธรรมดา 2; ไม่ใช้ไฟล์ผสมที่จัดประเภทไม่ชัด
- Asset manifest เก็บ id, publicImagePath, dimensions, creator, provenance, classification, license, revealText และ contentVersion; เฉลย/เครดิตที่เปิดคำตอบเก็บในส่วน server ตามจังหวะที่สิทธิ์อนุญาต
- ตรวจ license ก่อนเลือกภาพ หากต้องแสดงเครดิตที่เปิดคำตอบก่อนเกมให้เปลี่ยนภาพ ไม่ลบเครดิตฝืนเงื่อนไข
- Preload/decode ทั้ง 8 ภาพใน GAME_READY; readiness ที่ไม่ครบยังเตือนแต่ไม่บล็อก Start; เครื่องนั้นไม่เปิดการตอบจนภาพรอบปัจจุบันเห็นจริงและใช้ deadline เดิม

### 5.2 วิธีเล่นและสถานะ

1. กติกา “ซ้าย = คน / ขวา = AI” ค้างทั้งป้ายและปุ่มสองทาง มีปุ่มแทนการ swipe
2. COUNTDOWN → 8 × ANSWERING 4 วินาที; รับคำตอบครั้งแรกที่ server รับเท่านั้น → LOCKED → ภาพถัดไป
3. การลากต้องผ่าน threshold 20% ของความกว้างการ์ด โดย clamp ไว้ที่ 48–96 CSS px; ถ้าไม่ผ่านให้กลับกลางและยังไม่ส่ง
4. ไม่บอกถูกผิด/คะแนนต่อภาพ ไม่ส่ง classification ใน URL, response, metadata หรือ payload ก่อน REVEAL_ALL
5. จบ 8 ภาพ เฉลยภาพละ 3 วินาที + สรุป 6 วินาที มือถือเทียบคำตอบตนเองครบทุกภาพ

### 5.3 คะแนน สถิติ และกู้สถานะ

- `answer`: runId, phaseToken, imageId, choice, idempotencyKey; unique(runId, playerId, imageId)
- ถูก +100, ไม่ตอบ/ช้า/ผิด 0, max 800; ไม่มี speed bonus
- เปอร์เซ็นต์คน/AI ต่อภาพใช้จำนวน accepted answers; คน = round(100 × human / answered), AI = 100 − คน
- ไม่ตอบแสดงแยก; answered = 0 แสดง “ไม่มีคำตอบ”; ความแม่นยำทั้งห้อง = correct accepted answers / accepted answers ทั้ง 8
- Reconnect คืนภาพปัจจุบันและคำตอบเดิม ไม่เปิดรอบที่ผ่านแล้วให้ตอบ ไม่แสดงคะแนนก่อน REVEAL_ALL

### 5.4 เวลาและจอฉาย

| ช่วง | วินาที |
|---|---:|
| กติกา 7 + countdown 3 | 10 |
| 8 ภาพ × 4 | 32 |
| เฉลย/ผล/ยืนยัน | 30 |
| อภิปราย/จบ/เชื่อม | 18 |
| รวม | **90** |

Display เห็นภาพเดียวกับมือถือ ระหว่างเล่นมีรอบ/เวลา/จำนวนตอบ แต่ไม่เฉลย; หลังเล่นแสดงทั้ง 8 พร้อมสถิติและที่มา โหมดกระชับลดช่วงท้าย 18 → 8 รวม 80 วินาที

### 5.5 งานสร้างและตรวจรับ

- สร้าง content loader, swipe/ปุ่มทางเลือก, synchronized image rounds และ reveal grid
- คำตอบแรกล็อก; เปิดสองแท็บไม่ตอบสองครั้ง; tap กับ swipe พร้อมกันคิดครั้งเดียว
- ทดสอบตอบถูกครบได้ 800, ไม่มีคำตอบไม่มี NaN, 1/3 ของห้องตอบคนแสดง 33/67 และจำนวนไม่ตอบตรง roster
- Inspect network ก่อนเฉลยต้องอ่าน answer key ไม่ได้; ผู้เล่นอื่นอ่านคำตอบส่วนบุคคลไม่ได้
- เครื่อง preload ไม่ครบไม่เห็นเวลารอบใหม่เพิ่มและไม่ส่งคำตอบจากการ์ดที่ยังไม่แสดง

## 6. เกม 3 — Caption & Prompt Battle

`gameId: caption-battle` · `cue: 04.01` · กลับ `04.02` · เต็มกลุ่ม 1,000

### 6.1 ชุดเนื้อหา

- ภาพมีม 1 ภาพที่มีสิทธิ์และอ่านได้บนมือถือ พร้อมโจทย์เดียวกันทั้งห้อง
- AI caption 1 ข้อ สร้างก่อนวันงานด้วยภาพ/ภาษา/เพดานเดียวกัน เก็บ prompt, model/version, เวลา และวิธีเลือกที่ล็อกไว้ก่อนเห็นผู้เล่น
- ไม่เรียก AI สด ไม่เพิ่มรอบเขียน prompt ใน 140 วินาที

### 6.2 ทุกคนสร้างและเลือกตัวแทน

1. COUNTDOWN → WRITING 20 วินาที; ทุกคนเขียนได้หนึ่ง caption ไม่เกิน 80 grapheme clusters นับไทย/สระ/emoji ตามตัวอักษรที่เห็น
2. Autosave draft ส่งทุก 1 วินาทีเมื่อเปลี่ยน พร้อม revision; ปุ่มส่งทันที; draft บนเครื่องไม่ถือเป็น accepted submission จนได้ acknowledgement
3. ปิด WRITING ล็อก revision ล่าสุดที่รับก่อน deadline → MODERATING **60 วินาที**; ผู้จัดหยุดบรรยายและตรวจ revision ที่ล็อกแล้ว
4. INTERNAL_VOTE 10 วินาที เลือกเฉพาะ caption กลุ่มตนที่ผ่านตรวจ; ทุกคนหนึ่งเสียงและเลือกของตนได้
5. FINAL_VOTE 20 วินาที แสดงตัวแทนได้สูงสุด 8 กลุ่ม + AI เป็นรหัสนิรนาม; ห้ามเลือกกลุ่มตัวเอง
6. RESULT เป้าหมายแสดง 10 วินาที เปิดเจ้าของ คะแนน/จำนวนเสียง/support ตามจริง → ช่วงเชื่อม 10 วินาทีและผู้จัดกด “จบเกม / ไปต่อ” เอง; ไม่ complete เมื่อครบเวลาหน้าผล

### 6.3 การตรวจข้อความและขอบเขตเวลา

- Filter รูปแบบ: normalize Unicode, จำกัดความยาว, ข้อความธรรมดา, ไม่รับ markup/link ที่ไม่อยู่ในโจทย์ และกรองคำ/รูปแบบที่ผู้จัดกำหนดไว้
- ผล filter = ผ่านรูปแบบ/ต้องตรวจ/ไม่ผ่านรูปแบบ ไม่อ้างว่าผ่านรูปแบบแล้วเหมาะสมทั้งหมด
- ผู้ตรวจเริ่มดู draft ได้ระหว่าง WRITING แต่สถานะอนุมัติผูก revision; แก้ข้อความแล้วต้องตรวจ revision ใหม่
- ผู้จัดเป็นผู้ตรวจคนเดียว อ่านกริดข้อความพร้อมคีย์ลัด Reject/Approve และเหตุผลสั้น ไม่มีการออกแบบ layout Host ในแผนนี้; review lease รองรับเครื่องสำรองรับงานต่อโดยไม่ตัดสินซ้อน
- เป้าหมายซ้อม 32 captions ใน 60 วินาทีหลังล็อก หรือเฉลี่ย 1.875 วินาทีต่อข้อความ ระหว่างนี้ไม่บรรยาย ผู้เล่นคุยกันได้แต่ยังไม่โหวต; หากไม่ผ่านต้องปรับเวลา/ความยาวโจทย์ก่อนวันงาน ไม่สมมติว่าจะมีผู้ช่วย
- งานยังไม่ตรวจเมื่อหมดเวลาไม่เผยแพร่/แข่งขัน และไม่ถือว่าผู้เล่นไม่ส่ง; เข้าสถานะ `REVIEW_REQUIRED` หยุดก่อนเปิดโหวตเพื่อให้ Host/ผู้ตรวจเคลียร์ หรือ Cancel ทั้ง run ไม่ให้กลุ่มท้ายคิวเสียสิทธิ์อย่างเงียบ ๆ
- การ withheld รายงานหนึ่งชิ้นต้องมีเหตุผลและผู้ตัดสิน audit เช่น ส่งไม่ครบ/thumbnail ล้มเหลว ไม่ตัด pending ด้วยเวลาเพียงอย่างเดียวแล้วเดินโหวตเอง
- Caption AI ต้องผ่านตรวจและล็อกล่วงหน้า ถ้าไม่มี caption กลุ่มก็โหวต AI ได้; AI ไม่ได้แต้มสะสมใน 8 กลุ่ม

### 6.4 อินพุต คะแนน และเวลารวม

- `caption`: runId, text, revision, idempotencyKey; unique(runId, playerId)
- `moderation`: submissionId, lockedRevision, decision, reason, expectedReviewVersion
- `internal-vote` / `final-vote`: candidateId, revision; unique(runId, playerId, voteType)
- คะแนนตาม support/sharedScore ใน §3.3; คืนโหวตล่าสุดเมื่อ reconnect; ไม่เปิด candidate ที่ถูก reject

| ช่วง | วินาที |
|---|---:|
| กติกา 7 + countdown 3 | 10 |
| เขียน | 20 |
| ตรวจ revision สุดท้าย | 60 |
| เลือกตัวแทน | 10 |
| โหวตสุดท้าย | 20 |
| ผล/เปิดผู้สร้าง/ยืนยัน | 10 |
| จบ/เชื่อม | 10 |
| รวม | **140** |

Display แสดงภาพ/โจทย์ระหว่างเขียน ขึ้น “ผู้จัดกำลังตรวจผลงาน” ในช่วงตรวจ แล้ว candidate นิรนามในรอบสุดท้าย; ไม่ฉาย draft หรือข้อความยังไม่ตรวจ โหมดกระชับผล 10 → 5 และเชื่อม 10 → 5 รวม 130 วินาที

### 6.5 งานสร้างและตรวจรับ

- สร้าง text editor/grapheme counter, autosave revisions, moderation queue, nomination และ final vote ร่วมกับเกม 7
- 80 ตัวอักษรที่เห็นผ่าน, 81 ไม่ผ่าน; emoji/สระไทยไม่ถูกตัดกลางตัวอักษร
- Caption แก้หลัง deadline ถูกปฏิเสธ งาน reject ไม่เลือกได้; งานแก้หลังตรวจต้องตรวจใหม่
- ทดสอบกลุ่มขนาด 5/10/15 กับจำนวนคนหลุดเพื่อยืนยันน้ำหนักตาม roster คงที่
- support 0.30/0.20/0.10 และไม่มี candidate สูงกว่า → 1000/667/333; ถ้า AI best สูงกว่าให้ normalize เทียบ AI
- ไม่มีงาน/ไม่มีเสียง/tie/หลายแท็บ/reconnect ใช้กติกาเดียวกันทุกกลุ่ม

## 7. เกม 4 — Death Cap Roulette

`gameId: confidence-roulette` · `cue: 07.01` · กลับ `07.02` · เต็มรายคน 1,200

### 7.1 ชุดโจทย์รุ่นแรก

| ด่าน | ข้ออ้าง/บริบทสั้น | เฉลย | ความมั่นใจจำลอง |
|---|---|---|---:|
| 1 | 4 ขวด × 250 มล. = 1 ลิตร | รองรับได้ | 82% |
| 2 | ออก 10:00 เดิน 2 ชม. ไม่มีพัก/เปลี่ยนเขตเวลา ถึงเที่ยง | รองรับได้ | 98% |
| 3 | ราคา 100 ลด 20% เหลือ 90 | ผิด: เหลือ 80 | 99% |
| 4 | เอกสารไม่มีวันที่ ควรตรวจฉบับปัจจุบันก่อนใช้ | เหมาะตามโจทย์ | 71% |
| 5 | มั่นใจ 99.8% หมายถึงไม่มีโอกาสผิด | ข้อสรุปไม่ตามจากตัวเลข | 99.8% |
| 6 | ภาพเห็ดไม่มีผลตรวจ แต่บอกว่ากินได้แน่นอน | หลักฐานไม่พอรับรอง | 99.8% |

ล็อกถูก/รองรับได้ 3 ข้อ และผิด/ยืนยันไม่ได้ 3 ข้อ มีหลักฐานเฉลยสั้นและรอบทดลองคนละโจทย์ ไม่ให้ผู้เล่นระบุเห็ดหรือทดลองกินจริง ตัวเลขทั้งหมดเป็นการจำลอง

### 7.2 วิธีเล่นและคะแนน

1. เริ่ม `ALIVE`, provisionalPoints 0 → ทดลอง → COUNTDOWN → ด่านจริง 6 ด่าน
2. แต่ละด่าน ANSWERING 4 s → REVEAL 5 s → TRANSITION 3 s; ตอบเชื่อ/ไม่เชื่อครั้งแรกที่ server รับเท่านั้น
3. เชื่อถูก +300; ไม่เชื่อข้อผิด/ยืนยันไม่ได้ +100; ไม่เชื่อข้อถูก +0; ไม่ตอบ +0 และยัง ALIVE
4. เชื่อผิด/ยืนยันไม่ได้ → `DEAD` แบบ atomic, คะแนนเกม 4 = 0 ทั้งหมด, eliminatedAtRoundId; ไม่กระทบเกมอื่น
5. ผู้ตายเป็น SPECTATING ส่งคำตอบ/ได้คะแนนเพิ่มไม่ได้ ไม่เห็นเฉลยด่านถัดไปก่อนผู้รอด
6. จบทุกด่าน score ของ ALIVE = แต้มคงเหลือ; DEAD = 0; **คะแนนกลุ่มเฉลี่ย roster ไม่ใช้คะแนนสูงสุด**

### 7.3 เวลาและ Display

| ช่วง | วินาที |
|---|---:|
| อธิบาย | 17 |
| ทดลอง | 12 |
| Countdown | 3 |
| 6 ด่าน × 12 | 72 |
| ผล/จำนวนรอด/ยืนยัน | 16 |
| อภิปราย | 30 |
| จบ/เชื่อม | 10 |
| รวม | **160** |

Display แสดงโจทย์/เวลา/ความมั่นใจจำลอง รอบเฉลยจึงแสดงเหตุผลและผู้รอดตามกลุ่ม พร้อม `รอด X / roster N`; ไม่มีอันดับรายคน โหมดกระชับลดอภิปราย 30 → 10 รวม 140 วินาที

### 7.4 งานสร้างและตรวจรับ

- สร้าง decision round engine/answer lock, life state, spectator view และ reset คะแนนเกมนี้
- เส้นทาง 1–6 ถูกครบ = 1200; ไม่เชื่อทุกข้อ = 300; ไม่ตอบทุกข้อ = 0 และรอด
- เชื่อถูกสองข้อได้ 600 แล้วเชื่อข้อ 3 → DEAD/0; รีเฟรช/สองแท็บไม่คืนชีพ
- Pause/reconnect อยู่ด่านเดิมตามเวลาจริง ผู้ตายเล่นเกม 5 ได้
- Answer key อ่านไม่ได้ก่อนเฉลย สถานะตายของคนหนึ่งไม่ทำให้อีกคนตาย
- แก้ 07.02 ใน src/content.ts, src/Visuals.tsx, src/World.ts, src/spoken.ts และเอกสารบทพูดที่สร้างจาก source; ปัจจุบัน World.ts ทำเลขแกว่ง 99.7–99.9 จึงต้องแก้ตัวขับเลขด้วย ไม่แก้แค่ค่าตั้งต้นการ์ด
- ตรวจ 07.02 หลายเฟรมให้แสดง 99.8% ตรงกัน แล้วสร้าง PDF ใหม่ในขั้นส่งมอบสไลด์

## 8. เกม 5 — Chat Whack-a-Mole

`gameId: chat-whack-a-mole` · `cue: 10.02` · กลับ `10.03` · เต็มรายคน 900

### 8.1 ชุดข้อความและตารางเกิด

บริบทค้าง: “ผู้ใช้ขอคุยกับเจ้าหน้าที่ และบอกว่าคำแนะนำเดิมทำให้ไม่สบายใจ” ใช้ 18 ฟองจากคู่มือ: ควรหยุด 9 / ควรปล่อย 9 เช่น “ไม่ต้องคุยกับเจ้าหน้าที่” เทียบ “ฉันช่วยติดต่อเจ้าหน้าที่ได้” เป็นบทสนทนาจำลอง

Manifest เก็บ bubbleId, text, slot, spawnAt, expiresAt, classification, explanation; public payload ไม่มี classification/explanation ก่อนถึงจังหวะผล ตารางเริ่มต้นที่เสนอใช้ spawn เวลา 0, 2.4, 4.8, 6.0, 7.2, 8.4, 9.6, 10.8, 12.0, 13.2, 14.4, 15.6, 16.8, 18.0, 19.2, 20.4, 21.5, 22.6 s; อายุ 2.4 s ทำให้ฟองสุดท้ายหมดที่ 25.0 s

ใช้ช่อง 2×3; สองฟองแรกขึ้นครั้งละหนึ่งฟองเพื่อสอนจังหวะ ชุดตารางต้องตรวจ overlap/slot ด้วย script ก่อนล็อก contentVersion; สูงสุด 3 ฟองพร้อมกันและไม่ใช้ช่องที่ยังไม่ว่าง เลือก slot ล่วงหน้าแบบวน 0–5 และสลับประเภทข้อความใน content manifest ไม่สุ่มต่างกันรายเครื่อง

### 8.2 เล่นและยืนยันอินพุต

1. อ่านบริบท/ทดลอง 5 s → COUNTDOWN 3 s → ARCADE_PLAY 25 s
2. แตะเฉพาะฟองที่ควรหยุด มี feedback “กำลังตรวจ/หยุดแล้ว” ตาม acknowledgement; ไม่ต้องอ่านเฉลยยาวกลางเกม
3. ส่ง hit ทันทีหรือ batch ไม่เกิน 100 ms ที่ไม่ทำให้ฟองหมดก่อน server รับ; unique(runId, playerId, bubbleId)
4. Server ตรวจ bubble ยัง active ตามเวลา server, player อยู่ roster, run ไม่ pause และยังไม่ hit มาก่อน
5. ทุบควรหยุด +100; ทุบควรปล่อย −100; พลาดควรหยุด 0; ไม่ clamp ระหว่างเกม
6. จบ rawScore → clamp(0,900); คืน breakdown correctHits/wrongHits/missedRisk; เฉลี่ย roster

### 8.3 เวลา จอ และ reconnect

| ช่วง | วินาที |
|---|---:|
| กติกา/บริบท | 10 |
| ทดลอง | 5 |
| Countdown | 3 |
| เล่น | 25 |
| ผล/เฉลย 2 คู่/ยืนยัน | 12 |
| อภิปราย | 20 |
| จบ/เชื่อม | 15 |
| รวม | **90** |

Display แสดงฟองและจำนวนที่ตรวจจริงแบบรวม ไม่แสดงคำเฉลยระหว่างเล่น; missedRisk สรุปเมื่อฟองหมดอายุแล้วและผลรวมชัดเจนเมื่อจบ Pause หยุดฟอง/เวลา/อินพุตพร้อมกัน Reconnect แสดงเฉพาะฟองที่ยังอยู่และไม่คืนฟองที่หมด โหมดกระชับอภิปราย 20 → 10 และเชื่อม 15 → 10 รวม 75 วินาที

### 8.4 งานสร้างและตรวจรับ

- สร้าง bubble renderer/grid, schedule validator, hit receipts และ raw scoring replay
- ทุบเสี่ยงครบ 9 ไม่ทุบดี = 900; ทุบทั้งหมด 18 = 0; ทุบดีหนึ่งครั้งก่อนทุบเสี่ยงหนึ่งครั้ง = 0
- Hit ซ้ำ/ช้า/ฟองผิด schedule/นอก roster ต้องไม่มีคะแนน; เวลาก่อนเริ่มเป็น practice เท่านั้น
- ทดสอบ 360 CSS px ทุกฟองอ่านได้ ไม่ทับกันและนิ้วไม่บังฟองอื่น; ชุดข้อความต้องอ่านทัน 2.4 s ในการซ้อมจริง
- Pause กลางฟองแล้ว Resume อายุที่เหลือเท่าเดิม; replay accepted events ได้คะแนนเดิม

## 9. เกม 6 — Company Shield

`gameId: company-shield` · `cue: 11.02` · กลับ `11.03` · เต็มรายคน 500

### 9.1 สนามและชุดยิง

- Bot ด้านบน ลูกค้า 3 ช่องด้านล่าง บริษัทอยู่รางแนวนอน; ลาก x หรือแตะช่อง/ปุ่มซ้ายขวาได้ผลเดียวกัน
- Normalize x ∈ [0,1], lane centers = 1/6, 1/2, 5/6; ขยับอาคารตามนิ้วแล้วเลือกช่องใกล้สุด
- Lock ขนาดอาคาร/ขอบ hitbox ใน config; รุ่นแรกตัดสินจาก lane ที่ server ยืนยันล่าสุดก่อนผ่านราง ไม่ใช้ขนาดภาพบนเครื่อง
- ยิง 10 นัดตามคู่มือ: เวลาเล็ง 0, 2.6, 5.2, 7.8, 10.4, 12.6, 14.8, 17.0, 19.2, 21.4 s; lane กลาง/ซ้าย/ขวา/กลาง/ขวา/ซ้าย/ขวา/กลาง/ซ้าย/ขวา
- เล็ง 0.8 s → เดินทาง 1.6 s; รางบริษัทอยู่กลางทางจึงผ่านที่ aimAt + 1.6 s; ถึงลูกค้าที่ aimAt + 2.4 s นัดสุดท้ายจบ 23.8 s ก่อน deadline 25
- คำบอต/งานตรวจต่อครบ 10 ข้อตามคู่มือ เก็บ packetId/text/task/targetLane/aimAt/railAt/customerAt ใน versioned manifest; ทุกข้อความต้องรับไว้ตรวจ ไม่มีเฉลยดี/ร้ายในเกมนี้

### 9.2 อินพุตและการชนที่คำนวณซ้ำได้

1. ทดลองลาก/COUNTDOWN → ARCADE_PLAY 25 s; initial lane กลางบันทึกตอนเริ่ม
2. Animate อาคาร local ทันที ส่งตำแหน่งเฉพาะเมื่อเปลี่ยน lane หรือ checkpoint ที่มีการเคลื่อนจริง ไม่เกิน 10 requests/s ต่อคนในแผนรุ่นแรก
3. `shield-moves`: runId, phaseToken, sequence, normalizedX; timestamp จาก server receipt ไม่เชื่อ client time สำหรับคะแนน
4. เก็บ accepted lane transition ใน DB แล้วประเมินแต่ละ packet ที่ถึง railAt จากตำแหน่งล่าสุดที่รับ **ก่อนหรือเท่ากับ railAt**; event ที่รับหลัง railAt แก้นัดนั้นไม่ได้
5. ตัดสิน BLOCKED/MISSED ครั้งเดียวต่อ player/packet แบบ transaction; บังได้ +50 ไม่ได้แต้มจากการลาก; max 500
6. ฟังก์ชันประเมินเกิดใน snapshot/advance/อินพุตที่เข้ามา ไม่ใช้ in-memory timer เพื่อถือผล; replay schedule + accepted moves + pause history ต้องได้ผลเดิม
7. Local block เป็นภาพชั่วคราวจนมี acknowledgement; ถ้า server ไม่ทันต้องปรับผลให้ตรงและแจ้งสถานะ ไม่แสดงว่ารับคะแนนแล้วทั้งที่ไม่ได้รับ

### 9.3 เวลา ผล และกู้สถานะ

| ช่วง | วินาที |
|---|---:|
| กติกา | 10 |
| ทดลองลาก | 5 |
| Countdown | 3 |
| เล่น | 25 |
| ผล/กองงาน/ยืนยัน | 10 |
| จบ/เชื่อม | 12 |
| รวม | **65** |

Display แสดงรับ/หลุดจาก roster ทั้งห้องและกองงานที่รับไว้ตรวจ; ไม่อ้างว่ารับแล้วแก้ปัญหาจบ Reconnect คืน lane ที่ยืนยันและนัดที่ยังไม่ผ่าน railAt ไม่ยิงนัดเก่าซ้ำ Pause หยุดทั้งเล็ง/กระสุน/เวลา โหมดกระชับเชื่อม 12 → 7 รวม 60 วินาที

### 9.4 งานสร้างและเงื่อนไขผ่าน

- สร้าง rail/lane UI, pointer capture/ปุ่มทางเลือก, movement receipts, collision evaluator และ packet ledger
- บังครบ 10 = 500; ไม่ขยับจากกลางได้เฉพาะนัดกลางตาม schedule; คะแนนรวม BLOCKED + MISSED = 10 ต่อคนเมื่อจบ
- ตำแหน่งรับหลัง railAt ไม่ช่วยบังย้อนหลัง; duplicate movement ไม่เพิ่ม packet count; refresh ไม่ย้อนยิง
- Hitbox/lane เดียวกันบนจอกว้างและจอแคบ; Pause ก่อนชน 100 ms แล้วต่อไม่ชนสองครั้ง
- **ต้องผ่าน latency gate บน deployment และเครือข่ายจริงก่อนรับรองเกมนี้** ถ้าไม่ผ่านให้ลดความถี่ที่ไม่จำเป็น/ปรับการส่งตำแหน่ง/ตำแหน่ง region แล้วทดสอบใหม่
- ถ้ายังไม่ผ่าน ออกแบบช่อง input ที่มี latency ต่ำกว่าแล้วเลือก deployment ใหม่ก่อน release ไม่เปลี่ยนเป็นเชื่อคะแนนจาก client และไม่อ้างว่าพร้อมใช้จากภาพ animation อย่างเดียว

## 10. เกม 7 — Missing Piece

`gameId: missing-piece` · `cue: 14.01` · กลับ `15.01` · เต็มกลุ่ม 1,000

### 10.1 ชุดภาพและเครื่องมือ

- ภาพ AI ฐานเดียว เช่น สิ่งประดิษฐ์คล้ายสัตว์ไม่มีปีก; โจทย์ “เติมปีกให้พร้อมออกเดินทางในแบบของคุณ” ช่องว่างใหญ่พอใช้นิ้ว
- เก็บต้นฉบับ/ภาพพร้อมเล่น, prompt/model/version/time/rights/baseAssetId; ไม่เรียก AI สดและไม่ส่งภาพผู้เล่นออกไปให้ AI เพิ่ม
- Canvas logical 1024×768 (ปรับ fit ไม่ยืด), drawing mask ซ้าย/ขวา, สี 5 สี, เส้น 2 ขนาด, undo เส้นล่าสุด, clear เฉพาะเส้นผู้เล่น
- ใช้ pointer capture, normalized points และ stroke sequence; จำกัด 100 เส้น / 5,000 จุด / 256 KB ต่อผลงาน ไม่รับ SVG/HTML หรือภาพ arbitrary จาก client
- แปลงเป็น thumbnail จากข้อมูลเส้นที่ server ล็อกแล้ว พร้อม baseAssetVersion และ hash; ไม่เชื่อภาพ preview ที่ผู้เล่นสร้างว่าตรง revision โดยไม่มีการตรวจ

### 10.2 วาด ล็อก ส่ง และตรวจ

1. GAME_READY โหลด/decode ฐานและทดลอง → COUNTDOWN 3 s → DRAWING **20 s**
2. ส่ง incremental checkpoints ทุกไม่เกิน 1 s เมื่อมีเส้นใหม่; undo/clear เป็น operation มี revision เช่นกัน แสดง accepted checkpoint และคำเตือนถ้าส่งไม่ถึง
3. “เสร็จแล้ว” ส่ง finalize และล็อกก่อนหมดได้; ครบ deadline ล็อก last accepted revision อัตโนมัติ
4. หลังวาด `UPLOADING` 5 s ส่ง/สร้าง thumbnail จาก revision ที่ล็อก ห้ามเพิ่มจุดหรือยอมรับ revision ใหม่เพียงเพราะยังไม่ upload
5. ผู้จัดเริ่มดูงานที่ finalized ก่อนครบได้ แต่อนุมัติผูก lockedRevision เท่านั้น; จากนั้น `MODERATING` **60 s** รวมส่ง/ตรวจ **65 s** ระหว่างตรวจหยุดบทพูด
6. ข้อมูลไม่ครบ/ไม่มีเส้น/เกิน mask/points ไม่เป็นตัวแทน; checkpoint ที่รับทันบางส่วนให้ใช้ตามจริงและแสดงว่ากู้จาก checkpoint ห้ามประกาศว่างานครบถ้าไม่ครบ
7. เผยแพร่เฉพาะงาน `APPROVED` ที่ thumbnail สร้างสำเร็จ ไม่เผยงาน pending/rejected/private preview

### 10.3 แก้คอขวดตรวจงาน

| ชั้น | ทำอะไร | ผลต่อสิทธิ์ |
|---|---|---|
| ตรวจอัตโนมัติ | ตรวจ token/run/roster/base, bounds/finite numbers, bytes/points, stroke IDs/revisions, มีเส้นจริง, render thumbnail ได้ และกรองรูปแบบเสี่ยงที่กำหนด | `VALID_FOR_REVIEW`, `FLAGGED` หรือ `INVALID`; ผ่าน schema ยังไม่ใช่ผ่านความเหมาะสม |
| กริดตรวจ | กริด 12 ภาพต่อชุด, filter กลุ่ม/flagged/pending/approved/rejected, กดขยาย, เลือกหลายภาพ, Reject พร้อมเหตุผล, อนุมัติชุดที่อ่านแล้ว | ผู้จัดตรวจเอง; lease กู้เครื่องสำรองได้ การ approve/reject ผูก lockedRevision และ actor |
| ขอบเขตเวลา | ส่ง 5 s + ตรวจ 60 s; เป้าหมาย 32 ภาพ / 60 s ≈ 0.53 ภาพต่อวินาที หรือเฉลี่ย 1.875 s/ภาพ | ต้องซ้อมผ่านด้วยงานตัวอย่างจริง ผู้จัดไม่บรรยายพร้อมตรวจ; ไม่อ้างว่าตรวจทันจากสูตรเพียงอย่างเดียว |
| งานค้าง | ครบเฟสแล้วยังไม่ตรวจไม่ฉาย แสดงจำนวนค้างเฉพาะเจ้าของ/ผู้จัด เข้าสถานะ `REVIEW_REQUIRED` หยุดก่อนโหวต | Host/ผู้ตรวจเคลียร์หรือ Cancel; ไม่ auto-approve หรือทิ้งงานท้ายคิวเพื่อให้ทันเวลา |

ตรวจแบบเลือกหลายภาพต้องให้ผู้ตรวจเห็นทุกภาพที่เลือกก่อนอนุมัติ ปุ่ม “reject เร็ว” ช่วยการคัดออก แต่การไม่กด reject ยังไม่ถือว่าผ่าน ไม่มี AI ให้คะแนนความสวยหรืออ้างว่า filter เข้าใจภาพครบ

นับ `accepted/approved/rejected/pending/thumbnail-failed` แยกกัน เพื่อรู้ว่าคอขวดอยู่ที่ส่ง Render หรือคนตรวจ ผู้จัดตรวจ 32 ภาพด้วยตนเองในช่วงเงียบที่เตรียมไว้ จอแสดง “ผู้จัดกำลังตรวจผลงาน” และยังไม่ฉายภาพที่ค้างตรวจ

### 10.4 แกลเลอรี ตัวแทน และโหวต

1. GALLERY 12 s ฉายทุกงานที่รับและผ่านตรวจ ขนาดเท่ากัน; ฐาน 32 งานใช้ไม่เกิน 16 thumbnails/หน้า × 2 หน้า × 6 s (งานน้อยกว่าหรือมีหน้าเดียวใช้เวลาแกลเลอรีรวมเท่าเดิม)
2. ทุกงาน approved อยู่แกลเลอรีมือถือจนจบเกม; รายการ pending/rejected ไม่หลุดไปยังจอหรือผู้เล่นอื่น
3. INTERNAL_VOTE 15 s: ทุกคนดูงาน approved กลุ่มตน เลือกหนึ่งงาน เปลี่ยนได้ก่อน deadline; tie/no-vote ใช้ §3.3
4. CANDIDATE_SHOW 5 s: ตัวแทนสูงสุด 8 ภาพขนาดเท่ากัน รหัส A–H ที่ล็อกแล้ว ไม่เผยกลุ่ม/เจ้าของ
5. FINAL_VOTE **20 s**: ทุกคนเลือกงานกลุ่มอื่นได้หนึ่งเสียง แม้กลุ่มตนไม่มีผลงาน; UI ปิดตัวเองและ backend ตรวจซ้ำ
6. RESULT เป้าหมาย 10 s เปิดกลุ่ม/เจ้าของ จำนวนเสียงและ support คะแนนผู้ชนะร่วม → ผู้จัดกด “จบเกม / ไปต่อ” เองในช่วงเชื่อม ไม่มีช่วงเล่าทางเลือกเพิ่มในคิวนี้เพื่อเผื่อผู้จัดตรวจเอง

Gallery ทั้งหมดในมือถือเปิดตามเฟสที่กำหนด การเห็นทุกงานก่อน final vote เป็นกิจกรรมตามโจทย์ ไม่อ้างว่าปิดบังผู้สร้างแบบสมบูรณ์; ไม่ตัดงานท้ายคิวออกเพราะขนาดกริด

### 10.5 เวลารวมและคะแนน

| ช่วง | วินาที |
|---|---:|
| กติกา/โจทย์ | 15 |
| ทดลอง | 5 |
| Countdown | 3 |
| วาด | 20 |
| ส่ง revision/thumbnail | 5 |
| ตรวจ locked artworks | 60 |
| แกลเลอรีทุกงาน | 12 |
| กลุ่มเลือกตัวแทน | 15 |
| โชว์ตัวแทน | 5 |
| ทุกคนโหวตกลุ่มอื่น | 20 |
| ผล/เปิดเจ้าของ/ยืนยัน | 10 |
| จบ/เชื่อม | 10 |
| รวม | **180** |

คะแนนใช้ support/sharedScore เดียวกับเกม 3 โดยไม่มี AI candidate; ไม่มีงานหรือ best=0 ได้ 0 ทุกคนใน roster ได้ sharedScore เท่ากัน โหมดกระชับตัดช่วงโชว์ตัวแทน 5 → 0 (เห็นในหน้าโหวตทันที), ผล 10 → 5 และเชื่อม 10 → 5 รวม 165 วินาที ไม่ลดเวลาวาด/ตรวจ/โหวต

### 10.6 งานสร้างและตรวจรับ

- สร้าง canvas editor/mask/normalized operations, checkpoint/finalize, thumbnail renderer/storage, moderation queue/grid และแกลเลอรีหลายหน้า
- วาดบน 360 CSS px และจอกว้างได้รูปเหมือนกัน; ภาพฐานไม่ถูกลบ/เปลี่ยน; undo/clear กลับมาได้หลัง reconnect
- ส่งหลัง DRAWING เพิ่มเส้นไม่ได้; upload รับแต่ locked revision; ความล่าช้าในการ render ไม่เปิดเวลาวาดเพิ่ม
- ภาพไม่มีเส้นไม่แข่งขัน; ภาพ invalid/rejected/pending ไม่โผล่ใน public API หรือการโหวต
- ผู้เล่นสองแท็บไม่สร้างสองงาน/สองเสียง; เสมอ/ไม่มีเสียง/ไม่มีผลงาน/หมดเวลาตรวจมีผลชัดเจน
- ที่ 32 ภาพผู้จัดตรวจเองเคลียร์งาน valid ทั้งหมดใน 60 s และกริดฉาย approved ครบใน 12 s ต้องมีผลซ้อมบันทึกไว้
- หากผู้จัดตรวจไม่ทันหรือมีมากกว่า 32 ให้ปรับงบ/โจทย์ก่อน event แล้วซ้อมซ้ำ; ห้ามรับรองคิว 3 นาทีทั้งที่การตรวจยังไม่ผ่าน

## 11. โครงสร้างโค้ด ข้อมูล และ API ที่จะสร้าง

ชื่อไฟล์/route เป็นข้อเสนอ ยังไม่มี endpoint เหล่านี้ในโปรเจกต์ปัจจุบัน

```text
src/
  App.tsx                         # entry เดิม เพิ่ม route switch อย่างจำกัด
  game-client/
    session.ts / room.ts / clock.ts / reconnect.ts
    PlayerShell.tsx / DisplayAdapter.tsx
    games/{trust-tug,ai-or-human,caption-battle,
           confidence-roulette,chat-whack-a-mole,company-shield,missing-piece}/
    components/{Countdown,SubmissionStatus,GroupRoster,VoteGallery}/
  shared/
    game-contracts.ts / schedules.ts / public-content-manifest.ts
api/
  index.ts                        # Elysia entry และ deployment adapter ที่ทดสอบแล้ว
  auth.ts / room.ts / commands.ts / snapshots.ts / outbox.ts
  games/                          # validators/reducers/scoring/answer loaders ตาม gameId; ไม่อยู่ frontend bundle
supabase/
  migrations/ / seed.sql / policies/
game-content/
  v1/public/                      # โจทย์/ภาพที่ไม่เปิดเฉลย
  v1/server/                      # เฉลย/provenance/scoring config
tests/
  scoring/ / contracts/ / integration/ / e2e/ / load/
```

แบ่ง frontend/API deployment root ให้แน่นอนในงานแรก ไม่ถือว่า Elysia backend เข้าร่วม Vite routing ได้เองโดยไม่ config; เลือก runtime/lockfile และทดสอบ preview บน Vercel จริง

### 11.1 ตารางสำคัญและ unique constraints

| ชุดข้อมูล | สิ่งที่ต้องบันทึก/ป้องกัน |
|---|---|
| rooms/groups/members | membership แยก Presence, room capacity/teamLockedAt, สิทธิ์ host/display/moderator |
| control_leases | roomId unique, controllerId, controllerEpoch, leaseUntil; moderators ไม่ยึด control lease |
| game_previews/game_runs/run_rosters | preview readiness, fixed roster, versions, timingProfile, active scoring run ต่อ room/game |
| player_run_state | unique(runId, playerId), side/lifeStatus/accepted counters/last move |
| answers/input_events | unique answer ต่อ round/player, unique event ID/sequence; server timestamps และ accepted payload |
| packet_results | unique(runId, playerId, packetId), BLOCKED/MISSED และ move ที่ใช้คำนวณ |
| submissions/artwork_operations | unique งานต่อ player/run; revisions/checkpoints/lockedRevision/hash |
| moderation_reviews/review_leases | decision ผูก lockedRevision, reason, actor, reviewedAt และ lease ไม่ให้สองคนแก้ขัดกัน |
| render_jobs | locked hash, QUEUED/RENDERING/READY/FAILED, lease/attempts/output path; worker ทำซ้ำแล้วไม่สร้างภาพต่าง revision |
| candidates/internal_votes/final_votes | immutable candidate map เมื่อเปิด final; unique vote ต่อ player/run/type |
| scores/confirmations/audit/outbox | numerator/denominator, scoringVersion, confirm idempotency, replay supersede และ event หลัง commit |

### 11.2 สัญญา API

| งาน | route ที่เสนอ |
|---|---|
| เข้าห้อง/ออก | `POST /rooms/:code/join`, `POST /rooms/:id/leave` |
| Snapshot/สมาชิก/คะแนนตน | `GET /rooms/:id/snapshot`, `/members`, `/my-score` |
| Readiness | `POST /rooms/:id/previews/:previewId/ready` |
| Cue/ควบคุมเครื่อง | `POST /rooms/:id/presenter/cue`, `/control/acquire`, `/control/heartbeat`, `/control/takeover` |
| Run commands | `POST /runs/:id/{pause,resume,advance,finish-and-next,cancel,replay}`; `POST /rooms/:id/games/:gameId/start`; advance เปลี่ยนเฉพาะเฟสตามเวลา ไม่ complete หรือเปลี่ยน cue |
| เล่น | `POST /previews/:id/side-choice`; `POST /runs/:id/{taps,answers,hits,shield-moves,captions,artwork-checkpoints,artwork-finalize}` |
| ตรวจงาน | `POST /runs/:id/reviews/claim`, `/reviews/decision`; `GET /runs/:id/reviews` |
| เลือก/โหวต | `POST /runs/:id/internal-votes`, `/final-votes` |
| ผล | `GET /rooms/:id/leaderboard`, `GET /rooms/:id/export` เฉพาะผู้จัด |

ทุก mutation ตรวจ JWT/role/membership/roster/phase/deadline และรูปแบบ payload; response มี accepted status, authoritative revision/version, serverNow และ error ที่อ่านได้ เช่น `PHASE_CLOSED`, `NOT_IN_ROSTER`, `ALREADY_ANSWERED`, `DEAD_PLAYER`, `OWN_GROUP_VOTE`, `STALE_CONTROLLER` ไม่มี client score หรือ host flag ที่ backend เชื่อได้

Realtime event envelope: eventId, roomId, runId, version, serverNow, cueId, phase, deadline; แยกช่อง room/public aggregation ออกจาก private player receipts และ moderator data ส่งผลห้องที่ 2 Hz สูงสุด ไม่ broadcast input ของทุกคนไปทั้งห้อง

### 11.3 สิทธิ์และการติดตั้ง

- RLS จำกัดห้อง ข้อมูลส่วนบุคคลและ phase publication; anonymous user ไม่ใช่ผู้จัดแม้มี authenticated role
- Secret/service role ใช้ backend เท่านั้น; server answer manifest ไม่เข้า Vite public bundle; ตั้ง private Realtime topic authorization แยก publish/subscribe/presence
- จอ Display อ่านเฉพาะข้อมูลฉายด้วย session/สิทธิ์จอที่เตรียมไว้ ไม่เปิดคะแนนรายคนหรือเฉลยก่อนเฟส
- Storage path แยก room/run/locked artwork; thumbnail ที่ยังไม่ approved ไม่อ่านผ่าน public URL; endpoint แจกภาพตรวจ approval/role/phase ก่อนคืนข้อมูล งาน pending ไม่ออก signed URL ให้ผู้ชม เมื่อ reject งานที่เคยเผยแพร่ให้หยุดแจกใหม่และส่ง event นำออกจากจอ ไม่อ้างว่าสามารถเรียกคืนภาพที่ผู้ชมบันทึกไปแล้ว
- Preview ใช้ Supabase สำหรับซ้อมแยกงานจริง; migration/seed 8 กลุ่ม และข้อมูลอ้างอิงผ่าน version control
- ตรวจ anonymous sign-in quota เมื่อผู้ชมอยู่ Wi-Fi/IP เดียวกัน โดยเฉพาะ burst ตอนสแกน; ตั้งตามจำนวนที่อนุมัติและทดสอบจริงก่อนวันงาน
- `VITE_SUPABASE_URL`, publishable key และ API base อยู่ frontend ได้; backend secrets เก็บใน environment ของ API ไม่ใส่ใน markdown/export/log
- ตั้ง Git repository และ remote ที่เจ้าของเลือกในขั้นพัฒนา ปัจจุบัน directory นี้ยังไม่มี .git; ไม่สร้าง remote หรือเผยแพร่งานจากการทำแผนครั้งนี้

## 12. ลำดับงานลงมือทำและประตูตรวจรับ

ระยะเป็น effort ประมาณสำหรับผู้พัฒนา 1 คน ใช้เพื่อจัดงาน ไม่ใช่วันส่งมอบที่รับรอง รวมราว **17–25 วันทำงาน** ขึ้นกับความพร้อมเนื้อหา บัญชี deploy และผลโหลด

| รหัส | งานและสิ่งส่งมอบ | พึ่งพา | Effort | จบเมื่อ |
|---|---|---|---|---|
| P00 | บันทึกเป้าหมาย 32 คน/ผู้จัดตรวจเอง, asset register, final rules/timing และ scoringVersion | — | 0.5 วัน | ไม่เหลือสมมติฐานที่กระทบ capacity และเวลาตรวจ; ไม่ต้องรอชื่อกลุ่ม |
| P01 | ตั้ง Git/deployment config/DB migrations/auth/RLS, พิสูจน์ worker/lease/retry, แก้เลข 07.02 และบทที่สร้างจาก source | P00 | 2–3 วัน | Staging เข้า Player/Host/Display ได้, job กู้ได้, เลขตรงทุกเฟรม |
| P02 | ห้อง/membership/session/readiness/QR/team lock/reconnect | P01 | 2–3 วัน | สแกนครั้งเดียว กลับคนเดิม เข้า/ออก/มาช้าถูกกติกา |
| P03 | Run engine/clock/roster/commands/lease/navigation lock/score confirmation | P02 | 2–3 วัน | Host ล่มและสองแท็บยังมี run/คะแนนเดียว |
| P04 | เกม 1 + เกม 2 + เกม 4 และชุดโจทย์จริง | P03 | 3–4 วัน | เล่น/เฉลย/คะแนน/reconnect ผ่านทั้ง 3 เกม |
| P05 | เกม 5 + เกม 6, event replay และ latency gate | P03 | 3–4 วัน | สูตรคะแนนและเวลาชนผ่าน deployment จริง |
| P06 | งานร่วม moderation/candidates/votes/เกม 3 | P03 | 1.5–2 วัน | ทุกคนส่ง/เลือก/โหวต, กลุ่มต่างขนาดได้คะแนนตามสูตร |
| P07 | Canvas/checkpoints/thumbnail/grid/gallery/เกม 7 | P06 | 2–3 วัน | 32 ภาพส่ง/ตรวจทันและแกลเลอรีครบตามเวลา |
| P08 | ต่อ Display กับ cue เดิม, load/security/mobile/full rehearsal/export/runbook | P04–P07 | 1–2 วัน | หลักฐานพร้อมใช้ครบและซ้อม 50 นาทีผ่าน |

เมื่อเชื่อมระบบจริงให้อัปเดต src/content.ts/src/spoken.ts ที่ยังกล่าวถึง “ระบบเกมภายนอก” และสร้างเอกสารบทพูด/คิวที่อ้าง source ใหม่ รวมขั้นตรวจงานปกติ/กระชับ ห้ามปล่อยบทพูดเก่ากำกับเวลาเกมที่เปลี่ยนแล้ว

P04/P05/P06 ลงมือเรียงตามตารางได้โดยผู้พัฒนาคนเดียว ไม่ต้องรอออกแบบ layout Host รายละเอียด; ใช้หน้าควบคุมขั้นต่ำที่ส่งคำสั่งตามสัญญา API และออกแบบจอ Host แยกภายหลังตามที่ผู้ใช้ขอ

## 13. แผนทดสอบและเกณฑ์พร้อมใช้

### 13.1 ตัวเลขโหลดสำหรับเป้าหมาย 32 คน

| สถานการณ์ | โหลดที่จะจำลอง |
|---|---|
| เข้า Lobby | 32 guest sign-ins/join ภายใน 40 s รวมบน IP เดียวและเครื่องที่มี session เดิม |
| เชื่อมต่อ | 32 Player + 1 Display + 1 Host = 34 connected clients; ผู้จัดใช้สิทธิ์ review จาก Host ไม่เปิด Moderator อีกเครื่อง ทดสอบเครื่องสำรองต่อเพิ่มเป็น 35 |
| เกม 1 | 32 × 100 taps ที่ 10 taps/s × 10 s = 3,200 accepted scoring events; ส่ง 200 events/คนเพื่อทดสอบ rate limit เป็น 6,400 attempted events; batching 100 ms สูงสุดประมาณ 320 requests/s ช่วงแตะ |
| เกม 2/4 | 32 answers ภายใน 4 s ต่อรอบ และ burst 32 answers ใน 200 ms ก่อน deadline |
| เกม 3 | 32 drafts/locked captions, moderation และ 64 accepted vote records สองเฟส (revision เปลี่ยนได้แต่ record ต่อคน/เฟสมีหนึ่ง) |
| เกม 5 | 32 × 18 = 576 hit events เมื่อทุบทุกฟอง พร้อม burst ฟองเดียวกันและ requests ซ้ำ |
| เกม 6 | Worst case เคลื่อนทุกคน: 32 × 10 requests/s × 25 s = 8,000 movement requests; evaluate 320 packets |
| เกม 7 | ไม่เกิน 32 × 20 = 640 checkpoint opportunities (ส่งเฉพาะเปลี่ยน), 32 finalize/thumbnails, เพดานเส้นรวม 8 MiB ก่อนลดขนาด (256 KiB/งาน) |
| กู้พร้อมกัน | 32 เครื่อง reconnect ใน 5 s ขณะเกมเดิน + snapshot fallback และ Host takeover |
| ซ้อมทน | ห้อง active 50 นาทีเต็มและอย่างน้อย 10 นาทีเตรียม/เก็บผล; ไม่นับเฉพาะรอบสั้น |

ตัวเลข request/event ด้านบนเป็นโหลดทดสอบ worst case ไม่ใช่ผลวัดจริง Rate limit ต้องรองรับ legitimate inputs เหล่านี้โดยแยกจากการป้องกัน abuse; รับ batch แล้วควร transaction แบบชุดแทน write แยกทุกจุด

### 13.2 เป้าหมายที่ต้องวัด

- API mutation acknowledgement p95 ≤ 250 ms, p99 ≤ 500 ms ภายใต้โหลดเป้าหมาย; เกม 6 วัด lane delivery p95 ≤ 200 ms รวม network และผลชนตรง replay 100%
- State update ปกติ p95 ≤ 500 ms หลัง commit; Realtime กลับแล้วกู้ snapshot/phase ภายใน 5 s เมื่อ network ใช้ได้
- Valid request ที่ไม่ใช่ late input สำเร็จ ≥ 99.5%; แยก infrastructure error จากการถูกปฏิเสธตามกติกา
- คะแนนที่ commit แล้วสูญหาย 0, duplicate score 0, accepted vote ซ้ำ 0, cross-room read 0, answer key leak ก่อนเฉลย 0
- เกม 7 thumbnail จาก locked revision พร้อมภายในเฟสส่ง 5 s ในซ้อมเป้าหมาย และผู้จัดตรวจครบ 32 งานภายใน 60 s; เกม 3 ผู้จัดตรวจ 32 captions ที่ล็อกครบ 60 s เช่นเดียวกัน
- Host สำรองคุมต่อภายใน 60 s; Display ไม่เคยเปลี่ยนเป็นหน้าว่างเพียงเพราะ Realtime ขาด
- ทดสอบ iPhone Safari และ Android Chrome จริงอย่างน้อยอย่างละ 2 เครื่อง รวมโทรศัพท์ที่ประสิทธิภาพต่ำกว่าเครื่องผู้พัฒนา, Wi-Fi งานจริงและเครือข่ายมือถือ
- ชุด load runner ต้องใช้ auth/RLS/HTTP/Realtime จริงบน staging ที่มี topology เดียวกับ production ไม่ทดสอบเฉพาะ reducer ในเครื่อง
- ผลที่ 48/64 คนบันทึกไว้เพื่อหาขีดจำกัด ทดสอบจากห้อง stress แยกที่ตั้ง capacity ตามจำนวนทดสอบ ถ้าจำนวนงานจริงเพิ่มต้องผ่าน gate ใหม่ตามจำนวนใหม่และปรับงบตรวจของผู้จัดเองด้วย

เป้าหมายข้างต้นเป็นเกณฑ์ผลิตภัณฑ์ที่เสนอ ไม่ใช่คำรับรองจากผู้ให้บริการ ถ้าผ่านไม่ได้ต้องแก้สถาปัตยกรรมหรือ config แล้วทดสอบซ้ำก่อนเรียกว่าพร้อมใช้

### 13.3 ชุดตรวจรวมที่ต้องมี

- Unit tests เฉพาะสูตรคะแนน/tie/denominator/dead state/schedule/collision ที่ผิดแล้วกระทบผลจริง
- Integration tests transaction Start/Confirm/Replay, RLS/role/roster/deadline และ expectedVersion conflicts
- E2E ผู้เล่นทุกเกมตั้งแต่ QR ถึงรางวัล พร้อมหลายแท็บ refresh/พับจอ/กลับแอป และแทรกการหลุดในทุกชนิดอินพุต
- การกู้เสียหาย: broadcast หลัง commit ล้มเหลว, event มาไม่เรียง, API timeout หลัง commit, lease expired และเครื่อง Host เก่ากลับมา
- Rehearsal ใช้ชุดภาพ/ข้อความ/ตารางยิงที่จะใช้จริง ผู้ตรวจจริง และบทพูดตามคิว 43 คิว ไม่ใช้ placeholder ที่ตรวจง่ายกว่าของจริง
- Export เทียบคำนวณอิสระ: accepted inputs → individual scores → roster averages → creative support → confirmed totals; เกม 1 ไม่มีเพดาน จึงไม่มีคะแนนสะสมสูงสุดตายตัว (เกมอื่นรวมสูงสุด 5,400)

## 14. สิ่งส่งมอบที่ทำให้คำว่า “พร้อมใช้” ตรวจสอบได้

1. Source frontend/API, lockfile, migrations/RLS/seed, content versions และ asset provenance ที่ครบสิทธิ์
2. Staging/production HTTPS URL, QR ผู้เล่น, วิธีเข้า Host/Display/Moderator และเครื่องสำรองที่ทดลองเข้าแล้ว
3. รายงานผลทดสอบระบุ release, deployment regions/config, จำนวนผู้เล่น, อุปกรณ์/เครือข่าย, latency/error, moderation throughput และข้อจำกัดจริง
4. ไฟล์ผลห้องทดลองหนึ่งห้องที่คำนวณคะแนนซ้ำได้ ไม่มีผู้ชนะสมมติ
5. Runbook เปิดงาน → ตรวจพร้อม → Start/Pause/Resume → RESULT ค้าง → ผู้จัดกด Finish-and-next → กู้ Host/Realtime → Cancel/Replay → Export และปิดห้อง
6. บทพูด/ตารางซ้อมฉบับปกติและกระชับ, PDF สไลด์ที่แก้ 07.02 และผลซ้อมทั้งงานไม่เกิน 50 นาที
7. Host layout เป็นงานออกแบบแยก; ถ้ายังไม่มีหน้าควบคุมที่กดคำสั่งทั้งหมดได้จริง ระบบยังไม่ถือว่าพร้อมใช้หน้างาน แม้ backend ผ่านแล้ว

## 15. รายการที่ยังต้องยืนยันก่อน release

- ผลซ้อมผู้จัดตรวจเองที่ 32 คน; ชื่อกลุ่มรอผู้ใช้ส่งภายหลังและเปลี่ยนได้โดยไม่แก้รหัสกลุ่ม
- ภาพ 8 ภาพ/มีม/AI caption/ภาพ Missing Piece และสิทธิ์เผยแพร่ที่จัดการแล้ว
- เจ้าของ Git remote, บัญชี Vercel/Supabase, domain HTTPS และ region/config ที่ผ่านโหลด
- อุปกรณ์ฉาย/เครื่อง Host สำรอง, Wi-Fi งานจริง และวิธีแบ่งรางวัลเมื่ออันดับร่วม

ไม่มีข้อใดในรายการนี้หยุดการเตรียมโค้ดสัญญา API/สูตรคะแนน/ชุดทดสอบได้ แต่ห้ามรับรองว่า deploy หรือรองรับผู้ชมจริงแล้วจนมีหลักฐานตาม §13–14

## 16. เอกสารทางเทคนิคที่ใช้ตรวจแนวทาง

ตรวจวันที่ 6 ตุลาคม 2026; เอกสารรองรับความสามารถของ stack ส่วนรูปแบบ API/โหลด/เวลา/lease ในแผนนี้เป็นการออกแบบของโปรเจกต์

- Elysia ระบุการ deploy บน Vercel ด้วย Node/Bun; ในโปรเจกต์ต้องทดสอบ entry/root/runtime ร่วมกับ Vite ตาม config ที่เลือก: [Elysia on Vercel](https://elysiajs.com/integrations/vercel)
- Anonymous identity ใช้การเข้าถึงแบบ authenticated และกลับบัญชีไม่ได้หลัง sign-out/ล้าง storage/เปลี่ยนอุปกรณ์; เอกสารยังระบุ IP rate limit ที่ต้องตรวจเมื่อเข้าจาก Wi-Fi เดียวกัน: [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- Private Broadcast/Presence ใช้ RLS authorization ของ topic; สิทธิ์ห้องและสิทธิ์ส่งคำสั่งต้องออกแบบแยกให้ตรง role: [Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
- จำกัดข้อมูลผ่าน policies และทดสอบการอ่าน/เขียนข้าม identity ก่อนเปิดใช้: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
