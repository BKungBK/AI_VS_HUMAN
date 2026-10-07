# Place journeys — revision 4 QA

2026-10-06. Current source: React / TypeScript / GSAP / Three.js, local Chrome with ANGLE D3D11. Scenery uses authored SVG in camera space; no mesh models and no automatic sound. Research copy, the 16 chapters / 42 cues and original source documents retain their approved content.

31 content cues now occupy unique world addresses in 11 scenic districts. Travel combines departure, curved camera movement through thresholds, and a frontal landing. Local punch-in, arc and compensated dolly remain. Typography enters and leaves in Z as intact Thai lines, settling by 2.8s. Room-specific ambient light and semantic loops continue during the talk. The 11 placeholder cues retain plain centered text.

| Check | Actual result |
|---|---|
| Production TypeScript / Vite build | PASS |
| Browser / all 42 layouts / navigation / paused changes / slow loading / local assets / presenter / fallback | 65 / 65 PASS |
| Unique places, world routes, backwards/interrupted travel, text, deterministic seek and all 11 room loops | 33 / 33 PASS |
| Off-white contrast on synchronized composited frames at 1080p | 42 / 42 PASS; minimum 10.059:1 |
| Fullscreen, presenter dialogue/sync, five raster loop joins, startup without WebGL | 15 / 15 PASS |
| Interrupted-flight seek reconstruction at 0.85s | Exact camera/DOM and 0 changed raster pixels after forward/backward seek |
| Runtime / missing resources | No errors in the automated checks |

Visual review started with opening, frontier and empathy. The scenery became quieter behind essential copy. A duplicate closing address was separated. Repeated seek captures exposed browser sorting of intersecting transparent floors and thresholds; the ground now releases during departure, and scenic planes/thresholds use independent CSS perspective contexts with explicit order from the same world camera. The reproduced failure now passes without relaxing the raster tolerance. Near-plane projection artifacts were then found in consecutive frames: surfaces are now culled before their corners reach the camera, and SVG surfaces use smaller intrinsic dimensions with the same world scale. All 72 sampled transition frames and all 720 final source-film frames retain the screen-space brand. Retained scenery is bounded to three sets.

`qa/contact-sheet.jpg` contains the current 42 reading frames, and `qa/place-gallery.jpg` compares 11 places. `qa/place-journey/` contains the current consecutive transition samples. The silent review clip is `qa/place-journey-preview.mp4`: six journeys, 24s at 30fps, 1280×720 capture from the 1920×1080 presentation stage. Export verification and encoded-frame inspection are recorded separately in the same QA directory.

The refreshed browser run briefly sampled a newly mounted FLAMINGONE image before DOM decoding completed. The capture fixture now waits for the actual image element to decode; the full run passed again. This is a capture-readiness correction, with no research-copy or game changes.

Export: H.264 / yuv420p / 1280×720 / 30fps / 24.0s / 720 frames / no audio, full decode PASS. Sixteen extracted encoded frames were inspected as a contact sheet, plus full-size frontier and checkpoint arrival frames. No unintended black projection planes, missing assets or headline collisions were seen. `place-video-verification.json`, `place-film-integrity.json` and `place-encoded-checks.json` record the separate checks.

Performance observation: 120 rAF intervals on this machine at 1920×1080 gave p50 33.30ms, p95 50.10ms (about 30fps median during the opening hold; contact-sheet work was also active). This is headless browser evidence, not an isolated benchmark or real-projector test. Fonts, images and runtime are local; actual projection distance, light, projector colors and stage hardware still require an on-site rehearsal. FLAMINGONE retains its documented private-reference rights limitation.

The `spatial-*` reports/clips are historical revision 3 evidence. Current acceptance uses `place-*` plus the refreshed browser, contrast and final reports.
