# Story 2.7: Match-end ScoreboardSummary

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As players finishing the scheduled rounds,
I want an ordered leaderboard with winner and tie messaging,
so that the session resolves socially (FR11, UX-DR10).

## Acceptance Criteria

1. **Detect match completion (FR11)**  
   **Given** the final scheduled round ends (timer-driven path in `lockWordAndBeginDrawing` when `roundIndex + 1 >= resolveRoundsPerMatch()`)  
   **When** the server has broadcast `roundResult` for that round  
   **Then** after a **bounded post-round beat** (reuse `resolveInterRoundGapMs()` from `apps/server/src/config/game.ts` unless you add a dedicated `MATCH_END_GAP_MS` with env mirror—document choice in Dev Notes), the room transitions to a **terminal post-match phase** and all clients receive an authoritative update.  
   **And** final **running totals** from Story 2.6 (`scoresByPlayerId` / `lobbyRoster.score`) are the **only** source of truth for ranking—no client recomputation of round-local points.

2. **Wire phase in `@skribbl/shared`**  
   **Extend** `roomPhaseSchema` with a new literal, e.g. **`matchEnded`** (name may vary but must be distinct from `roundResult`).  
   **Update** `Room` / server transitions to set this phase only from the “no next round” branch.  
   **Audit** every `RoomPhase` exhaustiveness site (TypeScript `switch`, tests, and UI) per project switch-discipline rules.

3. **Broadcast contract**  
   **When** entering `matchEnded`  
   **Then** emit **`matchPhase`** with `phase: "matchEnded"`, **no** misleading `phaseDeadlineMs`, and sensible optional fields (`matchRoundIndex` may remain last round index or be omitted—pick one and keep stable).  
   **And** broadcast **`lobbyRoster`** so scores are guaranteed fresh on clients that only infer totals from roster (align with Story 2.6 patterns).

4. **ScoreboardSummary UI (UX-DR10)**  
   **Given** client state shows `phase === "matchEnded"`  
   **When** the scoreboard surface mounts  
   **Then** show an **ordered list** (descending `score`, stable tie-break e.g. `playerId` localeCompare to match server roster order bias) with avatar, display name, and **tabular-nums** for scores.  
   **And** **winner emphasis** for top rank(s): single leader → clear “Winner”/primary styling; **exact tie on top score** → neutral **tie copy** (e.g. “It’s a tie!”) and **equal emphasis** for all tied leaders—no arbitrary single winner.  
   **And** layout uses **DaisyUI `card`** (or equivalent) per UX component strategy; **desktop-first**, responsive stack consistent with existing lobby/match shell.  
   **And** add a stable **`data-testid`** on the scoreboard root for Playwright (UX roadmap).

5. **Play again — host rules (UX-DR10)**  
   **Given** `matchEnded`  
   **When** the **host** activates **Play again**  
   **Then** the server validates host socket, transitions the room **`phase` → `lobby`**, clears match timers (`clearMatchTimers`), clears match-only fields (e.g. `matchPlayerOrder`, `currentDrawerPlayerId`, round secrets/options, drawing-phase scoring scratch, **reset `scoresByPlayerId`** to empty or zeros for all **current** roster players), and broadcasts **`matchPhase`** (or equivalent authoritative signal) plus **`lobbyRoster`** so clients return to pre-start lobby UX with **Start** available again when rules allow.  
   **When** a **guest** taps Play again  
   **Then** either **omit** the control or show disabled copy (“Only the host can start a new match”)—do not impersonate host actions.

6. **PhaseBar / shell cohesion**  
   **Given** `matchEnded` is not active match play  
   **Then** avoid implying an active round timer or drawer turn on **PhaseBar**—either hide PhaseBar, or show a minimal **“Match complete”** row without countdown (pick one approach; don’t leave confusing `roundResult` chrome).  
   **And** preserve **ConnectionBanner** behavior; no new silent failure modes.

7. **Tests**  
   - **Vitest integration** (`apps/server/src/room-ws.integration.test.ts`): with `ROUNDS_PER_MATCH=1` (or smallest case), advance fake timers through handshake → word choice → drawing → `roundResult` gap → assert **`matchPhase` with `matchEnded`** appears and roster scores are present.  
   - **Optional:** component test for **ScoreboardSummary** tie rendering if you extract pure **`sortPlayersByFinalScore()`** in `apps/web` or shared—prefer one cheap unit test over brittle snapshot.

## Tasks / Subtasks

- [x] **Shared protocol**  
  - [x] Add `matchEnded` (or chosen name) to `roomPhaseSchema` in `packages/shared/src/schemas.ts`; export from `index.ts`; extend `schemas.test.ts` (phase list / `isMatchFlowPhase` behavior).  
  - [x] Decide whether `isMatchFlowPhase` should include `matchEnded`. Default recommendation: **exclude** so word choice / drawing chrome stays off; introduce **`showMatchChrome`/`isInRoomShell`**-style predicate in **web** only if needed to share layout between match and scoreboard.  
  - [x] Add **`returnToLobby`** (or `playAgain`) host-only **`clientCommandSchema`** branch + handler wiring.

- [x] **Server**  
  - [x] In `RoomManager` drawing-timeout chain: when **no** `queueRoundStart` follow-up, schedule transition to **`matchEnded`** after the chosen gap; **do not** strand the room in `roundResult` indefinitely.  
  - [x] `broadcastMatchPhase` + `buildLobbyRosterPlayers` broadcast on enter `matchEnded`.  
  - [x] Implement **`returnToLobby(ws)`** (naming flexible): host check, phase gate `matchEnded`, reset state + `phase = "lobby"`, roster broadcast, appropriate logging on bad attempts.

- [x] **Web**  
  - [x] New **`ScoreboardSummary`** component under `apps/web/src/features/match/components/` (or `features/lobby/` if you prefer “session end” grouping—stay consistent with existing **`features/match`** imports).  
  - [x] **`LobbyHostPage`** / **`JoinRoomClient`**: when `phase === "matchEnded"`, render scoreboard (full-width card stack acceptable); host **Play again** primary button; guest secondary copy.  
  - [x] **`use-host-create-room`** / **`use-guest-join-room`**: demux new command sender; handle **`matchPhase`** → `lobby` after reset (ensure reducer clears `wordChoiceOffer`, deadlines, etc.).  
  - [x] **`serialize*`** helpers in `apps/web/src/lib/ws-client.ts` for the new command.

- [x] **Regression**  
  - [x] `pnpm --filter @skribbl/shared test`, `pnpm --filter @skribbl/server test`, `pnpm -r exec tsc --noEmit`, `pnpm --filter @skribbl/web build`.

## Dev Notes

### Epic context (Epic 2)

**Prerequisites:** Stories **2.1–2.4** establish phases and timer-driven `roundResult`. **2.6** adds **`scoresByPlayerId`** and roster **`score`**. This story **closes the loop** with FR11 end-game UI. **Story 2.5** (hints) remains independently backlog in sprint YAML—implementing **2.7** before **2.5** is an explicit ordering exception if you proceed as-is.

### Current code gap (critical)

In `RoomManager.lockWordAndBeginDrawing`, when the drawing timer fires and **`roundIndex + 1 >= resolveRoundsPerMatch()`**, the server sets `roundResult` but **never** schedules further work—clients remain in **`roundResult`** with no scoreboard. **2.7** must append the **`matchEnded`** transition (and optional roster refresh) in that branch (or immediately after the same timer callback, via `setTimeout` using the inter-round gap).

### Architecture compliance

- **Server-authoritative:** Rankings derive from server **`lobbyRoster`** / aggregate scores only.  
- **Zod:** All new commands/events only in **`@skribbl/shared`**—no duplicate enums in apps.  
- **Timers:** Reuse existing `matchTimersByRoomId` bucket for the “final gap → matchEnded” timeout; clear on room teardown and on **returnToLobby** like other match chains.

### File structure (expected touchpoints)

| Area | Path |
|------|------|
| Phases + commands | `packages/shared/src/schemas.ts`, `schemas.test.ts`, `index.ts` |
| Match lifecycle | `apps/server/src/room/room-manager.ts`, `apps/server/src/room/room.ts` (reset helpers if needed) |
| Command handler | `apps/server/src/protocol/handlers/handle-client-command.ts` |
| Integration tests | `apps/server/src/room-ws.integration.test.ts` |
| Scoreboard UI | `apps/web/src/features/match/components/ScoreboardSummary.tsx` (new) |
| Shell pages | `LobbyHostPage.tsx`, `JoinRoomClient.tsx` |
| Hooks | `use-host-create-room.ts`, `use-guest-join-room.ts` |
| WS serializers | `apps/web/src/lib/ws-client.ts` |

### UX notes (UX-DR10, spec § ScoreboardSummary)

- **Purpose:** End-game ordering + highlight winner + Play again entry.  
- **States:** Final; tie handling copy.  
- **Structure:** DaisyUI **`card`** for rows or single panel; align with dark shell + primary accent for winner.  
- **Motion:** If you add celebration, gate with **`prefers-reduced-motion`** (UX-DR14).

### Previous story intelligence (2.6)

- **`applyCorrectGuessAward`** only awards + roster broadcast; do **not** fork scoring here.  
- **`drawingPhaseStartedAtMs`** / **`drawingPhaseAwardedGuesserIds`** cleared when leaving `drawing`; on **returnToLobby**, clear **all** match scratch + **scores** for a clean rematch.  
- **tabular-nums** already required for roster scores—reuse on scoreboard.  
- 2.6 review closed **WR-001** (duplicate award guard)—preserve invariants when resetting state.

### Git intelligence (recent)

Recent commits: **2.6** scoring + roster **`score`**, **2.4** timer-driven `roundResult`, **2.3** word bank, **2.2** round-robin. Patterns: **Vitest fake timers** in **`room-ws.integration.test.ts`**, **`serializeServerEvent`**, **conventional commits**.

### Latest tech notes

Stack pins per **`project-context.md`** (Next **16.2.4**, React **19.2.5**, Zod **4.3.6**, Node **24**). Re-run **`pnpm -r exec tsc`** after adding **`RoomPhase`** literals.

### Project context rules (extract)

From **`_bmad-output/project-context.md`**:

- Single wire-types source: **`@skribbl/shared`**.  
- **Exhaustive** protocol demux and **Result-style** server outcomes before WS errors.  
- **Vitest** for shared + server; avoid React in shared.  
- **DaisyUI + Tailwind**; **`data-testid`** on critical surfaces for E2E.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.7]  
- [Source: `_bmad-output/planning-artifacts/gdd.md` — Finale / scoreboard]  
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR10, ScoreboardSummary, End match journey]  
- [Source: `_bmad-output/game-architecture.md` — authority, phases, WS patterns]  
- [Source: `apps/server/src/room/room-manager.ts` — `lockWordAndBeginDrawing`, `queueRoundStart`, `clearMatchTimers`]  
- [Source: `packages/shared/src/schemas.ts` — `roomPhaseSchema`, `matchPhase` event]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- **`matchEnded`** phase added; **`isMatchFlowPhase`** excludes it; **`isRosterScoreVisiblePhase`** covers roster score column during match + post-match.
- **`returnToLobby`** client command + **`RoomManager.returnToLobby`** (host-only, `matchEnded` gate); **`enterMatchEnded`** after final **`roundResult`** + **`resolveInterRoundGapMs()`** (same env as inter-round gap; no separate `MATCH_END_GAP_MS`).
- **`broadcastMatchPhase`** only includes optional `phaseDeadlineMs` / `drawerPlayerId` / `matchRoundIndex` when provided (no misleading deadline on **`matchEnded`**).
- Web: **`ScoreboardSummary`**, **`PhaseBar`** “Match complete” row, hooks clear drawer/deadline on **`matchEnded`**/**`lobby`**, integration + **`sortPlayersByFinalScore`** unit test.

### File List

- `packages/shared/src/schemas.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/schemas.test.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/protocol/handlers/handle-client-command.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/src/lib/ws-client.ts`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `apps/web/src/features/match/components/PhaseBar.tsx`
- `apps/web/src/features/match/components/ScoreboardSummary.tsx`
- `apps/web/src/features/match/lib/sort-players-by-final-score.ts`
- `apps/web/src/features/match/lib/sort-players-by-final-score.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Status

review

---

### Clarifications / open questions (non-blocking)

1. **Sprint order:** `sprint-status.yaml` still has **2-5** in **backlog** while **2-7** moves to **ready-for-dev**—confirm with PM whether hints (**2-5**) should ship before end-game in production; the **code** path for **2.7** does not depend on hints.  
2. **Play again scope:** This story specifies **same room → lobby reset**. A **new room code** flow is out of scope unless you extend FR1/FR2 UX deliberately.

## Change Log

- 2026-04-29: Implemented match end phase, scoreboard UI, returnToLobby, tests, and sprint tracking updates.
