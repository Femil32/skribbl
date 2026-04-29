# Story 2.1: Match state machine skeleton & server timers

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As players entering rounds,
I want server-owned phases and timers,
So that nobody manipulates phase transitions locally (Additional reqs authority).

## Acceptance Criteria

1. **Given** lobby completed start handshake (`matchStarting` broadcast) **when** the server advances match phases **then** phases include at least **`choosingWord`**, **`drawing`**, and **`roundResult`** after `matchStarting`, with transitions **only** initiated on the server (no client command advances phases in this story).
2. **Given** a phase with a bounded duration **when** the server enters **`choosingWord`** or **`drawing`** **then** clients receive **`phaseDeadlineMs`** (Unix ms) on **`matchPhase`** events where applicable for countdown sync (Epic 2.4 will consume).
3. **Given** runtime configuration **when** the server reads gameplay timing **then** **`ROUND_MS`**, **`WORD_CHOICE_MS`**, and **`MATCH_START_HANDSHAKE_MS`** resolve from **`apps/server/src/config/game.ts`** (with optional `process.env` overrides documented there).
4. **Typed wire:** extend **`@skribbl/shared`** `roomPhaseSchema` and add **`matchPhase`** server event; all handlers use **exhaustive** `switch` / `never` guards.
5. **Join/reconnect:** non-**`lobby`** `Room.phase` continues to reject **`joinRoom`** / **`reconnectHost`** per existing rules.

## Tasks / Subtasks

- [x] **Shared protocol** (AC: 2, 4)
  - [x] Extend **`roomPhaseSchema`** with **`choosingWord`**, **`drawing`**, **`roundResult`** (keep **`lobby`**, **`matchStarting`**).
  - [x] Add **`matchPhase`** event: **`roomId`**, **`phase`**, optional **`phaseDeadlineMs`**.
  - [x] Export **`isMatchFlowPhase(phase)`** for UI guards.
  - [x] Update **`schemas.test.ts`** for new literals and round-trip serialize.
- [x] **Server config** (AC: 3)
  - [x] Add **`DEFAULT_*`** and **`resolveRoundMs`**, **`resolveWordChoiceMs`**, **`resolveMatchStartHandshakeMs`** in **`config/game.ts`** (`ROUND_MS`, `WORD_CHOICE_MS`, `MATCH_START_HANDSHAKE_MS` env overrides, clamped).
- [x] **Match scheduler** (AC: 1, 2, 5)
  - [x] After successful **`startMatch`**, keep **`matchStarting`** broadcast, then **schedule** ( **`setTimeout`** chain): handshake → **`choosingWord`** (+deadline) → **`drawing`** (+deadline) → **`roundResult`**.
  - [x] **`RoomManager`**: per-room timer list; **`clearMatchTimers`** on room teardown (last player leaves) and before rescheduling.
  - [x] **`broadcastMatchPhase`** fans out validated **`ServerEvent`**.
- [x] **Web clients** (AC: 4)
  - [x] **`use-host-create-room`** / **`use-guest-join-room`**: handle **`matchPhase`**; update **`phase`** + keep exhaustive default.
  - [x] **`LobbyHostPage`** / **`JoinRoomClient`**: show in-match placeholder when **`isMatchFlowPhase(phase)`** (not only **`matchStarting`**).
- [x] **Tests**
  - [x] Integration: **`vitest` fake timers** — after **`startMatch`**, advance time and assert **`matchPhase`** sequence and deadlines order.
  - [x] Run **`pnpm --filter @skribbl/shared test`**, **`pnpm --filter @skribbl/server test`**, **`pnpm -r exec tsc --noEmit`**, **`pnpm --filter @skribbl/web build`**.

## Dev Notes

### Architecture compliance

- Server-owned FSM per **`game-architecture.md`**; **`@skribbl/shared`** owns Zod contracts.
- Gameplay constants live in **`apps/server/src/config/game.ts`** only (read-only imports from server code).

### File structure

| Area | Path |
|------|------|
| Config | `apps/server/src/config/game.ts` |
| Room / timers | `apps/server/src/room/room-manager.ts` |
| Protocol | `packages/shared/src/schemas.ts`, `index.ts` |
| Web | `apps/web/src/features/lobby/hooks/*.ts`, `LobbyHostPage.tsx`, `JoinRoomClient.tsx` |
| Tests | `apps/server/src/room-ws.integration.test.ts`, `packages/shared/src/schemas.test.ts` |

### Technical guardrails

- Do **not** add client commands that advance match phases in 2.1.
- **`phaseDeadlineMs`** is **authoritative** server clock; clients must not compute round end locally beyond display.
- Clear all match timers when the room aggregate is removed.

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.1
- `_bmad-output/game-architecture.md` — Match FSM, `ROUND_MS`, config

## Dev Agent Record

### Agent Model Used

Composer (epic-story-runner / bmad-dev-story execution)

### Debug Log References

- Vitest fake timers verified `matchPhase` ordering and `phaseDeadlineMs` monotonicity for choosingWord → drawing.

### Completion Notes

- Implemented `matchPhase` broadcasts, extended `RoomPhase`, config resolvers, client demux + `isMatchFlowPhase` lobby placeholders.
- Code review: see `2-1-REVIEW.md`.

### File List

- `apps/server/src/config/game.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/schemas.test.ts`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `_bmad-output/implementation-artifacts/2-1-match-state-machine-skeleton-server-timers.md`
- `_bmad-output/implementation-artifacts/2-1-REVIEW.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-29 — Epic 2.1 match skeleton: server timers, shared protocol, tests, lobby UX for match flow.

## Senior Developer Review (AI)

**Outcome:** Changes Requested → Resolved (copy only).

**Action items:** See `_bmad-output/implementation-artifacts/2-1-REVIEW.md`.

**Review Follow-ups (AI)**

- [x] [AI-Review] Avoid exposing raw phase enum in lobby alerts — use generic match-in-progress copy.
