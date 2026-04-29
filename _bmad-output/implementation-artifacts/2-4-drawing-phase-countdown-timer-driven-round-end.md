# Story 2.4: Drawing phase countdown & timer-driven round end

Status: done

## Story

As everyone in a round,
I want **authoritative** phase deadlines surfaced as countdowns (word-choice window **and** 80s drawing),
So that bounded phases do not stall invisibly and pressure feels consistent (FR7, FR8, UX-DR5 timer tokens).

## Acceptance Criteria

1. **Server authority (FR8 baseline):** **Given** phase `drawing` **when** the server’s drawing timer elapses (`resolveRoundMs()`, default **80 000** ms via `ROUND_MS` / `apps/server/src/config/game.ts`) **then** the room advances to **`roundResult`** and broadcasts **`matchPhase`** **without** a client-triggered phase change — consistent with existing `RoomManager.lockWordAndBeginDrawing` timer chain (**verify** behavior remains correct after any UI/state work; **no** client command may end the drawing phase in this story).
2. **Full guess completion (deferral):** “Timer elapses **without full guess completion**” per epics implies an eventual **correct-guess early end** (Epic 4). **For 2.4**, implement and test the **timer-expiry path** only; document the extension point (`clearDrawingTimer` / transition on guess) for Epic 4 without implementing guess adjudication here.
3. **Wire **`phaseDeadlineMs`** into client state:** **Given** a **`matchPhase`** event **when** it includes **`phaseDeadlineMs`** **then** both **`use-host-create-room`** and **`use-guest-join-room`** persist it on lobby state (optional `number`, cleared when absent or phase changes). Today the **`matchPhase`** handler updates phase/drawer/round index but **drops** deadlines — fixing this is required so the countdown is driven by **server timestamps**, not an 80s client-only assumption.
4. **PhaseBar timer chip (UX-DR5):** **Given** phase **`drawing`** and a **`phaseDeadlineMs`** **when** the UI renders **PhaseBar** **then** it shows a **countdown** (remaining time, **`tabular-nums`**, **`MM:SS`** or `M:SS`) that updates smoothly (≥1 Hz acceptable; **`requestAnimationFrame`** optional). **Semantic styling:** map remaining **fraction** to **healthy → urgent → critical** using **design tokens** (CSS variables / `@theme` in `globals.css`; avoid one-off hex per call site). Align with **`_bmad-output/planning-artifacts/ux-design-specification.md`** (timer chip, cyan-accent system, contrast).
5. **`choosingWord` countdown (required):** **Given** phase **`choosingWord`** **when** the drawer sees **`WordChoicePanel`** **then** show a countdown for the word-pick window using the **same** remaining-time + urgency-tier behavior as **`PhaseBar`** (shared pure helpers/components). **Authority:** prefer **`phaseDeadlineMs`** from persisted **`matchPhase`** state; it must align with **`wordChoiceOffer.phaseDeadlineMs`** for the active round — if both exist, single source from **`matchPhase`** after merge avoids drift. Guessers never see secret words; they may still see **`PhaseBar`** without pick UI (timer in bar is OK for all players so everyone shares time pressure).
6. **Regression tests:** Extend or add **`room-ws.integration.test.ts`** assertions that after entering **`drawing`**, **`matchPhase`** carries **`phaseDeadlineMs`** in the plausible future (~`ROUND_MS` from “now” in fake timers). **Add** an assertion that **`choosingWord`** **`matchPhase`** **`phaseDeadlineMs`** occurs **before** the subsequent **`drawing`** deadline in the same **`startMatch`** flow (ordering + ~`WORD_CHOICE_MS`/`ROUND_MS` sanity). Add **Vitest** unit tests for pure helpers (**time remaining**, **`MM:SS`** format, **urgency tier** thresholds). **`pnpm --filter @skribbl/shared test`**, **`pnpm --filter @skribbl/server test`**, **`pnpm -r exec tsc --noEmit`**, **`pnpm --filter @skribbl/web build`**.

## Tasks / Subtasks

- [x] **Trace server path** (AC: 1, 2)
  - [x] Confirm `lockWordAndBeginDrawing` **`setTimeout(resolveRoundMs)`** aligns with **`broadcastMatchPhase(..., Date.now() + resolveRoundMs(), ...)`**; document Epic 4 hook for early clear.
- [x] **Client state** (AC: 3)
  - [x] Extend `HostLobbyState` / guest equivalent with `phaseDeadlineMs?: number` (or `matchPhaseDeadlineMs` — pick one name and use consistently).
  - [x] In **`matchPhase`** case: merge **`mp.phaseDeadlineMs`** when defined; clear when transitioning to phases without deadlines (e.g. **`roundResult`** as currently broadcast).
- [x] **Shared countdown primitives** (AC: 4, 5)
  - [x] Extract **`formatRoundCountdown`** / **`remainingMs(deadline)`** / **`timerUrgencyTier(fractionRemaining)`** (or equivalent) in a small **`apps/web`** module (e.g. **`features/match/lib/timer-display.ts`**) covered by Vitest.
- [x] **UI — PhaseBar** (AC: 4)
  - [x] Pass deadline + phase into **`PhaseBar`** (`LobbyHostPage`, **`JoinRoomClient`**).
  - [x] Implement **`PhaseBar`** countdown + token classes; add **`prefers-reduced-motion`** polite handling (avoid distracting pulse if motion reduced — static color tier is enough).
  - [x] Add **`data-testid`** for timer chip (e.g. **`phase-bar-timer`**) for future E2E.
- [x] **UI — WordChoicePanel** (AC: 5)
  - [x] Pass **`phaseDeadlineMs`** into **`WordChoicePanel`** (props from lobby state or offer + merged **`matchPhase`** deadline).
  - [x] Render countdown line or chip (reuse shared helper/styles); **`data-testid`** e.g. **`word-choice-timer`**.
- [x] **Theme tokens** (AC: 4, 5)
  - [x] Add `--timer-healthy`, `--timer-urgent`, `--timer-critical` (or map to **`primary` / `warning` / `error`** if design review prefers DaisyUI semantics) in **`globals.css`** `@theme` / `:root`.
- [x] **Tests** (AC: 6)

## Dev Notes

### Epic context (Epic 2)

Epic 2 delivers match rhythm: state machine (2.1), round-robin (2.2), word bank + drawer choice (2.3), **this story (2.4)**, hints (2.5), scoring (2.6), end scoreboard (2.7). Dependencies: **2.1–2.3 done** — drawing entry and **`phaseDeadlineMs`** on **`drawing`** broadcasts already exist at the server.

### Architecture compliance

- **Server-authoritative time:** Client displays **`Date.now()` vs `phaseDeadlineMs`**; never invent round length locally (respect **`ROUND_MS`** overrides).
- **Zod contracts unchanged** unless you discover a defect — **`matchPhase`** already optional **`phaseDeadlineMs`** in `@skribbl/shared`.
- **Two-process topology:** unchanged; no Next.js API route for gameplay timers.

### File structure (expected touchpoints)

| Area | Path |
|------|------|
| Server (verify only) | `apps/server/src/room/room-manager.ts`, `apps/server/src/config/game.ts` |
| Web hooks | `apps/web/src/features/lobby/hooks/use-host-create-room.ts`, `use-guest-join-room.ts` |
| UI | `apps/web/src/features/match/components/PhaseBar.tsx`, **`WordChoicePanel.tsx`**, `LobbyHostPage.tsx`, `JoinRoomClient.tsx`; **`apps/web/src/features/match/lib/timer-display.ts`** (or equivalent — pure helpers + tests) |
| Theme | `apps/web/src/app/globals.css` |
| Tests | `apps/server/src/room-ws.integration.test.ts`, new small `*.test.ts` under `apps/web` or `packages/shared` for pure helpers |
| Contracts | `packages/shared/src/schemas.ts` (read-only unless bug found) |

- **Drawer word UI:** Countdown in **`WordChoicePanel`** uses the same math/tokens as **`PhaseBar`** — do **not** show a second conflicting clock; merge **`matchPhase`** deadline as source of truth after **AC 3**.
- **`roundResult`** broadcasts may omit **`phaseDeadlineMs`** (undefined) — UI must hide or zero countdown without throwing.
- **Reconnect mid-match:** full **`matchPhase`** replay may be incomplete today; do not block 2.4 on snapshot parity (Epic 5). If reconnect restores lobby without deadline, omit timer gracefully.

### Library / stack

Next.js App Router, React 19, Tailwind v4 + DaisyUI (`@import "tailwindcss"` / `@plugin "daisyui"`), Vitest server tests with **fake timers** — match existing patterns from **`room-ws.integration.test.ts`**.

### Previous story intelligence (2.3)

- **`wordChoiceOffer`** carries **`phaseDeadlineMs`** for drawer-only offers; **`matchPhase`** for **`choosingWord`** also carries deadline — host/guest handlers should remain **exhaustive** on **`RoomPhase`** when extending state.
- Rebuild **`@skribbl/shared`** if schemas change (**unlikely** here).
- **File list reference:** see **`2-3-word-bank-loading-drawer-wordchoicepanel.md`** for files involved in **`chooseWord`** / **`broadcastMatchPhase`**.

### Git intelligence (recent)

Recent epic-2 commits: scaffold **`matchPhase`**, round-robin + **PhaseBar**, word bank + **WordChoicePanel**. Patterns: conventional commits, integration tests with **`vi.useFakeTimers`**.

### Latest tech notes

- **`DEFAULT_ROUND_MS = 80_000`** — `apps/server/src/config/game.ts`; clamped **`ROUND_MS`** **5 000–600 000**.
- Tailwind **v4** theming prefers **`@theme`** — keep timer stops tokenized for Epic 6 accessibility sweep.

### Project context rules (extract)

From **`_bmad-output/project-context.md`**:

- All wire payloads through **`@skribbl/shared`** Zod schemas.
- Server owns phase, timers, scores; clients send intents only.
- **DaisyUI + Tailwind**; **`tabular-nums`** for timer/scores.
- **Vitest** (server/shared); **Playwright** E2E later — 2.4 focuses on unit/integration above.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.4]
- [Source: `_bmad-output/game-architecture.md` — authoritative match flow]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — PhaseBar / timer tokens]
- [Source: `apps/server/src/room/room-manager.ts` — `lockWordAndBeginDrawing`, `broadcastMatchPhase`]
- [Source: `apps/web/src/features/match/components/PhaseBar.tsx` — current props]
- [Source: `apps/web/src/features/match/components/WordChoicePanel.tsx` — Story 2.3; extend for timer]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

None

### Completion Notes List

- Confirmed server `lockWordAndBeginDrawing` uses the same `resolveRoundMs()` for `setTimeout` and `broadcastMatchPhase` deadline; added Epic 4 extension comment on the drawing timer.
- Lobby host/guest state now persists `phaseDeadlineMs` from `matchPhase` and clears it when the server omits it (e.g. `roundResult`).
- Added `timer-display` helpers + `PhaseCountdownChip` (1 Hz tick, urgency tiers, `prefers-reduced-motion` disables pulse on critical tier), wired `PhaseBar` and `WordChoicePanel` with `data-testid` hooks.
- Extended `room-ws.integration.test.ts` to assert drawing `phaseDeadlineMs` is in the plausible future immediately after entering `drawing` (with fake timers).
- Verification: `pnpm --filter @skribbl/shared test`, `pnpm --filter @skribbl/server test`, `pnpm --filter @skribbl/web test`, `pnpm -r exec tsc --noEmit`, `pnpm --filter @skribbl/web build`, `pnpm --filter @skribbl/web lint`.

### File List

- `apps/server/src/room/room-manager.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/match/components/PhaseBar.tsx`
- `apps/web/src/features/match/components/PhaseCountdownChip.tsx`
- `apps/web/src/features/match/components/WordChoicePanel.tsx`
- `apps/web/src/features/match/lib/timer-display.ts`
- `apps/web/src/features/match/lib/timer-display.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-4-drawing-phase-countdown-timer-driven-round-end.md`

## Change Log

- **2026-04-29:** Story 2.4 implemented — `phaseDeadlineMs` in lobby hooks, shared timer helpers + tests, PhaseBar/WordChoicePanel countdown UI, theme tokens, server comment + integration test extension.
- **2026-04-29:** Marked done — review fixes merged (timer duration capture, timer without round index, scoped live region + `role="timer"`, dark-mode timer colors).

## Story completion

- **Status:** done  
- **Note:** Code review complete (`2-4-REVIEW.md`); review findings addressed (server timer capture, PhaseBar/a11y, dark timer tokens).
