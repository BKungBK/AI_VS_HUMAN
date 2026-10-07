# Caption & Prompt Battle — design documentation review

Reviewed 7 October 2026 as an ordinary extension of **The Sparring Minds**. Result: **source-system concordance passes**. The implementation inherits the incumbent visual system; this pass does not establish a replacement identity or turn Caption-specific composition into global design rules. Browser finish verification is a separate check.

## Output contract

Written: `qa/game3/design-documentation.md` only. `DESIGN.md` and `.impeccable/design.json` are preserved under the documenter’s ordinary-extension rule. No implementation files were edited by this review.

## Evidence checked

| Evidence | Observed contract |
|---|---|
| `PRODUCT.md`; `.impeccable/surfaces/caption-battle.md` | Existing slide/font authority; responsive Player/Host/Display extension; explicit publication boundaries; no new visual world or sound bed. |
| `DESIGN.md`; `.impeccable/design.json` | Incumbent palette, local single-family type, flat game surfaces, shared controls, role-specific layouts, and the four named rules remain applicable. The sidecar is schema version 2 and retains its 6 October first-game snapshot. |
| `src/style.css:1`; `src/game-client/game.css:1` | Locally served IBM Plex Sans Thai 400/500/600/700; slate, panel, foreground, Human, AI, and mint values match the incumbent tokens. Base game text remains 16px/1.65. |
| `src/game-client/game.css:4`; `src/game-client/game.css:5` | Existing buttons and fields retain their 48px minimum height, 8px control corners, mint focus ring, and explicit hover/disabled states. Caption’s textarea adds the same focus treatment at `caption.css:14`. |
| `src/game-client/GameApp.tsx:5`; `src/game-client/GameApp.tsx:286` | Caption styling follows the shared game stylesheet; game selection retains the existing `game-page`, header, join flow, and role routing. |
| `src/game-client/caption.css:3`; `src/game-client/caption.css:7`; `src/game-client/caption.css:21`; `src/game-client/caption.css:35` | Caption uses the existing 30px Player title and 44px tabular timer, 12px flat panel corners, game-line borders, foreground reading text, and selected-group fill with mint border. Compact voting typography is a local timed-comparison treatment. |
| `src/game-client/game.css:8`; `src/game-client/game.css:12`; `src/game-client/caption.css:34`; `src/game-client/caption.css:43` | Player retains a 540px reading column; Host retains its 1360px shared shell. Caption’s 1580px Display, three-column review queue, sticky task status, and 1000/640/1200px layout rules remain surface-specific. The full 4:3 prompt uses `object-fit:contain`. |
| `src/game-client/CaptionBattle.tsx:45`; `src/game-client/CaptionBattle.tsx:76`; `src/game-client/CaptionBattle.tsx:79`; `src/game-client/CaptionBattle.tsx:120` | Local draft, saving, accepted, submitted, conflict, selected, own-group-disabled, pending review, rejected, and withheld states are expressed in text. Selection also uses `aria-pressed`; Host review focus advances within the bounded queue. |
| `src/game-client/CaptionBattle.tsx:18`; `src/game-client/CaptionBattle.tsx:85`; `src/game-client/game.css:17` | Result rows use one finite paused GSAP timeline with a short capped stagger, elapsed-phase seeking, and a reduced-motion guard. Final cards remain anonymous in the rendered source until results; no ambient or sound layer is added. |
| `docs/ui_Caption_&_Prompt_Battle.md` | Handoff documents the editor, review queue, anonymous final gallery, projection result composition, local rehearsal limits, and editing paths. Its corrected color sentence explicitly permits the Host’s preflight AI periwinkle before Start, consistent with `caption.css:28`. Caption-specific behavior remains outside the root design system. |

## Five-line system summary

1. Palette: slate `#0D1117`, panel `#161e2a`, foreground `#F8F9FA`, Human coral `#FF6B6B`, AI periwinkle `#748FFC`, and shared mint `#63E6BE`; **The Side Identity Rule** is retained.
2. Type: local IBM Plex Sans Thai; 16px/1.65 body, 30px Player title, responsive 28–48px game headings, 44px timer with compact reduction; tabular numerical evidence remains legible.
3. Actions: 48px minimum shared controls, 8px field/button corners, 3px mint focus outline with 4px offset; **The Shared Action Rule** governs primary actions, readiness, selection, and approval.
4. Form: flat tonal panels, fine strokes, 12px Caption card corners, normal responsive game flow; **The Two Layouts Rule** preserves the separate cinematic slide stage.
5. States and motion: readable draft/review/vote/result labels precede decoration; **The State Before Decoration Rule** remains binding, with the finite reduced-motion-aware result reveal scoped to this surface.

## Not canonized or repaired

No new world drift or craft-floor refusal was found in the Caption source sample. The incumbent system files remain a first-game documentation snapshot, and their existing slide eyebrow metadata is not adopted as a Caption role. That pre-existing documentation coverage is preserved, rather than refreshed or canonized, because this is an ordinary established-world extension. The corrected Caption handoff color sentence now agrees with Host preflight source behavior.

## Preserved system fingerprints

- `DESIGN.md` SHA-256: `FCDEEEF883241173DED85AEFE8FE402403CAB584CF65B107D7C40A1DF9246BB9`
- `.impeccable/design.json` SHA-256: `54716EFD253897AC66E86BC80C02BB259439410D7C59BD7E59A20DD126A4EAE0`
