# Swipe Court — QA review

Review date: 7 October 2026 (Asia/Bangkok)

## Build and behavior

- `npm run game:build`: successful; final build rerun after the progress-bar motion was changed to a transform.
- `npm run game:test`: 10 contract tests passed, including game-one regression coverage, private reveal data, answer locking, scoring, and host finish behavior.
- PowerShell `$env:GAME_TEST_ORIGIN='http://127.0.0.1:5181'; npm run game:qa2`: final run passed all 13 browser checks in Chrome/Playwright; no uncaught browser errors. The run completed all eight rounds and inspected a 1920×1080 display plus mobile player layouts.
- The browser run's machine-readable report is [browser-checks.json](browser-checks.json). Captured states are in this directory.

The first post-build QA invocation omitted `GAME_TEST_ORIGIN` and hit the trust-tug-v1 server on port 5180, so it timed out before a game could start. It left one unused room (`3C35B1`) with a test player in the first game's local database; no run or score was created. That older server has no supported room-delete route. The final QA run used port 5181 explicitly and completed all 13 checks.

## Visual review

The Host ready view, Mobile ready view, and Display summary were captured after the final layout correction. The 1920×1080 display summary fits inside its viewport with the eight-image reveal and group scores visible. Mobile has no horizontal overflow; the full reveal can scroll vertically.

The Impeccable detector was run once after the screenshot review rounds. Its one non-advisory width-transition finding was corrected to a transform-based progress animation. The remaining findings concerned the established surface's existing literal styles and task-specific design tokens; they were treated as advisory. The detector was not rerun.

## Content privacy and provenance

The eight served JPEGs have neutral opaque filenames and stripped image metadata. The required Impeccable prompt-metadata scan found no embedded prompt fields. Prompt/source details and classifications stay in the server-only content manifest and are returned only during `REVEAL_ALL`; embedding metadata into public images would disclose the answer/provenance before the game permits it. Human artwork attribution and AI session-brief notes are documented in `docs/ui_Swipe_Court.md` and the server manifest.

## Scope and remaining validation

This verifies the local app in desktop Chrome and a mobile-sized browser viewport. A physical phone, venue Wi-Fi, and projector hardware were not available for this pass. To perform a clean manual run, start a new room on port 5181 using [test-game2.md](../../docs/test-game2.md).

## Final review and system documentation

Finish reviewer disposition: **ship**. The reviewer found no material issues across the Host, mobile player, first reveal, and 1920×1080 summary captures; the privacy safeguards, server deadlines, and content versions matched the source contract.

No changes to `DESIGN.md` or `.impeccable/design.json`; the inline documenter pass was used because its shipped agent was unavailable after reaching its usage limit. Checked `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, `.impeccable/surfaces/swipe-court.md`, the built `GameApp.tsx` and `game.css`, and the Host/mobile/display captures above.

- Palette: slate and raised slate surfaces, Human coral, AI periwinkle, shared mint actions, and off-white text.
- Type ramp: IBM Plex Sans Thai weights 400–700; 30px player title, 16px body, 14px labels, 44px timer, with tabular numerals for scores and time.
- Named rules: Side Identity Rule and Shared Action Rule keep Human/AI identifiable and shared actions mint.
- Named rules: Two Layouts Rule separates the fixed projection stage from responsive game flow; State Before Decoration keeps every game state readable.
- Not canonized or repaired: detector advisories for literal and task-specific styles remain surface implementation details, not durable shared tokens; the established design source was preserved during this ordinary extension.
