---
stepsCompleted:
  - step-01-requirements-extracted
  - step-02-epics-approved
  - step-03-stories-generated
  - step-04-validated
  - step-01-epic8-requirements-extracted
  - step-02-epic8-approved
  - step-03-epic8-stories-generated
  - step-04-epic8-validated
workflow_status: complete
inputDocuments:
  - '_bmad-output/planning-artifacts/gdd.md'
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/game-architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
document_output_language: English
---

# skribbl - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for skribbl, decomposing the requirements from the GDD, UX Design if it exists, and Architecture requirements into implementable stories.

**Traceability note:** Functional requirements FR1–FR27 are enumerated in the PRD; the GDD aligns MVP scope to those IDs.

## Requirements Inventory

### Functional Requirements

```
FR1: A player can create a new private room and receive a shareable link/code.
FR2: A player can join a room via a shareable link or code.
FR3: A player can enter a display name and choose an avatar before joining.
FR4: The host can start the game when at least 2 players are in the room.
FR5: The system automatically assigns the "Drawer" role to players in a round-robin format.
FR6: The current Drawer can select one word from a choice of 3 randomized words.
FR7: The system enforces an 80-second timer per drawing round.
FR8: The system automatically skips the turn if the timer expires before all players guess correctly.
FR9: The system reveals partial letter hints to guessers over time.
FR10: The system tracks and calculates scores based on how quickly a player guessed the word.
FR11: The system displays a final scoreboard at the end of all rounds.
FR12: The Drawer can draw freehand strokes on the canvas.
FR13: The Drawer can select different stroke colors.
FR14: The Drawer can select different stroke thicknesses.
FR15: The Drawer can use an eraser tool to remove strokes.
FR16: The Drawer can use a fill tool to color enclosed areas.
FR17: The Drawer can clear the entire canvas with a single action.
FR18: The system broadcasts drawing strokes to all guessers in real time.
FR19: Players can send text messages to a real-time room chat.
FR20: The system detects if a chat message exactly matches the target word.
FR21: The system prevents the exact word guess from being broadcasted to players who haven't guessed it.
FR22: The system awards points to the guesser and the Drawer when a correct guess is made.
FR23: The system notifies all players in the chat when a player successfully guesses the word.
FR24: (Growth) The system identifies close guesses and provides a "You're close!" feedback message privately to the guesser.
FR25: A player can reconnect to an active game session without losing their score or identity.
FR26: The system transmits the current canvas state and chat history to a reconnecting player.
FR27: The system marks disconnected players in the UI to notify active players.
```

### NonFunctional Requirements

```
NFR-P1 (WebSocket Latency): Drawing strokes must be broadcasted to all connected room peers within 100 milliseconds under normal network conditions.
NFR-P2 (Rendering Framerate): The HTML5 Canvas must render incoming and outgoing strokes at a consistent 60 frames per second on modern hardware to prevent visual stuttering.
NFR-P3 (Payload Efficiency): Coordinate data for strokes must be batched (e.g., sending an array of points every 50ms instead of firing an event per pixel) to prevent network congestion.
NFR-S1 (Room Capacity): The server must reliably handle at least 8 active connections per room without measurable degradation in broadcast latency.
NFR-S2 (Concurrency): The backend architecture must be capable of supporting 100 concurrent rooms on a standard single-core server instance.
NFR-SEC1 (Room Isolation): A player cannot join or observe a private room without the exact, randomly generated connection code/link.
NFR-SEC2 (Input Sanitization): All chat inputs and player names must be aggressively sanitized to prevent XSS attacks when rendered in the UI.
NFR-U1 (Cross-Device Input): The drawing canvas must accurately map both standard mouse events and touch events to support desktop and mobile devices.
NFR-O1 (Observable failures): WebSocket connection failures and room join errors must surface clear, user-facing messages without exposing internal stack traces.
NFR-O2 (Debuggability): Server-side logging must be sufficient to diagnose room/state issues during development and demo without persistent production-grade observability being a blocker for MVP.
```

### Additional Requirements

```
- Repository layout: pnpm workspaces monorepo with packages named @skribbl/web (apps/web), @skribbl/server (apps/server), @skribbl/shared (packages/shared); canonical pnpm-workspace.yaml (apps/*, packages/*); root package.json private: true.
- Stack: Next.js 16 App Router + React 19 + TypeScript + Tailwind + DaisyUI on web; Node 24 WebSocket server; HTML5 Canvas 2D for drawing.
- Wire protocol: All client ↔ server messages defined only in @skribbl/shared as Zod schemas and exported TypeScript types; apps must not duplicate protocol definitions.
- Transport: ws library (not Socket.io); parse inbound JSON with shared Zod schemas; invalid messages yield structured error events — never throw across WS boundaries without client-visible handling.
- Authority: Server-authoritative match state, chat adjudication, canvas operation ordering; explicit match state machine (plain TS); timers server-owned.
- Canvas sync: Ordered op log (stroke batches, clear, fill) with monotonic sequence; late join / reconnect via snapshot + replay; client ~50ms batching + flush on stroke end/tab hide; server rejects strokes when actor is not drawer or phase wrong.
- Identity & rooms: Room code in URL; server-issued session token or player id on join for reconnect validation; nickname + avatar session fields — no accounts MVP.
- Word list: data/words.json at repository root only; @skribbl/server loads via WORDS_PATH (absolute or relative to cwd); document default in server README.
- Persistence: MVP ephemeral in-memory rooms — no MongoDB/ORM unless requirements change.
- Deployment: Primary pattern single host, two processes behind reverse proxy (Next HTTP + WSS game port); alternate split cloud (e.g. Next + Railway/Fly WS); NEXT_PUBLIC_WS_URL on web; not in scope: single OS process merging Next + WS.
- Error UX: Result/discriminated unions on server; structured recoverable vs fatal handling; React error boundary around game shell with copy for WebSocket blocked / server down.
- Logging: Structured JSON on server (pino recommended); levels per architecture; client logging gated (e.g. localStorage.DEBUG or dev).
- Configuration: Per-package env vars; gameplay constants in apps/server/src/config/game.ts as read-only imports; MAX_PLAYERS, ROUND_MS, etc.
- Events: Typed dispatcher server-side; single WebSocket listener client-side demuxing to reducer/callbacks; naming conventions per architecture (shared exports).
- Observability: /healthz on server; optional ?debug=1 for verbose client logging and latency overlay (dev only); activation no-op in production.
- Testing: Vitest in @skribbl/server (+ shared pure tests); Playwright E2E from root or @skribbl/web.
- CI/tasks: pnpm install at root; typecheck (pnpm -r exec tsc --noEmit or per-package); lint; test; Docker multi-stage builds optional.
- Bootstrap / Epic 1 Story 1 relevance: Greenfield bootstrap sequence creates shared package first, then Next app with workspace dependency, then WS server — aligns architecture “First steps” ordering.
- Browser matrix: SPA; WebSocket required; graceful failure UX when WS blocked (firewall/VPN) per GDD/PRD.
- REST: Optional health checks only; game loop WS-only.
```

### UX Design Requirements

```
UX-DR1: Extend Tailwind/DaisyUI with theme tokens (CSS variables / tailwind.config): dark shell tiers (base-100/base-200), cyan accent system (Direction 5), timer semantic progression (healthy → urgent → critical), success/warning/error semantic colors — tokenized stops, not per-screen hex.
UX-DR2: Implement Direction 1 desktop layout — canvas left (majority width), chat column right; below minimum breakpoint stack chat under canvas while guarding minimum readable canvas width and independent chat scroll.
UX-DR3: Implement DrawingCanvas — wrapper + Canvas 2D; ResizeObserver/coordinate mapping from CSS size to backing store; states blank/drawing/read-only/syncing overlay; role="img" + descriptive aria-label; non-drawers pointer-events none where appropriate.
UX-DR4: Implement DrawingToolbar — colors, brush sizes, eraser, fill, clear; shown only when role is drawer and phase is drawing; aria-pressed on tools; clear treated as destructive-adjacent with confirmation if exposed as destructive.
UX-DR5: Implement PhaseBar — phase label, current drawer identity, optional round index, timer chip using timer tokens; polite live region for phase transitions; tabular numerals for timer/scores where possible.
UX-DR6: Implement WordChoicePanel — drawer-only UI for choosing exactly one of three words (cards or large buttons); loading/error retry states; Esc does not violate server rules for cancellation.
UX-DR7: Implement ChatPanel — scrollable message list distinguishing player vs system vs hint rows; fixed composer labeled for guesses; disconnected state disables composer and pairs with ConnectionBanner; optional rate-limit UI.
UX-DR8: Implement PlayerRoster — live roster in lobby and compact match strip; avatar, name, score, host badge; connection/disconnected indicators not color-only; highlight current drawer.
UX-DR9: Implement ConnectionBanner — states reconnecting, WebSocket blocked, server unreachable/fatal; differentiated copy for network drop vs server restart vs firewall/VPN; role="alert" for blocking failures; recovery affordances (retry/reload).
UX-DR10: Implement ScoreboardSummary — ordered results, winner emphasis, tie copy if needed, Play again entry point aligned with host rules.
UX-DR11: Apply Feedback Patterns — non-blocking toast for actions like link copied; correct-guess feedback noticeable without obscuring canvas/toolbar; global reconnect/sync states use aria-live where appropriate.
UX-DR12: Apply Form Patterns — nickname/code validation with visible labels and aria-describedby on errors; paste-friendly single room-code field with normalized casing handling per join errors.
UX-DR13: Meet accessibility targets for chrome — WCAG 2.2 AA-oriented contrast on UI text; critical states pair color + icon + label; full keyboard path through lobby, word choice, chat composer, modals (canvas drawing remains pointer-primary for MVP with documented limitation).
UX-DR14: Honor prefers-reduced-motion for celebration and strong motion paths — shorten or substitute animations.
UX-DR15: Add stable data-testid hooks on PhaseBar, canvas region, and chat composer for Playwright/E2E.
UX-DR16: Use semantic landmarks — header, main, complementary aside for chat; optional skip link to composer; consistent feedback/error aria patterns per UX spec tables.
UX-DR17: Implement responsive breakpoints using Tailwind lg/md/sm — smoke resize at boundaries; verify canvas coordinate mapping does not skew strokes across viewports.
UX-DR18: Differentiate chat row types (player / system / hint) with consistent typography and system prefix text per UX consistency patterns for scannability.
```

### FR Coverage Map

| FR | Epic | Coverage note |
|----|------|----------------|
| FR1 | Epic 1 | Create room + shareable link/code |
| FR2 | Epic 1 | Join via link/code |
| FR3 | Epic 1 | Nickname + avatar |
| FR4 | Epic 1 | Host starts at ≥2 players |
| FR5 | Epic 2 | Round-robin drawer |
| FR6 | Epic 2 | Three-word choice |
| FR7 | Epic 2 | 80s timer |
| FR8 | Epic 2 | Auto-advance / skip when timer ends |
| FR9 | Epic 2 | Progressive hints |
| FR10 | Epic 2 | Score calculation rules |
| FR11 | Epic 2 | Final scoreboard |
| FR12 | Epic 3 | Freehand strokes |
| FR13 | Epic 3 | Stroke colors |
| FR14 | Epic 3 | Stroke thickness |
| FR15 | Epic 3 | Eraser |
| FR16 | Epic 3 | Fill |
| FR17 | Epic 3 | Clear canvas |
| FR18 | Epic 3 | Realtime stroke broadcast |
| FR19 | Epic 4 | Room chat |
| FR20 | Epic 4 | Exact word match |
| FR21 | Epic 4 | Spoiler-safe reveal rules |
| FR22 | Epic 4 | Points to guesser + drawer |
| FR23 | Epic 4 | Correct-guess visibility for room |
| FR24 | Epic 7 (Growth) | Close-guess hint — deferred |
| FR25 | Epic 5 | Reconnect preserve identity/score |
| FR26 | Epic 5 | Hydrate canvas + chat tail |
| FR27 | Epic 5 | Disconnected roster indicators |

**NFR / UX rollup:** Performance targets (NFR-P*) attach primarily to Epic 3 stories; scalability NFR-S* enforced server-side across Epic 1–2 capacity limits; SEC/O/U/O₂ addressed in Epics 1, 4–6 as noted per story.

## Epic List

### Epic 1: Party lobby & shareable rooms

Players can spin up a private room or join one with a link/code, choose nickname and avatar, see who is present, and start when enough friends arrive — backed by the monorepo bootstrap and canonical wire protocol.

**FRs covered:** FR1, FR2, FR3, FR4

### Epic 2: Match rhythm — turns, timer, words & standings

Players experience rotating drawers, timed rounds, word choices from bundled lists, hints, scoring momentum, and a clear end-game podium.

**FRs covered:** FR5, FR6, FR7, FR8, FR9, FR10, FR11

### Epic 3: Drawing pipeline & synced strokes

The drawer sketches with full tools while everyone else sees smooth, authoritative strokes within latency and FPS budgets.

**FRs covered:** FR12, FR13, FR14, FR15, FR16, FR17, FR18

### Epic 4: Chat guesses & secrecy

Guessers race in chat; the server adjudicates matches fairly without spoiling answers for players still guessing.

**FRs covered:** FR19, FR20, FR21, FR22, FR23

### Epic 5: Session resilience & recovery

Dropped connections recover gracefully — identity and scores persist and the canvas/chat tail hydrate without confusing everyone else.

**FRs covered:** FR25, FR26, FR27

### Epic 6: Portfolio shell & UX polish pass

Reviewers see a cohesive themed shell, trustworthy failures, repo/source cues, accessibility/responsive hygiene, and hooks for demos and tests.

**FRs covered:** (cross-cutting PRD/NFR-O*, UX-DR coverage — see stories)

### Epic 7 (Growth backlog): Near-miss guess whisper

Optional post-MVP polish — FR24 only.

**FRs covered:** FR24

---

## Epic 1: Party lobby & shareable rooms

Players can spin up a private room or join one with a link/code, choose nickname and avatar, see who is present, and start when enough friends arrive — backed by the monorepo bootstrap and canonical wire protocol.

### Story 1.1: Scaffold monorepo & shared protocol package

As a developer building Skribbl,
I want the pnpm workspace, `@skribbl/shared` Zod wire schemas, `@skribbl/web` Next shell, and `@skribbl/server` WS entry wired per architecture,
So that every later story shares one canonical protocol and build pipeline.

**Acceptance Criteria:**

**Given** a fresh repo root  
**When** the bootstrap sequence from game-architecture runs (`pnpm-workspace.yaml`, `private: true`, workspace deps `workspace:*`)  
**Then** `pnpm install` succeeds and each package exposes TypeScript builds aligned with documented folder layout  
**And** `@skribbl/shared` exports initial message schemas without duplication in apps.

### Story 1.2: Authoritative rooms & secure codes on the server

As a player creating or joining a session,
I want server-backed rooms with non-guessable codes,
So that strangers cannot wander into my lobby (NFR-SEC1).

**Acceptance Criteria:**

**Given** the WS server running with room aggregate skeleton  
**When** `createRoom` / `joinRoom` commands validate payloads via `@skribbl/shared`  
**Then** rooms receive unique codes and invalid codes yield structured recoverable errors without stack traces (NFR-O1)  
**And** caps honor configured `MAX_PLAYERS` toward NFR-S1.

### Story 1.3: Create-flow UX — shareable link & copy feedback

As a host,
I want a visible invite URL/code I can copy with confirmation,
So that friends join quickly (FR1, UX-DR11 partial).

**Acceptance Criteria:**

**Given** a connected client after successful room creation  
**When** the host opens the lobby screen  
**Then** shareable URL/code displays with Copy action and accessible success toast/feedback  
**And** failures surface inline copy per NFR-O1.

### Story 1.4: Join-flow UX — paste-friendly code entry

As a guest,
I want to paste or type a room code with validation feedback,
So that mistyped invites recover gracefully (FR2, UX-DR12).

**Acceptance Criteria:**

**Given** join UI  
**When** code casing/normalization mismatches occur  
**Then** inline errors explain invalid/full/wrong-phase reasons without blaming the player  
**And** successful joins transition to lobby roster loading state.

**Given** a player attempts to join via link or code  
**When** the room is in match-active phase (game already started)  
**Then** the server returns a structured error and the UI displays "Game already in progress" — join is blocked without exposing internal state.

### Story 1.5: Lobby identity — nickname & avatar presets

As a participant,
I want to pick a display name and avatar glyph before entering play,
So that everyone recognizes me without accounts (FR3, NFR-SEC2).

**Acceptance Criteria:**

**Given** join forms  
**When** nickname/avatar submitted  
**Then** inputs sanitize/strip unsafe markup server-side before broadcast (NFR-SEC2)  
**And** validation messages tie to fields via labels/`aria-describedby` (UX-DR12).

### Story 1.6: Live roster, host badge & start gate

As a host with friends ready,
I want a live roster showing presence and the ability to start only when rules allow,
So that sessions kick off fairly (FR4, UX-DR8 lobby slice).

**Acceptance Criteria:**

**Given** ≥2 sanitized players connected  
**When** host presses Start  
**Then** server transitions lobby→match-start-capable state per rules (≥2 players)  
**And** roster lists host badge and updates live without refresh.

### Story 1.7: Connection trust banner during lobby states

As any participant,
I want clear realtime connection status while waiting,
So that I know whether to retry networking fixes (UX-DR9 partial, NFR-O1).

**Acceptance Criteria:**

**Given** WS handshake lifecycle  
**When** reconnecting/blocked/down occurs  
**Then** ConnectionBanner variants render differentiated copy + recovery affordances  
**And** blocking failures expose `role="alert"` semantics.

---

## Epic 2: Match rhythm — turns, timer, words & standings

Players experience rotating drawers, timed rounds, word choices from bundled lists, hints, scoring momentum, and a clear end-game podium.

### Story 2.1: Match state machine skeleton & server timers

As players entering rounds,
I want server-owned phases and timers,
So that nobody manipulates phase transitions locally (Additional reqs authority).

**Acceptance Criteria:**

**Given** lobby completed start handshake  
**When** server advances phases (`choosing-word`, `drawing`, `round-result`, etc.)  
**Then** transitions only originate server-side with typed broadcasts  
**And** gameplay constants (`ROUND_MS`, etc.) load read-only from `config/game.ts`  
**And** connected clients receive the typed phase-transition broadcast and can render the current phase label without additional round-trips.

### Story 2.2: Round-robin drawer rotation

As participants,
I want predictable drawer rotation each round,
So that everyone sketches fairly across the match (FR5, UX-DR8 drawer highlight).

**Acceptance Criteria:**

**Given** active match state  
**When** rounds advance  
**Then** drawer assignment follows deterministic round-robin among connected eligible players  
**And** PhaseBar exposes current drawer identity.

### Story 2.3: Word bank loading & drawer WordChoicePanel

As the drawer,
I want three curated choices pulled from bundled words data,
So that every round feels fresh but fair (FR6, Additional reqs `data/words.json`, UX-DR6).

**Acceptance Criteria:**

**Given** `WORDS_PATH`/`data/words.json` available to server startup  
**When** word-pick phase begins  
**Then** server offers three distinct options to drawer client with Zod-validated payloads  
**And** selection ack locks choice before drawing starts.

### Story 2.4: Drawing phase countdown & timer-driven round end

As everyone in a round,
I want an 80s countdown with authoritative expiry,
So that rounds do not stall (FR7, FR8, UX-DR5 timer tokens).

**Acceptance Criteria:**

**Given** drawing phase active  
**When** timer elapses without full guess completion per rules  
**Then** server auto-advances per FR8 without client override  
**And** timer display uses semantic gradient tokens (healthy→critical).

### Story 2.5: Progressive letter hints cadence

As a guesser,
I want hints revealed on a fixed cadence,
So stalemates shrink (FR9, UX-DR18 hint rows).

**Acceptance Criteria:**

**Given** drawing phase  
**When** hint ticks fire server-side  
**Then** hint lines appear as system rows distinct from chat noise  
**And** timing is reproducible across clients.

### Story 2.6a: Score formula & pure scoring logic

As players,
I want scores to reflect guess speed and drawer assists,
So that competition feels fair (FR10).

**Acceptance Criteria:**

**Given** a scoring function invoked with guess timestamp, round-start timestamp, and drawer identity  
**When** scoring runs server-side  
**Then** guesser points decrease with latency from round start per agreed formula  
**And** drawer receives defined assist points per defined rules  
**And** the scoring function is unit-testable with mock inputs — no dependency on live chat pipeline required.

### Story 2.7: Match-end ScoreboardSummary

As players finishing the scheduled rounds,
I want an ordered leaderboard with winner/tie messaging,
So that the session resolves socially (FR11, UX-DR10).

**Acceptance Criteria:**

**Given** final round completes  
**When** scoreboard view opens  
**Then** rankings, winner emphasis, tie copy, optional Play again entry surface per UX spec  
**And** layout works on desktop-first responsive shell.

---

## Epic 3: Drawing pipeline & synced strokes

The drawer sketches with full tools while everyone else sees smooth, authoritative strokes within latency and FPS budgets.

### Story 3.1: Direction 1 match shell — canvas column + chat column scaffold

As players in-match,
I want the genre-standard split layout ready for tools/chat integration,
So reviewers instantly grok structure (UX-DR2).

**Acceptance Criteria:**

**Given** match route/layout component  
**When** viewport crosses `lg`/`md`/`sm` breakpoints  
**Then** chat stacks beneath canvas without collapsing canvas below minimum usable width  
**And** landmarks reserve regions for PhaseBar/Canvas/Chat (`header`, `main`, `aside`).

### Story 3.2: DrawingCanvas controller — mapping & sizing

As the drawer,
I want accurate pointer mapping across DPI/layout changes,
So strokes land where I aim (UX-DR3, NFR-U1, NFR-P2).

**Acceptance Criteria:**

**Given** canvas wrapper wired with ResizeObserver  
**When** CSS pixel dimensions change  
**Then** backing store coordinates remap without drift across browsers tested (Chrome/Safari minimum)  
**And** canvas exposes `role="img"` plus descriptive label.

### Story 3.3: Local stroke capture & batched upstream payloads

As the drawer,
I want fluid drawing while respecting batched WS payloads,
So bandwidth stays sane (FR12 partial client path, FR18 partial, NFR-P3).

**Acceptance Criteria:**

**Given** pointer capture during drawing phase  
**When** stroke batches flush (~50ms + stroke-end/tab-hide rules)  
**Then** payloads conform to `@skribbl/shared` schemas  
**And** local preview renders immediately while awaiting seq ack.

### Story 3.4: Server sequencing & fan-out — stroke batches live

As guessers,
I want everyone to see ordered strokes quickly,
So play feels simultaneous (FR18, NFR-P1).

**Acceptance Criteria:**

**Given** incoming validated batches  
**When** server assigns monotonic seq + broadcasts  
**Then** peers render remote strokes ≤100ms typical LAN conditions  
**And** reject batches when sender not drawer or wrong phase.

### Story 3.5: Palette & brush sizing toolbar

As the drawer,
I want obvious color/thickness controls when allowed,
So drawing stays expressive (FR13, FR14, UX-DR4 partial).

**Acceptance Criteria:**

**Given** drawer role during drawing phase  
**When** selecting colors/sizes  
**Then** toolbar controls expose `aria-pressed` states and hide/disable otherwise  
**And** selections persist until changed across rounds until cleared per rules.

### Story 3.6: Eraser, fill & clear semantics via op log

As the drawer,
I want destructive ops replicated consistently,
So viewers stay synced through complex edits (FR15–FR17, Additional reqs canvas operations).

**Acceptance Criteria:**

**Given** eraser/fill/clear commands  
**When** issued with server validation  
**Then** each command appends ordered canvas operations (not just vector strokes)  
**And** clear requires destructive confirmation UX if surfaced as destructive (UX-DR4).

---

## Epic 4: Chat guesses & secrecy

Guessers race in chat; the server adjudicates matches fairly without spoiling answers for players still guessing.

### Story 4.1: ChatPanel composer & realtime history

As guessers,
I want a scrollable transcript with labeled composer affordances,
So guessing stays fast (FR19, UX-DR7).

**Acceptance Criteria:**

**Given** match chat UI  
**When** messages arrive  
**Then** player rows vs system rows visually differ per UX patterns  
**And** composer remains keyboard reachable with documented canvas limitation elsewhere (UX-DR13 partial).

### Story 4.2: Guess adjudication — exact match & spoiler-safe broadcasts

As participants,
I want correct guesses detected centrally without leaking secrets,
So fairness holds (FR20, FR21).

**Acceptance Criteria:**

**Given** chat ingress pipeline server-side normalization  
**When** normalized text equals secret word  
**Then** guessers who already guessed see plaintext reveal rules honored  
**And** players still guessing receive censored/obfuscated variants per FR21 policies.

### Story 4.3: ~~Score awards & drawer bonuses wiring~~ → merged into Story 2.6b

> **Note:** This story has been merged into **Story 2.6b** (added to Epic 4) to fix a forward dependency identified during implementation readiness review. Story 2.6b covers live guess event → scoring function wiring with full ACs. Implement Story 2.6b in place of this story.

### Story 2.6b: Wire live guess events to scoring (integration)

As scoring-aware gameplay,
I want correct guess events from the chat pipeline to feed the scoring functions defined in Story 2.6a,
So that live scores update in real time when guesses resolve (FR10, FR22).

**Acceptance Criteria:**

**Given** validated correct guess events from the chat adjudication pipeline (Story 4.2)  
**When** scoring executes using the functions from Story 2.6a  
**Then** guesser + drawer bonuses apply consistently with logged rationale for debugging (NFR-O2)  
**And** scores update roster + PhaseBar totals with tabular numerals (UX-DR5)  
**And** running totals remain consistent with the server-authoritative ledger state within the active session.

### Story 4.4: Correct-guess fan-out messaging & UX beats

As the room,
I want unmistakable announcements when someone nails it,
So celebrations stay readable (FR23, UX-DR11).

**Acceptance Criteria:**

**Given** correct guess resolution  
**When** broadcast emits  
**Then** chat/system rows notify everyone without hiding PhaseBar permanently  
**And** celebrations avoid permanently obscuring PhaseBar/chat affordances; honor reduced-motion preferences when theme hooks are available.

---

## Epic 5: Session resilience & recovery

Dropped connections recover gracefully — identity and scores persist and the canvas/chat tail hydrate without confusing everyone else.

### Story 5.1: Session tokens & reconnect handshake

As a dropped player,
I want to resume with the same nickname/score slot,
So dropouts do not punish my session (FR25).

**Acceptance Criteria:**

**Given** server-issued session token at join  
**When** client reconnect presents token + player id  
**Then** server reattaches identity or fails with clear copy (NFR-O1)  
**And** duplicate tab cases are defined (close vs reject) per architecture edge cases.

### Story 5.2: Snapshot + op replay hydration

As a returning client,
I want up-to-date canvas + chat tail restored,
So I can guess mid-round confidently (FR26).

**Acceptance Criteria:**

**Given** reconnect acceptance  
**When** Hydrate payload arrives  
**Then** canvas replays ops since snapshot seq without gaps  
**And** chat tail replays bounded history consistent with anti-spoiler rules.

### Story 5.3: Presence decay UI — muted roster rows

As active participants,
I want visible disconnected states,
So we know who might return (FR27, UX-DR8 status indicators).

**Acceptance Criteria:**

**Given** disconnect signals  
**When** roster renders  
**Then** statuses pair icons/text—not color-only cues  
**And** ConnectionBanner communicates reconnect attempts distinctly from fatal failures.

---

## Epic 6: Portfolio shell & UX polish pass

Reviewers see a cohesive themed shell, trustworthy failures, repo/source cues, accessibility/responsive hygiene, and hooks for demos and tests.

### Story 6.1: DaisyUI theme tokens — cyan accent & semantics

As any visitor,
I want consistent palette/timer semantics across shells,
So polish reads intentional (UX-DR1).

**Acceptance Criteria:**

**Given** Tailwind/Daisy theme extension  
**When** PhaseBar/timer/chat shells consume tokens  
**Then** no stray hex escapes critical surfaces  
**And** semantic colors documented for contributors.

### Story 6.2: React error boundary & WS-down UX

As any visitor hitting failures,
I want calm messaging instead of blank screens,
So failures feel controlled (Additional reqs error UX, NFR-O1).

**Acceptance Criteria:**

**Given** simulated WS failures/blockages  
**When** boundary catches rendering/network faults  
**Then** friendly guidance surfaces without leaking internals  
**And** reload/retry paths remain obvious.

### Story 6.3: Landing/footer portfolio cues & `/healthz` pairing

As a reviewer,
I want repo/source pointers plus observable server readiness,
So demos feel production-grade (architecture `/healthz`, portfolio narrative).

**Acceptance Criteria:**

**Given** marketing/footer surfaces  
**When** links resolved  
**Then** GitHub/demo destinations accessible  
**And** server exposes `/healthz` logged per structured logging guidance.

### Story 6.4: Accessibility sweep — landmarks, keyboard loops, contrast

As keyboard/VoiceOver users,
I want WCAG-aligned chrome interactions aside from canvas drawing pointer constraint,
So inclusivity baseline holds (UX-DR13, UX-DR16).

**Acceptance Criteria:**

**Given** lobby→match flows  
**When** navigating via keyboard  
**Then** logical tab order reaches composer/forms without traps (except documented canvas pointer requirement)  
**And** axe/Lighthouse smoke issues triaged.

### Story 6.5: Reduced-motion variants, testids & responsive QA

As QA/demo owners,
I want deterministic automation hooks & motion-safe celebrations,
So CI can smoke gameplay shells (UX-DR14, UX-DR15, UX-DR17).

**Acceptance Criteria:**

**Given** manual QA checklist  
**When** toggling `prefers-reduced-motion`  
**Then** celebrations degrade gracefully  
**And** stable `data-testid` hooks exist on PhaseBar/canvas/chat composer with breakpoint resize checklist documented.

---

## Epic 7 (Growth backlog): Near-miss guess whisper — deferred

Optional future enhancement once MVP ships — FR24 only.

### Story 7.1: Close guess proximity feedback (Growth)

As a struggling guesser,
I want subtle private encouragement when nearly correct,
So frustration drops without widening MVP scope (FR24).

**Acceptance Criteria:**

**Given** Growth prioritization approval later  
**When** guessed text distance heuristic fires server-side  
**Then** client receives private toast/message without leaking proximity to others  
**And** metrics tracked optionally.

---

## Workflow validation summary

| Check | Result |
|-------|--------|
| FR1–FR23 & FR25–FR27 mapped to stories | Pass |
| FR24 isolated to Epic 7 Growth | Pass |
| Starter bootstrap aligns Epic 1 Story 1 with architecture sequence | Pass |
| UX-DR1–UX-DR18 addressed across Epics 1–6 | Pass (Growth deferrals noted) |
| Within-epic story order builds only on earlier stories | Pass — review during sprint planning if parallelization needed |
| In-memory MVP — no upfront DB tables | Pass |

---

## Epic 8: Production Lobby — Persistence, Settings & Player Management

Players experience reliable server-backed room state that survives restarts and reloads. The host controls match settings with real-time broadcast to all players. Players can chat before the match starts, vote to remove disruptive players, and reconnect seamlessly after a drop.

**Requirements covered:** BK1–BK10

### Story 8.0: Migrate room manager from in-memory Map to Redis-backed store

As a developer implementing Epic 8,
I want the room manager to use Redis as its backing store instead of an in-memory Map,
So that all subsequent Epic 8 stories have a stable, Redis-backed foundation without duplicating migration logic across stories.

**Acceptance Criteria:**

**Given** the existing in-memory `RoomManager` (from Epics 1–7) uses a `Map<roomCode, Room>` structure  
**When** this story is implemented  
**Then** all room CRUD operations (`createRoom`, `getRoom`, `updateRoom`, `deleteRoom`) are backed by Redis while keeping the same TypeScript API surface — no changes required in existing protocol handlers  
**And** the Redis client abstraction from Story 8.1 is defined here or as a prerequisite; this story may be implemented alongside 8.1 but must land before 8.2–8.5  
**And** existing Vitest unit tests for room lifecycle still pass (with Redis mocked or using a test Redis instance)  
**And** in-memory fallback is removed — Epic 8 explicitly requires persistent storage per BK3.

### Story 8.1: Redis client abstraction + player token identity

As a player,
I want my identity and room membership to persist across page reloads and server restarts,
So that refreshing my browser doesn't kick me out or erase my progress.

**Acceptance Criteria:**

**Given** a player visits the lobby for the first time
**When** no `skribbl_pid` token exists in localStorage
**Then** `POST /api/session` issues a `nanoid(21)` token, returns `{ token, playerId }`, and client stores both in localStorage

**Given** the same player reloads the page
**When** `skribbl_pid` token exists in localStorage
**Then** the existing `{ token, playerId }` is reused — no new session issued

**Given** the Node WS server restarts
**When** a player with a valid token reconnects
**Then** their identity resolves from Redis `player:{token}` hash and room membership is restored

**Given** `REDIS_PROVIDER=upstash` env var is set
**When** the server initializes its Redis client (`apps/server/lib/redis/client.ts`)
**Then** `@upstash/redis` adapter is used; switching to `REDIS_PROVIDER=ioredis` uses `ioredis` adapter with no other code changes

**Given** a room is created
**When** host token is generated (`nanoid(21)`)
**Then** `hostToken` is stored in Redis `room:{roomCode}` hash and returned to creator only — never broadcast to other clients

**Given** a room has no activity for 30 minutes after creation (idle)
**When** Redis TTL check fires
**Then** room keys expire and clean up automatically; active rooms refresh to 2-hour TTL on any player join

### Story 8.2: Lobby settings host broadcast

As a host,
I want changes I make to match settings (rounds, draw time, max players, word pack, hints, AFK skip, voice) to appear instantly for all players in the lobby,
So that everyone sees the same configuration before the game starts.

**Acceptance Criteria:**

**Given** host emits `updateSettings` with a partial settings object
**When** server receives the message
**Then** `UpdateSettingsSchema` (Zod, `@skribbl/shared`) validates the payload — invalid fields rejected with `error { code: "VALIDATION_ERROR" }`

**Given** sender's `playerId !== room.hostId`
**When** `updateSettings` arrives
**Then** server returns `error { code: "NOT_HOST" }` — room state unchanged

**Given** valid host settings update
**When** server merges partial settings into `room.settings` in Redis
**Then** `settingsUpdated` broadcast reaches all connected room members within 100ms
**And** late-joining players receive current `settings` object in their `joinRoom` response

**Given** `startMatch` has already been emitted
**When** host sends `updateSettings`
**Then** server returns `error { code: "MATCH_IN_PROGRESS" }` — settings locked once match starts

**Given** host sets `maxPlayers` below current player count
**When** server validates the settings
**Then** server rejects with `error { code: "VALIDATION_ERROR", detail: "maxPlayers below current count" }`

**Given** `allowVoice` setting is updated
**When** stored and broadcast
**Then** server treats it as a UI flag only — no WebRTC signaling required server-side

### Story 8.3: Pre-game lobby chat relay

As a player waiting in the lobby,
I want to send and receive text messages with other players before the match starts,
So that we can coordinate and socialize while waiting for the host to start the game.

**Acceptance Criteria:**

**Given** a player in lobby phase emits `lobbyChat { roomCode, message }`
**When** server receives the message
**Then** `LobbyChatSchema` validates it — `message` max 200 chars, excess rejected with `error { code: "MESSAGE_TOO_LONG" }`

**Given** sender is not a member of the specified room
**When** `lobbyChat` arrives
**Then** server returns `error { code: "NOT_IN_ROOM" }` — message not relayed

**Given** a player sends more than 5 messages within 3 seconds
**When** rate limit threshold is exceeded
**Then** excess messages are dropped and sender receives `error { code: "RATE_LIMITED" }` — other players unaffected

**Given** a valid `lobbyChat` message
**When** server relays it
**Then** `lobbyChatMessage { playerId, displayName, message, timestamp }` is broadcast to all room members including sender

**Given** match phase has started (`startMatch` processed)
**When** `lobbyChat` arrives
**Then** server rejects with `error { code: "MATCH_IN_PROGRESS" }` — lobby chat gated to lobby phase only

### Story 8.4: Vote-kick system

As a player in a lobby with a disruptive participant,
I want to initiate a vote to remove them,
So that the group can eject bad actors without requiring host absolute removal power.

**Acceptance Criteria:**

**Given** a player emits `initiateVoteKick { roomCode, targetPlayerId }`
**When** no active vote exists for this room
**Then** `VoteKickState` is written to Redis with 30s TTL; initiator's vote auto-cast as `yes`; `voteKickStarted` broadcast to all room members including target

**Given** a vote is already `PENDING` in the room
**When** any player emits `initiateVoteKick`
**Then** server returns `error { code: "VOTE_IN_PROGRESS" }` — second vote blocked

**Given** a player emits `castVoteKick { roomCode, targetPlayerId, vote: "yes"|"no" }`
**When** active vote exists and sender has not yet voted
**Then** vote recorded; if `yes / eligible >= 0.55` → `voteKickResolved { outcome: "kicked" }` + `playerLeft { reason: "kicked" }` broadcast; target's WebSocket closed server-side after events are sent

**Given** all eligible voters have cast votes but threshold not met
**When** final vote arrives
**Then** `voteKickResolved { outcome: "failed" }` broadcast; `voteKick` cleared from room state

**Given** 30 seconds elapse without vote resolution
**When** server polling job fires (every 30s, no keyspace notifications — Upstash free-tier compatible)
**Then** expired vote detected; `voteKickResolved { outcome: "expired" }` broadcast; `room.voteKick` cleared

**Given** target player disconnects while vote is `PENDING`
**When** server processes the disconnect
**Then** vote transitions to `CANCELLED`; `voteKickResolved { outcome: "failed" }` broadcast with reason `target_left`

**Given** a voter disconnects mid-vote reducing the yes-reachable count below 55%
**When** server recalculates eligible voters
**Then** vote resolves as `failed` immediately

**Given** player emits `castVoteKick` for the same target twice
**When** server checks `voteKick.votes[playerId]`
**Then** duplicate vote rejected with `error { code: "ALREADY_VOTED" }`

### Story 8.5: Reconnect grace window + host promotion

As a player who loses connection mid-lobby,
I want a 30-second window to reconnect and rejoin my room automatically,
So that brief network hiccups don't remove me from the game.

**Acceptance Criteria:**

**Given** a player's WebSocket disconnects
**When** disconnect is detected server-side
**Then** player marked `connected: false` in Redis; 30-second grace timer starts; `playerLeft` NOT broadcast yet — roster patch emits `connectionStatus: "disconnected"` for that player

**Given** player reconnects within the 30-second grace window
**When** client sends `identify { token, roomCode }` on WS connect
**Then** server matches token to `player:{token}` in Redis, restores membership, sets `connected: true`, broadcasts `statePatch { players: [...] }`
**And** rejoining player receives full room snapshot: current `settings`, player roster, active `voteKick` state if any

**Given** 30 seconds elapse without reconnection
**When** grace timer fires
**Then** player removed from room; `playerLeft { reason: "disconnected" }` broadcast to remaining members
**And** if removed player was host, next player by `joinedAt` ascending is promoted — `statePatch { hostId: newHostId }` broadcast

**Given** host explicitly emits `leaveRoom { roomCode }`
**When** server processes voluntary leave
**Then** player removed immediately (no grace window); if host, next player promoted; `playerLeft { reason: "voluntary" }` + `statePatch { hostId }` broadcast

**Given** room drops to zero connected players
**When** last player leaves or all grace timers expire
**Then** room keys deleted from Redis — no orphan state remains

**Given** reconnecting player presents a token with no matching Redis session
**When** `identify` is processed
**Then** server returns `error { code: "TOKEN_MISMATCH" }` — client shown error, offered option to rejoin as new player

---

## Epic 8 coverage map

| Requirement | Story | Coverage note |
|---|---|---|
| BK1 | 8.1 | Player token issued, stored localStorage, resolves from Redis |
| BK2 | 8.1 | Host token issued at creation, stored Redis, never broadcast |
| BK3 | 8.1 | Room state in Redis survives server restart |
| BK4 | 8.2 | Settings synced via updateSettings + settingsUpdated broadcast |
| BK5 | 8.3 | Pre-game chat relayed with rate limiting |
| BK6 | 8.4 | Vote-kick full state machine, TTL expiry, edge cases |
| BK7 | 8.5 | 30s grace window, identify handshake, snapshot on rejoin |
| BK8 | 8.5 | Host promotion on voluntary leave and grace timeout |
| BK9 | 8.1 | 30min idle TTL, 2h active TTL, self-cleaning |
| BK10 | 8.2 | Settings locked (MATCH_IN_PROGRESS error) once startMatch fires |
