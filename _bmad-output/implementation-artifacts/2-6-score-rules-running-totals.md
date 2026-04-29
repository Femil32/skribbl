# Story 2.6: Score rules & running totals

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As players,
I want scores to reflect guess speed and drawer assists,
so that competition feels fair (FR10) and standings stay visible during a match.

## Acceptance Criteria

1. **Authoritative totals (FR10)**  
   **Given** a match round in **`drawing`** with a recorded **drawing phase start time**  
   **When** the server applies a **validated correct guess** for a guesser (caller supplies `guessOccurredAtMs` monotonic clock, same basis as timers)  
   **Then** the guesser earns **positive integer points** that **decrease monotonically** as elapsed time since drawing start increases (latency from round start), using an **explicit, documented formula** implemented as **pure functions** with deterministic unit tests.  
   **And** the current round’s drawer earns a **fixed integer assist** per qualifying correct guess (same for every guess regardless of latency—reward for facilitating clues).  
   **And** the drawer **never** receives guesser-speed points for words they drew; guessing own word is excluded by invariant (server rejects / no-op).

2. **Wire contract for Epic 4 (no duplicate scoring)**  
   **Given** chat-based guessing lands in Epic 4 (`sendChat`/adjudication)  
   **When** a message is validated as an exact secret-word match (**FR20**)  
   **Then** adjudication delegates to **`RoomManager`** (or cohesive helper colocated under `apps/server/src/room/`) so **one** authoritative implementation updates totals (prepare **single entry point**, e.g. `applyCorrectGuessAward(...)`, callable from Epic 4 when it exists).  
   **For Story 2.6 verification without Epic 4 chat:** integration tests **may** invoke that entry point directly after transitioning a room through **`drawing`**, using deterministic fake timers / fixed timestamps—do **not** add user-facing cheats or stray duplicate scoring paths.

3. **`@skribbl/shared` roster shape (running totals)**  
   **Extend** `lobbyRosterPlayerSchema` with **`score`** (integer **`>= 0`**; default **`0`** for omitted backward compat inside a single codebase release—prefer always sending explicit `0` once landed). Update **all** constructors of `LobbyRosterPlayer` on the server (`buildLobbyRosterPlayers`, etc.) and any client reducers that merge roster rows so types stay exhaustive.

4. **Broadcast updates**  
   **When** totals change after a scoring event  
   **Then** broadcast an updated **`lobbyRoster`** to all sockets (existing event—no parallel “score-only” ghost state).  
   **And** totals persist in the **Room aggregate for connected players’ session** (matches epics trajectory for eventual reconnect/epic continuity).

5. **UI — roster + PhaseBar numerals (UX-DR5, UX-DR8)**  
   **Given** match UI renders **LobbyPlayerRoster** and **PhaseBar**  
   **When** roster rows include **`score`**  
   **Then** each row shows **`tabular-nums`** for the numeric score column (prevent layout jitter — UX spec § numerals).  
   **And** **PhaseBar** surfaces **running totals** visibly (minimal acceptable: **`You:` + your total** with `tabular-nums`, or a slim **“Leader: …”** pill—avoid hiding scores until Epic 2.7).

6. **Configuration**  
   Publish tunables in **`apps/server/src/config/game.ts`** with env overrides mirrored to existing resolver style (clamp + warn logs):  
   - **Max/min guesser score** bracket (linear interpolation between them over round duration recommended), **`DRAWER_ASSIST_PER_CORRECT`** (INTEGER). Defaults chosen for demo balance (example for doc only—pick concrete numbers in impl): plausible **max ~100 → min ~10**, assist **10** unless product prefers round numbers—**document chosen defaults in Dev Notes.**

7. **Tests**  
   - **Vitest** pure tests on `computeGuesserPoints(elapsedMs, roundMs)` (and helper split if needed). Cover boundaries: **`elapsedMs <= 0`**, **`elapsedMs >= roundMs`**, non-finite clamps.  
   - **Vitest** server integration: after **`drawing`** starts, **`applyCorrectGuessAward`** increments correct players; roster events contain expected **`score`**; drawer assist applied once per invocation. Assert **tabular**/`score` rendering only if covered by `@testing-library`/component test—prioritize logic tests.

## Tasks / Subtasks

- [x] **Pure scoring module**  
  - [x] Implement formula + tests in **`packages/shared`** OR **`apps/server/src/scoring/`** (shared preferred if used by both; if server-only, keep pure TS).  
  - [x] Re-export types if needed; **no** React imports in shared scoring.

- [x] **Room state**  
  - [x] Track **`drawingPhaseStartedAtMs`** (optional `number`, set where drawing begins — `RoomManager.lockWordAndBeginDrawing` path in `apps/server/src/room/room-manager.ts`). Clear on transitions out of **`drawing`** as appropriate.  
  - [x] Track **`scoresByPlayerId: Map<string, number>` or `Record<>`** initialized at match start (**`startMatch`/queue**) to **zero** for all players in **`matchPlayerOrder`** (extend `Room` in `apps/server/src/room/room.ts`).

- [x] **`RoomManager`**  
  - [x] **`buildLobbyRosterPlayers`** includes **`score`** from room aggregate (`0` default if missing).  
  - [x] **`applyCorrectGuessAward({ roomId, guesserPlayerId, occurredAtMs })`** (name may vary — **single entry point**) — validates **`phase === drawing`**, guesser **≠** `currentDrawerPlayerId`, room membership; computes `elapsed`; applies guesser + drawer points; clamps to non-negative ints; broadcasts **`lobbyRoster`**; logs structured failures only as needed (pino).  
  - [x] **Do not implement full chat spoiler / round-ending advance here** unless already shared with Epic 4 scope—caller may invoke before timer clear in a later epic; if round-end-on-guess arrives in Epic 4, Epic 4 calls `clearMatchTimers`/transition plus this award ordering—note in Dev Notes.

- [x] **`@skribbl/shared`**  
  - [x] Extend `lobbyRosterPlayerSchema` with **`score`**; **`schemas.test.ts`** assertions; rebuild consumers.

- [x] **Web**  
  - [x] **`LobbyPlayerRoster`**: optional **`showScores`** or always show score column **when phase is match flow** (`isMatchFlowPhase`).  
  - [x] **`PhaseBar`**: add props for **`localTotalScore`** + optional **`leaderSummary`** or derive from `players` + `localPlayerId`.  
  - [x] **`LobbyHostPage`**, **`JoinRoomClient`**: pass scores through from hook state after **`lobbyRoster`** parses.

- [x] **Config**  
  - [x] Env-driven defaults in `game.ts` with tests for invalid env fallbacks.

- [x] **Regression**  
  - [x] `pnpm --filter @skribbl/shared test`, `pnpm --filter @skribbl/server test`, `pnpm -r exec tsc --noEmit`, `pnpm --filter @skribbl/web build` (and web test if present).

## Dev Notes

### Epic context (Epic 2)

**Dependencies:** 2.1–2.5 established match phases, deadlines, hints. **Epic 4** delivers chat guess detection (FR20–FR23); this story owns **FR10** math + **running totals** so FR22 “awards” have a **single** place to land. **Story 2.7** consumes the same totals for end-game UI.

### Architecture compliance

- **Server-authoritative:** No client-side score increments; clients display what **`lobbyRoster`** reports.  
- **Zod:** All new payloads through **`@skribbl/shared`**.  
- **Timers:** Use same clock basis as **`phaseDeadlineMs`** — `Date.now()` on server; `occurredAtMs` for tests can align with fake timers.

### File structure (expected touchpoints)

| Area | Path |
|------|------|
| Room aggregate | `apps/server/src/room/room.ts` |
| Orchestration | `apps/server/src/room/room-manager.ts` |
| Config | `apps/server/src/config/game.ts` |
| Scoring (pure) | `packages/shared/src/scoring.ts` (suggested) **or** `apps/server/src/scoring/*.ts` |
| Wire schema | `packages/shared/src/schemas.ts`, `packages/shared/src/schemas.test.ts` |
| Integration tests | `apps/server/src/room-ws.integration.test.ts` (extend) |
| Web roster | `apps/web/src/features/lobby/components/LobbyPlayerRoster.tsx` |
| Web phase bar | `apps/web/src/features/match/components/PhaseBar.tsx` |
| Hooks / pages | `use-host-create-room.ts`, `use-guest-join-room.ts`, `LobbyHostPage.tsx`, `JoinRoomClient.tsx` |

### Suggested MVP formula (lock in impl unless PM objects)

Define **`roundMs = resolveRoundMs()`** (same env as timers). **`elapsedMs = clamp(occurringAtMs - drawingPhaseStartedAtMs, 0, roundMs)`**.  
**Linear guesser score:** \(\text{round}\big(\text{maxPts} - (\text{maxPts}-\text{minPts}) \cdot \frac{\text{elapsedMs}}{\text{roundMs}}\big)\).

**Drawer assist:** add **`assistPts`** (`DRAWER_ASSIST_PER_CORRECT`) to `currentDrawerPlayerId` once per adjudicated invocation (each distinct correct guesser event).

This satisfies “decreases with latency” while staying explainable.

### Previous story intelligence (2.4 / 2.5)

- **2.4** (`2-4-drawing-phase-countdown-timer-driven-round-end.md`): `phaseDeadlineMs` flows through **`matchPhase`**; PhaseBar/timer helpers live under **`features/match/lib/timer-display.ts`**. Reuse **`tabular-nums`** class patterns already used for countdown.  
- **2.5** (progressive hints): Hint cadence touches **`drawing`**; scoring must reference **drawing phase start**, not hint tick start.

### Git intelligence (recent)

Epic 2 commits: match machine, round-robin, word bank + WordChoicePanel, timer-driven **`roundResult`** on expiry. Established patterns: **Vitest fake timers**, **conventional commits**, **`room-ws.integration.test.ts`**.

### Latest tech notes

- **Node 24** / **pnpm** workspace unchanged.  
- Re-verify **Zod 4.x** discriminated unions when adding **`score`** — avoid breaking `lobbyRoster` parsers on web.

### Project context rules (extract)

From **`_bmad-output/project-context.md`**:

- Single source for wire types: **`@skribbl/shared`**.  
- Server owns **scores**; clients **display** via roster.  
- **Vitest** for shared + server; **tabular numerals** for scores/timers (UX-DR5).  
- **No** duplicate protocol blobs in apps.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.6]  
- [Source: `_bmad-output/planning-artifacts/gdd.md` — Scoring / FR10, FR22]  
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — PhaseBar, PlayerRoster, tabular numerals]  
- [Source: `_bmad-output/game-architecture.md` — Scoring row]  
- [Source: `packages/shared/src/schemas.ts` — `lobbyRosterPlayerSchema`]  
- [Source: `apps/server/src/room/room-manager.ts` — `lockWordAndBeginDrawing`, `buildLobbyRosterPlayers`]

## Dev Agent Record

### Agent Model Used

Composer / GPT-5.2 (cursor agent session)

### Debug Log References

### Completion Notes List

Implementation uses **defaults** `GUESSER_SCORE_MAX=100`, `GUESSER_SCORE_MIN=10`, `DRAWER_ASSIST_PER_CORRECT=10`, linear **`computeGuesserPoints`** over **`elapsed = occurredAtMs - drawingPhaseStartedAtMs`** with **`resolveRoundMs()`** as denominator. **`drawingPhaseStartedAtMs`** set in **`lockWordAndBeginDrawing`**, cleared when the drawing timer transitions to **`roundResult`**.

**Epic 4 ordering:** **`applyCorrectGuessAward`** performs award + **`lobbyRoster`** broadcast only (no **`clearMatchTimers`** / phase advance)—call **`clearMatchTimers` + transitions** before/after as needed when chat lands.

### File List

- `packages/shared/src/scoring.ts`
- `packages/shared/src/scoring.test.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/schemas.test.ts`
- `packages/shared/src/index.ts`
- `apps/server/src/config/game.ts`
- `apps/server/src/config/game.test.ts`
- `apps/server/src/room/room.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/src/features/lobby/components/LobbyPlayerRoster.tsx`
- `apps/web/src/features/match/components/PhaseBar.tsx`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-29: Implemented FR10 linear scoring (`@skribbl/shared`), authoritative **`applyCorrectGuessAward`**, roster **`score`** + UI tabular totals, config env resolvers, Vitest coverage + integration assertion for mid-round award and drawer rejection.

## Status

done