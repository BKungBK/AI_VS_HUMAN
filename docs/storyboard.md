# Storyboard — Modern Dark Neo-Pastel

กล้องใช้ expo.inOut / power4.inOut, card reveals power3.out / back.out(1.2). Punch-in 0.6s + glide 1.05s. Push-through 1.75s หลัง handoff. Dolly: Z 2520→1500 และชดเชย FOV เพื่อคงสเกลระนาบหลัก. กล้องเดียวขับ HTML text, cards, ฉาก SVG 4 ระยะ และ particles; ข้อความเข้าแบบ Z/rotateX/rotateY เป็นบรรทัดสมบูรณ์แล้วกลับ identity. ข้อความเก่าเลื่อน Z และ fade 0.44s ก่อนหัวข้อใหม่เริ่ม 1.25s. Header/footer อยู่ screen space. กล้องและข้อความอ่านตรงภายใน 2.8s; ย้อนคิวกลับทิศการเคลื่อน. ดู docs/place-journey-direction.md. Live hold ไม่ทำให้คิวถัดไปปรากฏ เสียง: เอฟเฟกต์เข้า/เดินทาง/ลงจอดหลังเปิดเสียงหนึ่งครั้ง แล้วเงียบระหว่างอ่านตามค่าตั้งต้น. ดู docs/sound-direction.md.

## 01 · THE CLASH

### 01.01 · HUMAN / vs AI

- Place: Confluence hall; station {"x":0,"y":0,"z":0}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: HUMAN / vs AI. The Sparring Minds
- Visual: opening; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: push; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 3.6s, then 2.5s rest; full phase repeats every 6.1s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Presenter viewpoint / illustrative composition

### 01.02 · สแกนเพื่อเข้าร่วม

- On screen: สแกนเพื่อเข้าร่วม. QR ห้องจริงแสดงทับสไลด์จากจอฉายจนเริ่มเกมแรก
- Visual: centered text on slate + dark QR card with room code; QR is a live SVG from the room API
- Camera/entry: fade; fade 0.35s then hold
- Hold: QR stays readable while the presenter explains; player phones keep a slow, continuous SVG waiting loop
- Exit: 0.22s fade
- Evidence: Presenter viewpoint / illustrative composition

### 01.03 · คิดต่าง / เพราะสร้างมาต่างกัน

- Place: Confluence hall; station {"x":2700,"y":0,"z":-920}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: คิดต่าง / เพราะสร้างมาต่างกัน. ชีววิทยา · ประสบการณ์ · การคำนวณ
- Visual: biology; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: arc; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 3.6s, then 2.5s rest; full phase repeats every 6.1s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Korteling et al. · 2021

### 01.04 · ใครควรทำอะไร?

- Place: Confluence hall; station {"x":4050,"y":120,"z":-1380}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: ใครควรทำอะไร?. และใครยังคงต้องรับผิดชอบ?
- Visual: question; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: punch; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 3.5s, then 2.5s rest; full phase repeats every 6s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Presenter viewpoint / illustrative composition

## 02 · TRUST

### 02.01 · THE TRUST / TUG-OF-WAR

- On screen: THE TRUST / TUG-OF-WAR. GAME 01 · ชักเย่อสติปัญญา
- Visual: centered text on slate; layers: slate + foreground text
- Camera/entry: fade; fade 0.35s then hold
- Hold: static
- Exit: 0.22s fade
- Evidence: Presenter viewpoint / illustrative composition

## 03 · CREATIVITY

### 03.01 · ศิลปะมีชีวิต / อยู่เบื้องหลัง

- Place: Gallery of human experience; station {"x":5800,"y":0,"z":-1800}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: ศิลปะมีชีวิต / อยู่เบื้องหลัง. Lived experience
- Visual: art; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: push; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 2.9s, then 2.5s rest; full phase repeats every 5.4s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Presenter viewpoint / illustrative composition

### 03.02 · ถ้าปิดชื่อผู้สร้าง / คุณแยกออกไหม?

- Place: Gallery of human experience; station {"x":7150,"y":120,"z":-2260}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: ถ้าปิดชื่อผู้สร้าง / คุณแยกออกไหม?. บทกวีที่อ่านได้ ไม่ได้บอกที่มาเสมอไป
- Visual: poetry; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: punch; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 3s, then 2.5s rest; full phase repeats every 5.5s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Porter & Machery · 2024

### 03.05 · SWIPE / COURT

- On screen: SWIPE / COURT. GAME 02 · ปัดซ้ายคน / ปัดขวา AI
- Visual: centered text on slate; layers: slate + foreground text
- Camera/entry: fade; fade 0.35s then hold
- Hold: static
- Exit: 0.22s fade
- Evidence: Designed activity / simulated content; see docs/mobile-games-spec.md
### 03.03 · FLAMINGONE

- Place: Gallery of human experience; station {"x":8500,"y":0,"z":-2720}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: FLAMINGONE. ภาพจริง ในหมวดประกวด AI
- Visual: flamingo; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: punch; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 2.9s, then 2.5s rest; full phase repeats every 5.4s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Miles Astray · FLAMINGONE

### 03.04 · ผลงานเดิม / ป้ายใหม่

- Place: Gallery of human experience; station {"x":9850,"y":120,"z":-3180}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: ผลงานเดิม / ป้ายใหม่. ความเชื่อว่าใครสร้าง มีผลต่อการประเมิน
- Visual: attribution; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: arc; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 3.5s, then 2.5s rest; full phase repeats every 6s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Grassini & Koivisto · 2024


## 04 · IDEAS

### 04.01 · CAPTION & / PROMPT BATTLE

- On screen: CAPTION & / PROMPT BATTLE. GAME 03 · ดวลแคปชั่น
- Visual: centered text on slate; layers: slate + foreground text
- Camera/entry: fade; fade 0.35s then hold
- Hold: static
- Exit: 0.22s fade
- Evidence: Presenter viewpoint / illustrative composition

### 04.02 · เก่งขึ้นรายคน

- Place: Atrium of branching ideas; station {"x":12350,"y":620,"z":-3860}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: เก่งขึ้นรายคน. AI ช่วยเสนอไอเดีย ในการทดลองเรื่องสั้น
- Visual: individual; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: punch; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 4.5s, then 2.5s rest; full phase repeats every 7s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Doshi & Hauser · 2024

### 04.03 · แต่ไอเดีย / คล้ายกันมากขึ้น

- Place: Atrium of branching ideas; station {"x":13700,"y":500,"z":-4320}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: แต่ไอเดีย / คล้ายกันมากขึ้น. คุณภาพ กับ ความหลากหลาย เป็นคนละคำถาม
- Visual: diversity; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: arc; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 4.5s, then 2.5s rest; full phase repeats every 7s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Doshi & Hauser · 2024

## 05 · ACT 1 RESULTS

### 05.01 · FLASH LEADERBOARD

- On screen: FLASH LEADERBOARD. ACT 01 · สรุปอันดับ
- Visual: centered text on slate; layers: slate + foreground text
- Camera/entry: fade; fade 0.35s then hold
- Hold: static
- Exit: 0.22s fade
- Evidence: Presenter viewpoint / illustrative composition

## 06 · THE FRONTIER

### 06.01 · เมื่อ AI / ค้นพบทางลัด

- Place: Calculation laboratory; station {"x":15400,"y":500,"z":-5500}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: เมื่อ AI / ค้นพบทางลัด. AlphaTensor · Matrix multiplication
- Visual: tensor; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: push; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 3s, then 2.5s rest; full phase repeats every 5.5s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Fawzi et al. · Nature 2022

### 06.02 · จากลำดับ / สู่โครงสร้าง

- Place: Calculation laboratory; station {"x":16750,"y":620,"z":-5960}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: จากลำดับ / สู่โครงสร้าง. ออกแบบและทำนายโปรตีน · โนเบลเคมี 2024
- Visual: protein; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: arc; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 4s, then 2.5s rest; full phase repeats every 6.5s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Nobel Chemistry · 2024

### 06.03 · โลกจริง / ไม่ใช่โจทย์ปิด

- Place: Calculation laboratory; station {"x":18100,"y":500,"z":-6420}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: โลกจริง / ไม่ใช่โจทย์ปิด. บริบท · เป้าหมาย · ผู้คน
- Visual: strategy; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: push; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 3.4s, then 2.5s rest; full phase repeats every 5.9s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Presenter viewpoint / illustrative composition

### 06.04 · ความเก่ง / ไม่ได้เป็นเส้นตรง

- Place: Edge of the frontier; station {"x":22050,"y":-1180,"z":-10280}; incoming route descend. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: ความเก่ง / ไม่ได้เป็นเส้นตรง. The Jagged Technological Frontier
- Visual: frontier; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: dolly; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 3s, then 2.5s rest; full phase repeats every 5.5s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Dell’Acqua et al. · 2023 working paper

### 06.05 · ในขอบเขต / ช่วยได้มาก

- Place: Edge of the frontier; station {"x":23400,"y":-1300,"z":-10740}; incoming route descend. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: ในขอบเขต / ช่วยได้มาก. ระบุให้ชัดว่า “ดีขึ้น” วัดอะไร
- Visual: frontier-data; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: punch; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 3.5s, then 2.5s rest; full phase repeats every 6s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Dell’Acqua et al. · 2023 working paper

## 07 · CONFIDENCE

### 07.01 · DEATH CAP / ROULETTE

- On screen: DEATH CAP / ROULETTE. GAME 04 · เชื่อแล้วรอด / เชื่อผิดตกรอบ
- Visual: centered text on slate; layers: slate + foreground text
- Camera/entry: fade; fade 0.35s then hold
- Hold: static
- Exit: 0.22s fade
- Evidence: Designed activity / simulated content; see docs/mobile-games-spec.md

### 07.02 · มั่นใจมาก / ไม่ได้แปลว่าถูก

- Place: Botanical grove; station {"x":16350,"y":-1180,"z":-12760}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: มั่นใจมาก / ไม่ได้แปลว่าถูก. Confidence ≠ Correctness
- Visual: mushroom; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: dolly; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 2.9s, then 2.5s rest; full phase repeats every 5.4s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Archenzo · CC BY-SA 3.0

## 08 · ACT 2 RESULTS

### 08.01 · SURVIVOR RANKINGS

- On screen: SURVIVOR RANKINGS. ACT 02 · สรุปอันดับ
- Visual: centered text on slate; layers: slate + foreground text
- Camera/entry: fade; fade 0.35s then hold
- Hold: static
- Exit: 0.22s fade
- Evidence: Presenter viewpoint / illustrative composition

## 09 · EMPATHY

### 09.01 · ฟังดูอบอุ่น / แล้วเชื่อใจได้ไหม?

- Place: Listening room; station {"x":9200,"y":-300,"z":-15200}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: ฟังดูอบอุ่น / แล้วเชื่อใจได้ไหม?. The Illusion of Empathy
- Visual: chat; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: push; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 2.9s, then 2.5s rest; full phase repeats every 5.4s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Presenter viewpoint / illustrative composition

### 09.02 · คำตอบที่ / ผู้ประเมินเลือก

- Place: Listening room; station {"x":10550,"y":-180,"z":-15660}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: คำตอบที่ / ผู้ประเมินเลือก. 78.6% เลือกคำตอบ chatbot ในงาน Ayers
- Visual: empathy; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: punch; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 2.9s, then 2.5s rest; full phase repeats every 5.4s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Ayers et al. · JAMA 2023

### 09.03 · ข้อความที่อบอุ่น / ยังต้องตรวจสอบ

- Place: Listening room; station {"x":11900,"y":-300,"z":-16120}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: ข้อความที่อบอุ่น / ยังต้องตรวจสอบ. การรับรู้ความเห็นอกเห็นใจ ≠ ผลการดูแล
- Visual: tokens; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: arc; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 3.2s, then 2.5s rest; full phase repeats every 5.7s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Ayers et al. · JAMA 2023

## 10 · VERIFICATION

### 10.01 · คำแนะนำที่ดี / ต้องดีในบริบทด้วย

- Place: Safety checkpoint; station {"x":14000,"y":300,"z":-18800}; incoming route threshold. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: คำแนะนำที่ดี / ต้องดีในบริบทด้วย. Tessa · NEDA · ระบบที่ถูกระงับในปี 2023
- Visual: tessa; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: push; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 3s, then 2.5s rest; full phase repeats every 5.5s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Tessa · NEDA · 2023

### 10.02 · CHAT / WHACK-A-MOLE

- On screen: CHAT / WHACK-A-MOLE. GAME 05 · ทุบแชตที่ควรหยุด
- Visual: centered text on slate; layers: slate + foreground text
- Camera/entry: fade; fade 0.35s then hold
- Hold: static
- Exit: 0.22s fade
- Evidence: Designed activity / simulated content; see docs/mobile-games-spec.md

### 10.03 · ตรวจก่อน / ปล่อยคำตอบ

- Place: Safety checkpoint; station {"x":16700,"y":300,"z":-19720}; incoming route threshold. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: ตรวจก่อน / ปล่อยคำตอบ. บริบท → ความเสี่ยง → ส่งต่อ
- Visual: gate; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: push; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 3.3s, then 2.5s rest; full phase repeats every 5.8s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Presenter viewpoint / illustrative composition

## 11 · ACCOUNTABILITY

### 11.01 · เมื่อคำตอบ / สร้างความเสียหาย

- Place: Forum of responsibility; station {"x":18800,"y":650,"z":-21800}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: เมื่อคำตอบ / สร้างความเสียหาย. Air Canada · ข้อมูลส่วนลดค่าโดยสาร
- Visual: case; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: arc; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 2.45s, then 2.5s rest; full phase repeats every 4.95s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Moffatt v. Air Canada · 2024 BCCRT 149

### 11.02 · COMPANY / SHIELD

- On screen: COMPANY / SHIELD. GAME 06 · ลากบริษัทบังลูกค้า
- Visual: centered text on slate; layers: slate + foreground text
- Camera/entry: fade; fade 0.35s then hold
- Hold: static
- Exit: 0.22s fade
- Evidence: Designed activity / simulated content; see docs/mobile-games-spec.md

### 11.03 · AI IS A TOOL. / NOT A SHIELD.

- Place: Forum of responsibility; station {"x":21500,"y":650,"z":-22720}; incoming route walk. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: AI IS A TOOL. / NOT A SHIELD.. ความรับผิดต้องพิจารณาหน้าที่และข้อเท็จจริง
- Visual: liability; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: punch; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 2.7s, then 2.5s rest; full phase repeats every 5.2s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Moffatt v. Air Canada · 2024 BCCRT 149

## 12 · ACT 3 RESULTS

### 12.01 · THE FINAL SPRINT

- On screen: THE FINAL SPRINT. ACT 03 · สรุปอันดับ
- Visual: centered text on slate; layers: slate + foreground text
- Camera/entry: fade; fade 0.35s then hold
- Hold: static
- Exit: 0.22s fade
- Evidence: Presenter viewpoint / illustrative composition

## 13 · SYNERGY

### 13.01 · BETTER / TOGETHER?

- Place: Systems observatory; station {"x":23000,"y":1800,"z":-25600}; incoming route rise. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: BETTER / TOGETHER?. คน + AI ย่อมดีที่สุดเสมอ จริงหรือ?
- Visual: synergy; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: punch; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 2.45s, then 2.5s rest; full phase repeats every 4.95s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Vaccaro et al. · Nature 2024

### 13.02 · การร่วมมือ / ต้องออกแบบ

- Place: Systems observatory; station {"x":24350,"y":1920,"z":-26060}; incoming route rise. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: การร่วมมือ / ต้องออกแบบ. มอบงาน · ตรวจหลักฐาน · อนุมัติ
- Visual: design; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: push; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 3.3s, then 2.5s rest; full phase repeats every 5.8s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Presenter viewpoint / illustrative composition

### 13.03 · เร็วแค่ไหน / ก็ต้องตรวจก่อนปล่อย

- Place: Systems observatory; station {"x":25700,"y":1800,"z":-26520}; incoming route rise. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: เร็วแค่ไหน / ก็ต้องตรวจก่อนปล่อย. CrowdStrike · 19 July 2024
- Visual: outage; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: push; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 3.3s, then 2.5s rest; full phase repeats every 5.8s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: CrowdStrike · RCA · Aug 2024

### 13.04 · HUMAN / OVERSIGHT

- Place: Systems observatory; station {"x":27050,"y":1920,"z":-26980}; incoming route rise. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: HUMAN / OVERSIGHT. กำกับดูแลให้เหมาะกับความเสี่ยง
- Visual: oversight; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: arc; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 3.3s, then 2.5s rest; full phase repeats every 5.8s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: EU AI Act · Article 14

## 14 · SHARED CONTROL

### 14.01 · MISSING / PIECE

- On screen: MISSING / PIECE. GAME 07 · AI เริ่ม คนเติม
- Visual: centered text on slate; layers: slate + foreground text
- Camera/entry: fade; fade 0.35s then hold
- Hold: static
- Exit: 0.22s fade
- Evidence: Presenter viewpoint / illustrative composition

## 15 · SHARED FUTURE

### 15.01 · สมการของ / ความรับผิดชอบ

- Place: Shared horizon; station {"x":28700,"y":700,"z":-29600}; incoming route rise. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: สมการของ / ความรับผิดชอบ. เสนอ → ตรวจสอบ → รับผิดชอบ
- Visual: formula; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: push; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 3.5s, then 2.5s rest; full phase repeats every 6s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Presenter viewpoint / illustrative composition

### 15.02 · DIFFERENT / MINDS.

- Place: Shared horizon; station {"x":30050,"y":820,"z":-30060}; incoming route rise. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: DIFFERENT / MINDS.. สติปัญญาต่างลักษณะ
- Visual: different; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: push; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 4s, then 2.5s rest; full phase repeats every 6.5s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Presenter viewpoint / illustrative composition

### 15.03 · SHARED / FUTURE.

- Place: Shared horizon; station {"x":31400,"y":700,"z":-30520}; incoming route rise. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: SHARED / FUTURE.. ก้าวสู่อนาคตร่วมกัน
- Visual: future; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: arc; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 4s, then 2.5s rest; full phase repeats every 6.5s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Presenter viewpoint / illustrative composition

### 15.04 · HUMAN / RESPONSIBILITY.

- Place: Shared horizon; station {"x":32750,"y":820,"z":-30980}; incoming route rise. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: HUMAN / RESPONSIBILITY.. ผู้ตัดสินใจต้องพร้อมรับผิดชอบผลลัพธ์
- Visual: responsibility; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: punch; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 4s, then 2.5s rest; full phase repeats every 6.5s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Presenter viewpoint / illustrative composition

## 16 · EPILOGUE

### 16.01 · GRAND PODIUM / CEREMONY

- On screen: GRAND PODIUM / CEREMONY. ประกาศรางวัล · อันดับ 1–3
- Visual: centered text on slate; layers: slate + foreground text
- Camera/entry: fade; fade 0.35s then hold
- Hold: static
- Exit: 0.22s fade
- Evidence: Presenter viewpoint / illustrative composition

### 16.02 · ตรวจก่อนเชื่อ

- Place: Shared horizon; station {"x":36800,"y":820,"z":-32085}; incoming route rise. Camera leaves the previous actual pose, follows a curved world path from 0.16–1.71s, passes three scenic thresholds, then lands beside the native text.

- On screen: ตรวจก่อนเชื่อ. ชื่อของคุณยังอยู่บนงานนี้
- Visual: thanks; layers: four authored scenic CSS3D planes + atmosphere/particles + spatial SVG/photo glass cards + native HTML typography in the same perspective camera
- Camera/entry: fade; card reveal from 1.15s; native text lines from 1.25s with 0.105s stagger; camera pulls wide then travels inward and lands by 2.8s (initial load starts earlier)
- Hold: gentle card drift and ambient material light; narrative window 4s, then 2.5s rest; full phase repeats every 6.5s. Exact evidence figures stay fixed; mushroom confidence is explicitly simulated.
- Exit: old card group moves in Z with Y/X rotation, fades 0.46s; old text lines move forward/tilt and fade 0.44s; next cue camera begins from captured actual pose
- Evidence: Presenter viewpoint / illustrative composition

