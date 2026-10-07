---
title: Swipe Court
mode: Operate
targets:
  - src/game-client/GameApp.tsx
  - src/game-client/game.css
  - /play/:roomCode
  - /presenter/:roomCode
  - /display/:roomCode
---

# Swipe Court surface brief

Recorded from the second implemented mobile game on 7 October 2026. This is a local Elysia/PGlite rehearsal surface. The established HUMAN vs AI world remains authoritative in `DESIGN.md`; game and data authority remain `docs/game-build-plan.md` and `docs/game-foundation-contract.md`.

## Scope and job

Player decides whether a photograph or artwork was made by a person or AI. The server synchronizes eight four-second windows, freezes each player's first accepted answer per image, and withholds answer class and provenance through the final answer window. The player can use either a directional drag or explicit Human/AI buttons. Host prepares and starts the room, can pause/resume or cancel/replay, inspects progressive reveals, and confirms the result manually. Display follows the same image and then reveals credits and vote statistics.

Player and Host are Operate surfaces. Display is an Experience surface during the synchronized image sequence and a Read surface during the reveal.

## Direction contract

**THESIS:** Let the image carry the uncertainty. Keep the two answer rails fixed at the edges so players can make a clear, quick choice with one gesture or tap.

**OWN-WORLD:** Preserve slate, IBM Plex Sans Thai, Human coral, AI periwinkle, shared mint focus, and the room header. Reuse the existing dark neo-pastel game world without borrowing the presentation's glass layers.

**STORY:** Images preload → common countdown → synchronized image decisions → a first answer locks → credits and evidence appear after all eight windows close → Host confirms and returns to the deck.

**FIRST VIEWPORT:** Player sees title/time, persistent left=Human and right=AI labels, one uncropped 4:3 image, and two large labeled buttons. Display uses the same image with answer count and timer. Host sees preparation, controls, roster, and join link.

**FORM:** Image-led, functional motion. Only an accepted choice moves a card out; no sound or decorative loop is required.

**FINISH:** `docs/ui_Swipe_Court.md` is the UI editing handoff. Local test evidence is recorded in `qa/game2/` after a complete browser run.
