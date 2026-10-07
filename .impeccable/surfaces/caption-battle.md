---
title: Caption & Prompt Battle
mode: Operate
targets:
  - src/game-client/CaptionBattle.tsx
  - src/game-client/caption.css
  - /play/:roomCode
  - /presenter/:roomCode
  - /display/:roomCode
---

# Caption Battle surface contract

Established-world extension on 7 October 2026. Product authority: docs/game-build-plan.md §6 and docs/game-foundation-contract.md. Incumbent visual authority: DESIGN.md, frame.md, game.css, and existing Player/Host/Display surfaces.

THESIS: One shared meme becomes individual text, then a group nomination, then anonymous competition. The game advances through explicit, readable publication boundaries.

STORY: Shared prompt → individual accepted revisions → single-host final-revision moderation → reviewed group nomination → anonymous final voting → revealed weighted support → manual confirmation and cue 04.02. An unfinished review blocks publication.

FORM: Inherit the existing responsive Player/Host/Display topology and controls. This established-world extension skipped a new concept roll and has no approved comp or replacement identity. Dense, bounded review queues and sticky task status serve the two timed comparison tasks; projection finals/results fit the 1920×1080 viewing surface.

OWN-WORLD: Preserve slate #0D1117, game panel #161e2a, foreground #F8F9FA, Human coral #FF6B6B, AI periwinkle #748FFC, shared mint #63E6BE and local IBM Plex Sans Thai. No identity replacement, new font, ambient decoration, or sound bed.

FIRST VIEWPORT: Player sees identity, title, server clock, full 4:3 meme and prompt, then one visible caption editor with a grapheme counter and explicit save state. Host sees the phase and controls, preflight AI approval before Start, and a dense three-column review queue with one revision per item. Display is an Experience/Read surface: shared meme and phase, then large anonymous captions with consistent positions.

SIGNATURE INTERACTION: A text change creates a new revision and invalidates old moderation; confirmed drafts become nomination cards only after review. Selecting a final card locks a visible choice while keeping revision-based vote changes available until the common deadline. Own-group candidates remain visible with an explicit disabled reason.

MOTION: A single finite, paused GSAP timeline reveals result rows from an already readable default, using a capped stagger and expo.out. No loops. Game reduced-motion preference is respected. Existing presentation motion/audio behavior remains scoped to the deck.

FINISH: ui_Caption_&_Prompt_Battle.md and test-game3.md record the editing and rehearsal contract. Browser QA runs 32 frozen roster members and captures desktop, 390px, 320px, Host and 1920px projection states.
