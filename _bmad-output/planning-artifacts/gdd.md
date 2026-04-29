---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
inputDocuments:
  - '_bmad-output/planning-artifacts/game-brief.md'
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/brainstorming-session-2026-04-24.md'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 1
  projectDocs: 0
workflowType: 'gdd'
lastStep: 14
project_name: 'skribbl'
user_name: 'Femil'
date: '2026-04-29'
game_type: 'Party / Social (Online Draw-and-Guess)'
game_name: 'Skribbl'
status: 'complete'
needs_narrative: false
primary_platforms:
  - Web (desktop browsers)
---

# Skribbl — Game Design Document

**Author:** Femil  
**Game Type:** Party / Social (Online Draw-and-Guess)  
**Target Platform(s):** Web — Chrome, Firefox, Safari, Edge (latest)

---

## Executive Summary

### Core Concept

Skribbl is a browser-based, real-time multiplayer party game: one player draws a secret word on a shared canvas while everyone else races to guess it in live chat. Turns rotate so each player draws once per match; scoring rewards fast guesses and successful drawing. No accounts or installs — nickname, avatar, link, play.

### Target Audience

- **Primary:** Recruiters, hiring managers, senior engineers evaluating portfolio quality (code architecture, WebSockets, Canvas).
- **Secondary:** Casual players and friends wanting a quick social session (roughly 10–20 minutes).

### Unique Selling Points (USPs)

- **Technical showcase:** Production-grade client–server design, batched WebSocket stroke sync, resilient reconnect.
- **Feel-first polish:** Timer urgency, guess feedback, smooth strokes (Growth scope where noted).
- **Zero-friction access:** Shareable room link/code, ephemeral identity — optimized for demos and reviews.

---

## Goals and Context

### Project Goals

- Deliver a **playable, portfolio-grade** draw-and-guess experience that satisfies MVP scope in the PRD (FR1–FR27).
- Prove **real-time multiplayer** competence (latency, room isolation, state recovery).
- Keep **scope disciplined**: core loop first; Growth features only after MVP stability.

### Background and Rationale

Genre is proven (Skribbl.io-style experiences). This project is **not** chasing novelty of mechanic — it demonstrates execution quality, architecture, and game feel. Pillars from the brief: **Real-Time Sync → Social Fun → Clean Architecture** when trade-offs collide.

---

## Core Gameplay

### Game Pillars

1. **Real-Time Sync** — Drawing and chat must feel instantaneous (<100ms stroke replication target under normal conditions).
2. **Social Fun** — Mechanics serve laughter, competition, and readability of turns/scores.
3. **Clean Architecture** — Systems remain understandable and reviewable; patterns scale to portfolio scrutiny.

### Core Gameplay Loop

1. Host creates room → share link/code.
2. Players join lobby → set name/avatar → host starts (minimum 2 players).
3. **Per round:** Assign drawer (round-robin) → drawer picks **one of three** words → draw phase (**80s** timer, auto-skip if time expires) → progressive **letter hints** → guessers type in chat → correct guess detected → points for guesser and drawer → reveal/next round.
4. After all rounds: **end-game scoreboard** → optional play again (implementation choice).

### Win/Loss Conditions

- **Match outcome:** Highest total score after the configured number of rounds wins (everyone draws once per full rotation; exact round count follows PRD/host rules).
- **Per-round:** No elimination — all guessers remain in play; drawer rotates each round.
- **Loss states:** None at player level — casual party scoring only (no permadeath or knockout for MVP).

---

## Game Mechanics

### Primary Mechanics

| Mechanic | Description | Notes |
|----------|-------------|--------|
| **Room / lobby** | Create/join via link or code; real-time player list | FR1–FR4 |
| **Word choice** | Drawer selects 1 of 3 random words | Implicit difficulty choice |
| **Drawing** | Freehand strokes; colors, sizes, eraser, fill, clear canvas | FR12–FR18 |
| **Guessing** | Chat-based; exact match detection; hide spoiler word | FR19–FR23 |
| **Hints** | Letters revealed over time | Reduces stalemates |
| **Scoring** | Speed-based for guessers; drawer rewarded when others guess | FR10, FR22 |
| **Resilience** | Reconnect preserves identity/score; hydrate canvas + chat | FR25–FR27 |

### Controls and Input

- **Drawer:** Mouse or touch — pointer down/move/up mapped to canvas coordinates (with scaling for viewport — PRD responsive rules).
- **Guessers:** Keyboard for chat; optional touch keyboards on mobile layout.
- **Tools:** Palette + brush size + eraser + fill + clear — must remain responsive at **60 FPS** drawing target on modern hardware.

---

## Party-Game Mode Structure (Online)

Skribbl uses a **single core mode** (not a minigame anthology).

### Minigame variety

- **Launch:** One mode — classic draw-and-guess with rotating drawers.
- **Future:** Additional modes or word packs are **out of scope** for MVP (see § Out of Scope).

### Turn structure

- **Order:** Fixed rotation — each active player becomes drawer exactly once per “cycle”; repeat for N rounds as configured.
- **Turn actions:** Choose word → draw → guesses resolve until correct or timer end → score → transition.
- **Match length:** Driven by player count × rounds (short sessions ~5–15 minutes typical).

### Scoring vs elimination

- **Points-only:** Everyone plays through the full match.
- **Comeback:** Later rounds can still swing totals — no elimination.

### Remote multiplayer UX (adapted from couch principles)

- **Shared canvas:** One canvas state visible to all guessers; drawer owns input during draw phase.
- **Turn clarity:** Clear UI for current drawer, remaining time, and phase (choosing word vs drawing).
- **Join/drop:** Disconnect shows muted state; reconnect restores via FR25–FR27.
- **Spectators:** Not MVP (optional future).

### Accessibility and skill range

- **Low floor:** Guess by typing; drawing tools are obvious.
- **Ceiling:** Speed scoring + hint timing rewards skilled guessers; drawer skill affects readability.
- **Color:** Palette should avoid relying solely on red/green distinction for critical feedback where feasible (stretch).

### Session length

- **Target:** Quick sessions — roughly **5–15 minutes** for a typical friend match.
- **Drop-in:** Late join behavior defined server-side — MVP may restrict joins to lobby phase only (align with implementation).

---

## Progression and Balance

### Player progression

- **Within session:** Score accumulation only — no metagrowth or unlocks in MVP.

### Difficulty curve

- **Word tiers:** Three-option choice mixes difficulties; randomness varies skill demand round to round.
- **Timer pressure:** Fixed **80s** — creates consistent tension.

### Economy and resources

- None — no currency, items, or crafting.

---

## Level Design Framework

Not applicable as discrete levels. **Session structure** replaces level progression:

| “Level type” | Meaning |
|--------------|---------|
| **Lobby** | Pre-start gathering |
| **Drawing round** | One word, one drawer, one canvas |
| **Interstitial** | Score popup / round banner |
| **Finale** | End-game scoreboard |

---

## Art and Audio Direction

### Art style

- **Portfolio-forward:** Clean, modern UI (Tailwind/DaisyUI-style discipline per stack); readable typography; avatars can be generated/simple glyphs — **no purchased asset dependency**.
- **Canvas:** Stroke rendering prioritizes clarity and smooth motion over painterly effects.

### Audio and music

- **MVP:** Optional / none — sound listed as Vision/deferred in brainstorming.
- **Growth:** SFX for correct guess, tick/tock — post-MVP.

---

## Technical Specifications

Aligned with PRD § Web Game + § Non-Functional.

### Performance requirements

- Stroke broadcast **<100ms** typical to peers.
- Canvas rendering **~60 FPS** for local drawing and incoming strokes.
- Batch stroke payloads (**~50ms** cadence suggested) to limit bandwidth.
- **TTI** target **<1.5s** on typical broadband.

### Platform-specific details

- **SPA** in modern browsers; WebSocket required.
- **Failure UX:** Clear message if WebSocket blocked (firewall/VPN).
- **Responsive layout:** Desktop-first; mobile viewport scaling with coordinate mapping for canvas.

### Asset requirements

- Minimal static assets; emoji/CSS/SVG acceptable.
- Word lists: bundled data (locale single-language for MVP unless scope expands).

---

## Development Epics (high level)

Suggested breakdown for downstream **`gds-create-epics-and-stories`** / sprint planning:

| Epic | Scope |
|------|--------|
| **E1 — Real-time foundation** | WebSocket server, room lifecycle, identity tokens |
| **E2 — Lobby & match flow** | Create/join, start game, player roster |
| **E3 — Drawing & sync** | Canvas tools, batched strokes, late-join hydrate |
| **E4 — Chat & guessing** | Chat pipe, word match, spoiler rules, hints |
| **E5 — Scoring & rounds** | Timer, rotation, scoreboard |
| **E6 — Portfolio shell** | Footer/source link, error boundaries, basic SEO |

---

## Success Metrics

### Technical metrics

- Latency, FPS, and payload efficiency targets as in PRD (NFR-P1–P3).
- Room capacity **≤8** players stable per room; **~100** rooms on modest single-instance target (NFR-S2).

### Gameplay metrics

- Session completable without softlocks; reconnect success in typical drop scenarios (qualitative + manual testing).

---

## Out of Scope

- Accounts, persistent profiles, cross-session leaderboards.
- Custom word lists, moderation tooling beyond host norms (vision-phase).
- Spectator-only mode, replay export, advanced particles.
- Native apps, console, VR.
- Full multilingual UI/content (single language MVP unless explicitly expanded).

---

## Assumptions and Dependencies

- **Solo dev** capacity; stack aligns with brief (e.g. Node + React/Next ecosystem — exact choices belong in architecture phase).
- **Hosting** may use cold-start/free tiers — design avoids reliance on always-on DB for MVP.
- **Legal:** Users generate drawings/chat — host-led moderation minimal for portfolio; broader compliance beyond ephemeral-session model is future work.

---

## Document status & next steps (GDS pipeline)

| Artifact | Status |
|----------|--------|
| GDD | **Complete** (this document) |

**Recommended next workflows:**

1. **`gds-create-ux-design`** — HUD, lobby, canvas toolbar, chat, scoreboard UX specs (recommended — UI-heavy game).
2. **`gds-game-architecture`** — Engine-agnostic technical architecture, networking, state ownership.
3. **`gds-create-epics-and-stories`** — Detailed stories from GDD + PRD traceability.
4. **`gds-sprint-planning`** — Ordered implementation sequence.

**Narrative workflow (`gds-create-narrative`):** Not required (`needs_narrative: false`) — no story-driven campaign.
