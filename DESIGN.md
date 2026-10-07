---
name: HUMAN vs AI
description: Dark neo-pastel presentation and mobile game system for The Sparring Minds.
colors:
  slate: "#0D1117"
  raised: "#161B22"
  human: "#FF6B6B"
  ai: "#748FFC"
  mint: "#63E6BE"
  gold: "#FFD43B"
  foreground: "#F8F9FA"
  spatial-glass: "rgba(31,36,48,.91)"
  game-panel: "#161e2a"
  game-line: "#364255"
  game-muted: "#bbc7d9"
  control-secondary: "#26344c"
  control-border: "#53617a"
  field: "#101824"
  human-readable: "#ff9f9f"
  ai-readable: "#a9baff"
  human-selected: "#43252b"
  ai-selected: "#24365b"
  group-selected: "#163b34"
  warning-text: "#ffd499"
  warning-surface: "#272419"
typography:
  display:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "112px"
    fontWeight: 600
    lineHeight: 1.03
    letterSpacing: "-0.075em"
  headline:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "88px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.045em"
  slide-body:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1.65
  slide-label:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.095em"
  title:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "clamp(28px,4vw,48px)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  title-player:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
  pull:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "64px"
    fontWeight: 700
    lineHeight: 1.2
  timer:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "44px"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  control: "8px"
  group-choice: "10px"
  note: "12px"
  side-choice: "14px"
  overlay: "16px"
  pull: "22px"
  spatial-card: "24px"
spacing:
  group-gap: "10px"
  choice-gap: "14px"
  text-gap: "16px"
  section-gap: "24px"
  panel-gap: "32px"
  desktop-gutter: "40px"
  major-gap: "48px"
components:
  button-primary:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.slate}"
    rounded: "{rounded.control}"
    padding: "11px 24px"
  button-secondary:
    backgroundColor: "{colors.control-secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "11px 24px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "11px 24px"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  side-choice:
    backgroundColor: "{colors.game-panel}"
    rounded: "{rounded.side-choice}"
    padding: "22px 12px"
  side-choice-human-selected:
    backgroundColor: "{colors.human-selected}"
    textColor: "{colors.human-readable}"
    rounded: "{rounded.side-choice}"
    padding: "22px 12px"
  side-choice-ai-selected:
    backgroundColor: "{colors.ai-selected}"
    textColor: "{colors.ai-readable}"
    rounded: "{rounded.side-choice}"
    padding: "22px 12px"
  group-choice-selected:
    backgroundColor: "{colors.group-selected}"
    rounded: "{rounded.group-choice}"
    padding: "14px 12px"
  waiting-note:
    backgroundColor: "{colors.game-panel}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.note}"
    padding: "23px"
  pull-human:
    backgroundColor: "{colors.human}"
    textColor: "{colors.slate}"
    typography: "{typography.pull}"
    rounded: "{rounded.pull}"
    padding: "25px 16px"
  pull-ai:
    backgroundColor: "{colors.ai}"
    textColor: "{colors.slate}"
    typography: "{typography.pull}"
    rounded: "{rounded.pull}"
    padding: "25px 16px"
  spatial-card:
    backgroundColor: "{colors.spatial-glass}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.spatial-card}"
---

# Design System: HUMAN vs AI

## Overview

**Creative North Star: "The Sparring Minds"**

The Sparring Minds gives Human and AI equal visual presence in a dark neo-pastel world. Slate and off-white carry the reading surface; coral and periwinkle identify the two sides, while mint marks shared actions, readiness, and the rope’s comparison marker. The locally packaged IBM Plex Sans Thai family connects Thai instructions, Latin titles, and numerical evidence.

The presentation expresses this world through a fixed cinematic stage, glass cards, authored SVG scenery, and camera-led motion. The game app shares its HUMAN vs AI framing, locally served typography, readable status, focus treatment, and responsive controls. Each game’s own UI brief may set a scoped accent palette for its mechanic and emotional tone; those accents extend the shared shell rather than replacing the Human/AI labels or status semantics. The game evidence is from a local Elysia/PGlite rehearsal; it does not establish a hosted or production release.

**Key Characteristics:**

- Dark slate surfaces with off-white reading text.
- Human coral, AI periwinkle, and mint actions with explicit text labels.
- One locally served Thai/Latin font family with weight-based hierarchy.
- Cinematic depth in slides; task-focused, flat surfaces in the game.

This scan records the presentation and seven-game system on 7 October 2026. Visual authority is src/style.css and frame.md for the presentation, plus the shared game shell and each game’s scoped UI brief under docs/ for game surfaces. PRODUCT.md constrains scope; .impeccable/surfaces/ contains per-game handoff guidance. Route strategy belongs in those surface briefs.

## Colors

The palette pairs warm Human coral and cool AI periwinkle with quiet blue-black neutrals. Frontmatter contains the canonical values; the sidecar’s generated tonal strips are previews, not additional application tokens.

### Primary

- **Shared Mint** (mint) identifies primary game buttons, keyboard focus, ready status, selected groups, and the rope knot.
- **Human Coral** (human) identifies Human endpoints and the Human pull action. Human Readable and Human Selected supply legible text and selected fill on dark panels.

### Secondary

- **AI Periwinkle** (ai) identifies AI endpoints and the AI pull action. AI Readable and AI Selected supply legible text and selected fill on dark panels.

### Tertiary

- **Responsibility Gold** (gold) marks verification and shared responsibility in presentation scenes.
- **Warm Warning** (warning-text, warning-surface) carries game feedback and pending input text.

### Neutral

- **Slate** is the base canvas; **Raised Slate** and **Spatial Glass** supply presentation surfaces.
- **Game Panel** supplies waiting and side-choice surfaces. **Game Line** separates rosters, results, and control sections.
- **Off-white Foreground** carries primary text; **Game Muted** carries descriptions and metadata.
- **Control Secondary**, **Control Border**, and **Field** distinguish secondary buttons and editable fields without competing with side identity.

**The Side Identity Rule.** Human retains coral and AI retains periwinkle. Use names and icons alongside color so side identity remains explicit.

**The Shared Action Rule.** Mint belongs to common actions, readiness, focus, and comparison markers. A side-specific pull uses that side’s color.

## Typography

**Display Font:** IBM Plex Sans Thai, with sans-serif fallback.  
**Body Font:** IBM Plex Sans Thai, with sans-serif fallback.

The same family carries Thai instructions and Latin names. Weight and scale establish hierarchy; there is no separate decorative or monospace family. Local font files provide regular, medium, semibold, and bold weights. Root styling disables synthesized faces.

### Hierarchy

- **Display:** the final opening title role (112px, 600). It belongs to the fixed presentation stage.
- **Headline:** standard slide headings (88px, 600); slide body and eyebrow roles remain separate from game text.
- **Title:** responsive game headings use the title role. Player has its own fixed title role (30px); Home has an observed larger title override.
- **Body:** game instructions use the body role (16px, 1.65). Supporting copy commonly uses 13–14px; connection metadata can be 10–12px.
- **Label:** compact identity and status text use the label role; primary game buttons use weight 600.
- **Pull:** the live pull label uses the pull role (64px, 700). Practice intentionally uses a smaller label (48px) and shorter control.
- **Timer:** the clock uses tabular numerals; compact game layouts reduce it to 36px. Accepted totals, scores, and room codes also use tabular numerals.

Preserve Thai descenders with the observed line heights. Do not apply the slide scale to phone controls.

## Layout

The presentation is a fixed 1920×1080 stage scaled into the viewport. Its header rails sit 96px from the stage edges, copy and footer use 100px offsets, and its scenic/card layers inhabit camera space. Presentation controls and the responsive presenter console live outside that projected stage.

The game uses normal responsive document flow with a minimum 100dvh page. Content widths are role-specific: Player 540px, Host 1360px, Display 1480px, entry page 1160px, and header 1440px. Player keeps 24px horizontal padding. Host puts controls beside a QR sidebar and places group rosters below; Display centers its rope comparison and group result list. These compositions are specified in the surface brief.

At 900px, the Host sidebar narrows and rosters change from three columns to two; Home and Host retain their two-column structure. At 640px, Home and Host become one column, rosters become one column, and Display scores become one column. Player side selection retains two equal columns and the join group selector retains three columns. A separate 1000px minimum-width rule tightens the Display result arena to fit the projection. The presentation console has its own 700px breakpoint.

**The Two Layouts Rule.** Preserve the presentation’s fixed stage and the game’s responsive document flow as separate layout contracts.

## Elevation & Depth

Presentation depth comes from camera placement, translucent glass, a fine border, inset highlights, and low accent light around cards. The current card shadow includes a dynamic ambient-light term; its full declaration lives in the sidecar. Controls, the chapter index, and the sound panel have their own overlay shadows.

Game surfaces are flat: panels use tonal separation, strokes, and spacing rather than box shadows. Reserve the presentation’s glass and scenic atmosphere for presentation content. A game state change should remain evident when decorative effects are absent.

## Shapes

Game fields and standard actions use compact rounded corners (control); group choices, notes, and side choices step through larger radii. The pull control uses a broad rounded rectangle (pull), while the presentation’s glass cards use spatial-card corners. Thin rules organize lists and sections.

Human and AI use simple inline line icons. The game’s signature rope is an SVG diagram: coral and periwinkle endpoints, two opposing curved strands, a dashed center guide, and a mint marker. It visualizes average force and keeps the text verdict adjacent.

## Components

### Buttons

Standard game buttons are clear, solid, and touchable. Primary is mint with slate text; secondary uses Control Secondary with off-white text; quiet is transparent with a visible Control Border stroke. All have a minimum height of 48px and the frontmatter’s button padding. Hover brightens enabled buttons; disabled controls use opacity 0.45. Game focus is a 3px mint outline with 4px offset. The slide controls retain their incumbent smaller scale and 2px outline.

### Choices

Group choices are labelled radio tiles with member counts. Selected groups use a mint border and Group Selected fill. Human/AI choices pair an icon, side name, and explicit selection label; selected fills and borders follow the side. Selected, disabled, and unselected states have distinct treatments.

### Cards / Containers

Waiting notes are simple Game Panel blocks with note corners and centered status text. Presentation glass cards retain their spatial-card corners, fine translucent border, ambient shadow, and final inner padding of 24px 28px; compact cards use 18px 24px. Photo cards keep their own image/provenance layout.

### Inputs / Fields

Fields use the Field fill, Control Border stroke, control corners, mint caret, and a minimum height of 48px. Labels stay visible above them; helper and error text sits in document flow. Native select behavior is retained.

### Navigation

The game header anchors the HUMAN vs AI brand and gives room, role, API status, and Realtime status separate textual positions. On narrow screens status wraps within the right-hand area. The presentation uses chapter/cue markers and its existing floating control strip; it does not share the game header layout.

### Pull and accepted total

The live pull control is a full-width side-colored action with a minimum height of 210px. It responds with a brief scale to 0.97 on active press. The timer precedes it; the server-accepted tap/score total follows it. Pending input is separately labelled. The game respects reduced motion by removing transitions and animation; the presentation retains its existing authored motion policy.

**The State Before Decoration Rule.** In the game, selected, locked, accepted, pending, paused, cancelled, and confirmed states must remain readable in text.

## Do's and Don'ts

### Do:

- **Do** preserve the established side colors and show Human/AI names with them.
- **Do** use the local IBM Plex Sans Thai files and their supplied 400/500/600/700 weights.
- **Do** retain the game’s 16px body role, 30px Player title, 64px live pull label, and 48px minimum button/field height.
- **Do** use tabular numerals for timers, accepted totals, room codes, and scores.
- **Do** keep slide camera/glass behavior and responsive game behavior scoped to their own surfaces.

### Don't:

- **Don't** substitute a different visual identity or remote font for the incumbent system.
- **Don't** make color the sole way to communicate a selected side or a game state.
- **Don't** turn pending taps into confirmed score text or remove the roster denominator from group results.
- **Don't** promote the minimum Host implementation into a final layout claim.
- **Don't** describe the local rehearsal evidence as a cloud deployment or production release.
