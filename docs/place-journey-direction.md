# Place journeys — revision 4

Each content cue is a station in a connected scenic world. There are 31 unique addresses across 11 districts. Background architecture is authored SVG in four real CSS3D planes: distant silhouette at Z−1400, walls at Z−620, peripheral threshold at Z+250, and a tilted floor. Illustrative scenery carries no research claims. The approved dark slate, coral, periwinkle, mint/gold and local Thai font remain the source of truth.

| District | Story | Scenic structure | Ambient loop |
|---|---|---|---|
| Confluence | Opening / biology / responsibility question | Paired human and AI hall ribs | Light passes between the ribs |
| Gallery | Experience / poem / FLAMINGONE / bias | Exhibition frames and display lights | Display lighting; original poem token loop |
| Atrium | Individual quality / diversity | Branching structural paths | Light relays along the branches |
| Laboratory | Tensor / protein / strategy | Modular cabinets and scan rails | Scan light; original matrix/protein loops |
| Frontier | Jagged Frontier / boundary results | Layered cliff silhouettes | Coral hazard edge; original hazard graphic |
| Grove | Death Cap confidence | Peripheral botanical canopies | Gentle leaf movement and spores; simulated confidence |
| Listening | Warm language / Ayers / interpretation | Curved acoustic panels | Soft room light; stationary essential copy |
| Checkpoint | Tessa / answer verification | Nested safety thresholds | Sequential threshold lights; illustrative ECG |
| Forum | Air Canada / liability | Columns and entablature | Warm light across the civic structure |
| Observatory | Collaboration / design / outage / oversight | Bridges, support cables and signal nodes | Signals travel across bridge nodes |
| Horizon | Equation / different minds / future / responsibility / thanks | Open terrain and a clear horizon | Horizon light; original equation breathing glow |

Travel has three phases: leave the old room, cross a connecting space, then land beside the new content. The old room remains in camera space while the destination is already visible. Three peripheral thresholds occupy intermediate points on a cubic Bézier path. No full-screen blackout separates content scenes.

| Phase | Cue clock | Camera and typography |
|---|---:|---|
| Departure | 0–0.48s | Start at the captured live world position and view, including interrupted flights. Old native Thai lines peel through Z and fade. Old floor releases by 0.35s to avoid intersecting transparent floors. |
| Travel | 0.16–1.71s | Ease along the curved world route. Small yaw/bank follows travel, returning exactly to zero at landing. Walls and thresholds produce depth parallax. |
| Arrival | from 1.15s cards / 1.25s title | Cards and native HTML lines enter along Z and turn frontal. Complete Thai lines retain shaping. Supporting copy follows. |
| Read | by 2.80s | Local camera is Z1500 / FOV39.60°, frontal. Main text returns to identity. Room-specific lighting and semantic loops run from the single cue clock. |

Primary travel is a lateral walk through rooms. Accents are a descending crane toward the frontier, passage through a safety threshold, and a rising route toward the shared horizon. The existing 0.6s punch and compensated Z/FOV dolly are local camera moves inside these journeys. Backward navigation retraces toward the actual earlier address; a new interruption starts at the current world pose, rather than restarting an authored entrance pose.

The screen-space header/footer remain navigation anchors. A soft mask on the scenery keeps the reading area quiet. Essential text has no idle scale or camera drift. Scenic objects use a bounded periodic phase, not wall-clock CSS keyframes. Placeholders retain the approved centered text, brief fade, static slate and zero scenery/particles/travel. Camera, text and scenery always play the full motion sequence on every system. All scenery and text work without WebGL; Three.js renders only the sparse particles.

`Places.ts` owns scenic silhouettes, addresses, paths and ambient updates. `World.ts` owns one global perspective camera and one paused GSAP timeline. Scenic planes use independent CSS perspective contexts fed by that same camera, with explicit camera-space painter order; this avoids browser history changing transparent-plane overlap after a seek. Planes are culled before their corners reach the camera; smaller intrinsic SVG surfaces preserve world size while reducing raster pressure. Memory is bounded to the current place plus two retiring sets. State reports both local camera properties and `worldCamera`, `placeAnchor`, `journey`, and scene counts for QA. Local station geometry never depends on DOM measurements during a seek.

The 24s silent QA preview samples six complete journeys at 30fps. It is a review clip; the live presentation remains presenter controlled across the approved 50-minute framework.
