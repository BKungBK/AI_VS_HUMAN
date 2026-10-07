---
title: Trust Tug-of-War
mode: Operate
targets:
  - src/game-client/GameApp.tsx
  - src/game-client/game.css
  - /games
  - /play/:roomCode
  - /presenter/:roomCode
  - /display/:roomCode
---

# Trust Tug-of-War surface brief

Recorded from the first implemented game extension on 6 October 2026. This is a local Elysia/PGlite rehearsal surface. The established world is documented in DESIGN.md; product and scoring authority remains in PRODUCT.md, docs/game-build-plan.md, and docs/game-foundation-contract.md.

## Scope and job

Player chooses Human or AI, practices, pulls during the live window, and reads accepted progress and results. Host prepares the room, observes readiness, starts/pauses/resumes, and explicitly confirms completion. Display makes side averages and group results legible on the room projection. The entry page supports room entry and local host room creation.

Player and Host are Operate surfaces. Display is a Read surface during comparison/results and presents the existing deck when the room cue advances. The current Host page is intentionally a minimum functional controller; its final layout remains deferred.

## Direction contract

**THESIS:** Put the live task and trustworthy state in front: Player reads time, pulls, and sees accepted progress; Display compares exact averages; Host has the minimum controls required to rehearse.

**OWN-WORLD:** Preserve local IBM Plex Sans Thai and the incumbent dark neo-pastel world. Human is coral, AI periwinkle, and shared actions mint. Game panels are flat and stroked; the rope is geometric SVG.

**STORY:** Choose a side without changing the competition group, rehearse the gesture, pull for the live interval, and read results while the Host owns the next cue.

**FIRST VIEWPORT:** Player identity and title lead; live timer sits above a large side-colored pull action, with accepted score below. Host controls occupy the left and join QR the right. Display centers the rope between named sides and shows group averages beneath it.

**FORM:** User-specified extension, code-led. No concept dice run or seed key was used. The memorable moment is the mint rope marker moving with side average force.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Surface composition

- **Player:** maximum width 540px with 24px horizontal padding. Human/AI choice stays two columns. The live sequence is locked side → timer → pull → accepted total. Settings and leave action remain below the main task. Feedback appears in flow and never covers the action.
- **Host:** maximum width 1360px. A flexible control column sits beside a 310px join sidebar; the sidebar narrows to 245px at 900px. Group rosters follow below. Cancel/replay/cue tools sit in disclosure. RESULT has one “จบเกม / ไปต่อ” control.
- **Display:** maximum width 1480px. Named sides and member counts frame the rope, side average labels are adjacent, and group results use a compact list with group name, roster denominator, and average score. QR appears only before team lock. After Host finish advances to cue 03.01, the existing presentation opens in a synchronized iframe.
- **Entry:** maximum width 1160px, with game introduction beside room/host actions.

## Responsive behavior

At 900px, roster columns reduce three → two; the two-column Home/Host structures remain. At 640px, Home and Host stack, roster columns reduce to one, and Display scores become one column. Join group tiles remain three columns. A desktop result rule at 1000px and above reduces Display arena height. Keep the fixed 1920×1080 presentation contract separate from these layouts.

## States and trustworthy numbers

The sequence is ready/side choice → optional 15-second practice → 3-second countdown → 10-second pull → results waiting for Host → confirmed completion. Practice has its own local counter and no score. The live action uses one pointerdown per tap and non-repeating Enter/Space support.

Show “ระบบรับแล้ว” for accepted taps and points; show “รอส่ง” independently for queued input. Score is 10 per accepted tap with no per-player cap during the 10-second pull window. Group score is total accepted points divided by the roster frozen at Start, including zero-input members. Display formats group averages to two decimal places; sorting and tie comparisons use integer numerators/denominators. Side force is taps per side member, shown to one decimal place; the verdict compares exact cross-products. An empty side reads “ไม่มีคู่เปรียบเทียบ”.

Pause stops the timer and disables pulling. An inactive writer tab exposes an explicit takeover action. Late or unselected players get a reason they cannot pull this round. API loss preserves the last accepted snapshot, shows connection status, and disables input. CANCELLED is “ยกเลิก / ไม่นับคะแนน”; it is not a zero score. RESULT remains provisional until the Host confirms; it does not auto-advance.

## Evidence and remaining work

Inspected src/style.css, frame.md, PRODUCT.md, src/game-client/game.css, and GameApp.tsx. Visually inspected qa/game1/mobile-ready.png and mobile-pulling.png at 390×844, host-ready.png from a 1366×900 viewport with full-page capture, and display-result.png at 1920×1080. The fresh mobile-ready capture for room C3769A visibly confirms Human selection and enabled side choices; it replaces an earlier capture that had a state race.

The UI handoff is docs/ui_Trust_Tug-of-War.md. Its earlier wording about 900px/640px stacking was broader than the CSS; this brief records the CSS accurately. The parent is clarifying that guide. frame.md’s “No game/backend” sentence belongs to the historical slide brief; the game is an explicit later extension.

Final Host design, real device rehearsal, and hosted deployment are outside this documentation’s evidence. The parent’s independent finish reviewer supplies the review disposition; this brief does not substitute for that review.
