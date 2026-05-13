# Story 8.4: Vote-kick system

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

## Story

As a player in a lobby with a disruptive participant,
I want to initiate a vote to remove them,
so that the group can eject bad actors without requiring absolute host-only removal power.

## Acceptance Criteria

1. **Given** a player emits `initiateVoteKick { roomCode, targetPlayerId }`  
   **When** no active vote exists for this room (`PENDING`)  
   **Then** `VoteKickState` is persisted (Redis-backed; see Dev Notes) with a **30 second** lifetime from initiation; the initiator’s vote is recorded as **`yes`**; `voteKickStarted` is broadcast to **all** room members **including the target**.

2. **Given** a vote is already `PENDING` in the room  
   **When** any player emits `initiateVoteKick`  
   **Then** server responds with **`error { code: "VOTE_IN_PROGRESS" }`** — no second vote.

3. **Given** a player emits `castVoteKick { roomCode, targetPlayerId, vote: "yes" | "no" }`  
   **When** an active vote exists for that `targetPlayerId`, lobby rules pass, and the sender has not yet voted  
   **Then** the vote is recorded; if **`yesCount / eligibleVoterCount >= 0.55`** then emit **`voteKickResolved { outcome: "kicked" }`**, then **`playerLeft { playerId: targetPlayerId, reason: "kicked" }`** to the room; **after** those events are sent, **close the target’s WebSocket** server-side and remove them from the room / Redis persisted roster per existing room patterns.

4. **Given** all **eligible** voters have cast votes and the **55%** threshold is **not** met  
   **When** the final qualifying vote is processed  
   **Then** broadcast **`voteKickResolved { outcome: "failed" }`**; clear `voteKick` from authoritative room state and Redis.

5. **Given** **30 seconds** elapse after vote start without resolution  
   **When** a **polling** pass runs (interval **30s**, **no Redis keyspace notifications** — Upstash free-tier friendly)  
   **Then** the server detects expiry, broadcasts **`voteKickResolved { outcome: "expired" }`**, and clears `voteKick`.

6. **Given** the **target** player disconnects (or otherwise leaves the room) while a vote is `PENDING`  
   **When** the server processes that removal  
   **Then** the vote transitions to **`CANCELLED`**; broadcast **`voteKickResolved { outcome: "failed", reason: "target_left" }`** (shape MUST allow this reason — use optional `reason` on the event); clear `voteKick`.

7. **Given** a **voter** disconnects mid-vote so that **yes** votes can **no longer** reach **55%** of **eligible** voters (recalculate **eligibleVoterCount** from **current** connected members, excluding the target)  
   **When** the server applies the roster change  
   **Then** resolve the vote as **`failed`** immediately (same broadcast + clear as AC4).

8. **Given** a player emits `castVoteKick` **twice** for the same target in the same vote  
   **When** the server checks `voteKick.votes[senderPlayerId]`  
   **Then** respond with **`error { code: "ALREADY_VOTED" }`**.

**Epic narrative (lobby-only):** Story copy is **lobby** disruption. Gate **`initiateVoteKick` / `castVoteKick`** to **`room.phase === "lobby"`**; if the match has started, respond with **`error { code: "MATCH_IN_PROGRESS" }`** (consistent with Stories 8.2 / 8.3).

## Tasks / Subtasks

- [x] **Shared protocol (`@skribbl/shared`)** (AC: all)  
  - [x] Add **`initiateVoteKick`** and **`castVoteKick`** to `clientCommandSchema` (discriminated union): normalize `roomCode` the same way as `joinRoom` / `lobbyChat` (document shared helper).  
  - [x] Add **`voteKickStarted`**, **`voteKickResolved`**, **`playerLeft`** to `serverEventSchema` with Zod-validated shapes.  
  - [x] Define **`voteKickResolved.reason`** as optional string union or enum (at minimum support **`target_left`** for AC6).  
  - [x] Export types from `index.ts`; extend **`schemas.test.ts`** (valid/invalid, unknown fields rejected).

- [x] **Redis + persisted room shape** (AC: 1, 4, 5, 6)  
  - [x] Extend **`PersistedRoomFields`** / **`serializeRoom`** / **`deserializeRoom`** in `apps/server/src/lib/redis/room-keys.ts` **or** use a dedicated Redis key pattern documented in Dev Notes — **must** survive hydration path used by **`RoomManager`** today.  
  - [x] Ensure **`writeRoomToRedis`** runs when vote state mutates so multi-instance reads stay coherent **within** MVP assumptions (single game server is still baseline; story still persists to Redis per Epic 8).

- [x] **`RoomManager` — state machine** (AC: all)  
  - [x] Implement **`applyInitiateVoteKick(ws, roomCode, targetPlayerId)`** and **`applyCastVoteKick(ws, roomCode, targetPlayerId, vote)`** returning Result-style **`{ ok: true } | { ok: false; code: string }`**.  
  - [x] **Eligible voters:** connected members in the room (**live `WebSocket` in `room.sockets`** with known identity), **excluding `targetPlayerId`**. **`yesCount`** only counts **`yes`** from those eligible ids (initiator pre-cast as **`yes`**).  
  - [x] **55% rule:** use **`yesCount / eligibleVoterCount >= 0.55`** with real division; if **`eligibleVoterCount === 0`** after edge pruning, fail safe (treat as failed / cancel — document choice in tests).  
  - [x] **Duplicate vote / wrong target / not in room / self-target / target not in room:** map to explicit error **`code`**s (stable strings; align with `sendProtocolError` usage).  
  - [x] On **kick**: emit events, **`writeRoomToRedis`**, remove target socket from room (reuse **`leaveSocketRoom`** or shared internal helper so roster + Redis stay consistent).  
  - [x] **Host invariant:** if **`targetPlayerId === room.hostPlayerId`**, **reassign `hostPlayerId`** to a remaining member before/after removal. **Today** `leaveSocketRoom` reassigns **`hostSocket`** but **does not** update **`hostPlayerId`** — kicking the host **must not** leave **`hostPlayerId`** pointing at a removed player. Until Story **8.5** adds **`joinedAt`**, use a **documented deterministic** tie-break (e.g. **lexicographically smallest `playerId`** among remaining connected players, or “first remaining socket order” **only if** covered by tests).  
  - [x] Wire **disconnect** path: when the **target** leaves during `PENDING`, cancel vote (AC6). When any voter leaves, **recompute** threshold feasibility (AC7).

- [x] **Polling job (30s)** (AC: 5)  
  - [x] Register interval in **`create-game-server.ts`** (or `RoomManager` API called from startup) that invokes **`roomManager.pollVoteKicks()`** (name flexible) **every 30s** — no keyspace subscriptions.

- [x] **Protocol handler**  
  - [x] Add cases in **`handle-client-command.ts`**; mirror **`lobbyChat`** / **`updateSettings`** error emission; **no** uncaught throws over WS.

- [x] **Web (minimal viable UX)**  
  - [x] Host + guest lobby: surface incoming **`voteKickStarted`** / **`voteKickResolved`** / **`playerLeft`** (toast, modal, or inline banner — match DaisyUI / existing lobby patterns).  
  - [x] Send **`initiateVoteKick`** / **`castVoteKick`** via **`sendGameJsonLine`** / `ws-client` helpers.  
  - [x] Map protocol errors (`VOTE_IN_PROGRESS`, `ALREADY_VOTED`, `MATCH_IN_PROGRESS`, etc.) via **`protocol-error-message`** (or equivalent).

- [x] **Tests**  
  - [x] **`packages/shared`:** schema round-trips.  
  - [x] **`apps/server`:** `RoomManager` unit tests — happy path threshold, `VOTE_IN_PROGRESS`, `ALREADY_VOTED`, expiry via fake timers / injected clock, target disconnect cancel, voter shrink fails vote, **NOT_IN_ROOM**, **`MATCH_IN_PROGRESS`**.  
  - [x] **Integration:** `room-ws.integration.test.ts` — multi-socket broadcast order: **`voteKickResolved` before `playerLeft`** where AC3 requires; kicked socket **closed**.  
  - [x] Verify: `pnpm --filter @skribbl/shared test`, `pnpm --filter @skribbl/server test`, `pnpm --filter @skribbl/web test`, `pnpm -r exec tsc --noEmit`.

### Review Findings

- [x] [Review][Patch] Log when Redis `voteKick` JSON fails Zod validation during `deserializeRoom` — today `parseVoteKickField` returns `undefined` with no signal, which makes cross-instance or corruption issues hard to detect in ops. [`apps/server/src/lib/redis/room-keys.ts`:~130]

- [x] [Review][Defer] Extract `LobbyVoteKickWireEvent` (and related lobby wire unions) to a small `features/lobby/lib/lobby-wire-events.ts` (or similar) so `use-guest-join-room` does not import types from `use-host-create-room` — deferred, non-blocking refactor.

## Dev Notes

### Brownfield reality (read first)

| Area | Current code | Story 8.4 needs |
| --- | --- | --- |
| Wire protocol | No `voteKick` / `playerLeft` types | Add to **`@skribbl/shared`** only |
| Redis room | `PersistedRoomFields` in **`room-keys.ts`** has no `voteKick` | Extend persistence + hydration |
| Roster | `LobbyRosterPlayer` has no **`joinedAt`** | Host promotion uses interim rule until **8.5** |
| Disconnect | **`leaveSocketRoom`** updates **`hostSocket`**, not **`hostPlayerId`** | Fix host id when **kicking** or cancelling due to target leave |
| Polling | No global interval | Add **30s** poll for expired votes |

### Architecture compliance

- **Single schema source:** all message shapes in **`packages/shared/src/schemas.ts`**.  
- **Server-authoritative:** clients send **intent** only; tallies and eligibility are server-side.  
- **Result-style** handlers; structured **`error`** with stable **`code`** (see **`sendProtocolError`** patterns in Story 8.2 / **8.3**).  
- **Zod** parse outbound events through existing **`serializeServerEvent`** path — rebuild **`@skribbl/shared`** (`pnpm --filter @skribbl/shared build`) when debugging “events not on wire” (see **8.3** Dev Agent Record).

### Suggested error codes (extend / align with existing enums)

- `VOTE_IN_PROGRESS`, `ALREADY_VOTED`, `MATCH_IN_PROGRESS`, `NOT_IN_ROOM`, `INVALID_TARGET` (self-kick / unknown player), `BAD_ROOM` / code normalization reuse, `NOT_ELIGIBLE` (optional: spectator edge).

### Coordination with Story 8.5 (Reconnect grace)

- Epic **8.5** will change disconnect / **`playerLeft`** timing and add **`connectionStatus`** grace semantics.  
- **8.4** must implement **AC6–AC7** against **current** `leaveSocketRoom` / close behavior while keeping events **forward-compatible** with **8.5** hydrate (epic lists **`voteKick`** in rejoin snapshot — ensure **room hydrate** path can include active vote state or clients recover via **`voteKickStarted`** replay rules you document).

### File / module touch list (expected)

- `packages/shared/src/schemas.ts`, `schemas.test.ts`, `index.ts`  
- `apps/server/src/lib/redis/room-keys.ts` (+ tests)  
- `apps/server/src/room/room.ts` (optional: runtime `voteKick` mirror)  
- `apps/server/src/room/room-manager.ts`, `room-manager.test.ts`  
- `apps/server/src/protocol/handlers/handle-client-command.ts`  
- `apps/server/src/create-game-server.ts` (poll registration)  
- `apps/server/src/room-ws.integration.test.ts`  
- `apps/web/src/lib/ws-client.ts`  
- `apps/web/src/features/lobby/lib/protocol-error-message.ts`  
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`, `use-guest-join-room.ts`  
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`, `JoinRoomClient.tsx` (or extracted vote UI)

### Testing standards

- **Vitest** + fake timers for 30s expiry and vote windows.  
- Assert **fan-out parity** (all members see same **`voteKickResolved`** payload) similar to **8.3** lobby relay tests.

## Previous story intelligence (8.3)

- **8.3** added **`lobbyChat`**, **`applyLobbyChat`**, rate limits, and **`sendEvent`** / Zod serialization pitfalls (**stale `dist`**). Reuse **`normalizeRoomCode`**, **`getRoomForSocket`**, phase guards, and protocol error UX.  
- Review **8.3** file list for exact handler / ws-client patterns.

## Git intelligence (recent commits)

- **`feat(lobby): implement pre-game lobby chat relay`** — shared schemas, `RoomManager`, `handle-client-command`, lobby hooks/pages; **mirror that layering** for **8.4**.

## Latest technical notes (2026)

- Stack pins: **Next ~16.x**, **React ~19.x**, **Zod ~4.x**, **Node 24**, **`ws` ~8.20** — re-verify on branch (`project-context.md`).  
- Redis: **Upstash** adapter via **`REDIS_PROVIDER`** — polling-based expiry avoids keyspace **notify** requirements.

## Project context rules (extract)

- **pnpm** workspaces only — `pnpm --filter @skribbl/<pkg>`.  
- **No Socket.io**; **`ws`** only.  
- **Two processes** (Next + game server) for real deploy.  
- Read **`apps/web/AGENTS.md`** when editing Next.js surfaces.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8, Story 8.4]  
- [Source: `_bmad-output/game-architecture.md` — shared Zod protocol, server authority, Redis room direction]  
- [Source: `_bmad-output/project-context.md` — stack, protocol rules]  
- [Source: `apps/server/src/lib/redis/room-keys.ts` — `serializeRoom` / `deserializeRoom`]  
- [Source: `apps/server/src/room/room-manager.ts` — `leaveSocketRoom`, `writeRoomToRedis`, lobby roster]  
- [Source: `packages/shared/src/schemas.ts` — `clientCommandSchema`, `serverEventSchema`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent), 2026-05-13.

### Debug Log References

- Voluntary lobby host disconnect must not call `syncLobbyHostPointers` (preserves `hostPlayerId` for `reconnectHost`); host promotion on **kick** still uses lexicographic smallest player id when the kicked seat was canonical host.

### Completion Notes List

- Story 8.4 protocol, Redis `voteKick` field, `RoomManager` vote flow, 30s `pollVoteKicks` interval, handlers, minimal lobby UX, and tests are implemented. Verification: `pnpm --filter @skribbl/shared test`, `pnpm --filter @skribbl/server test`, `pnpm --filter @skribbl/web test`, `pnpm -r exec tsc --noEmit` (all green on closeout).

### File List

- `packages/shared/src/schemas.ts`, `schemas.test.ts`, `index.ts`
- `apps/server/src/lib/redis/room-keys.ts`, `room-keys.test.ts`
- `apps/server/src/room/room.ts`, `room-manager.ts`, `room-manager.test.ts`
- `apps/server/src/protocol/handlers/handle-client-command.ts`
- `apps/server/src/create-game-server.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/src/lib/ws-client.ts`, `features/lobby/lib/protocol-error-message.ts`, lobby hooks/pages/components (vote-kick UI + wiring)

### Change Log

- 2026-05-13: Completed vote-kick implementation and test coverage; story marked **review**.

## Story completion status

- **Status:** `done`  
- **Note:** Code review patch applied (voteKick hydrate warnings); story closed out 2026-05-13.

---

### Open questions / product clarifications (non-blocking — elicited after analysis)

1. Should the **target** be allowed to cast **`no`** (defensive vote), or are they excluded from **eligibleVoterCount** only (epic implies exclusion from threshold math)?  
2. Should **`initiateVoteKick`** be **host-only** or **any lobby member**? Epic says “**a player**” — default **any member** unless product overrides.  
3. Exact **`voteKickStarted`** payload fields (deadline timestamp, tallies hidden vs public) — keep **minimal** in MVP; clients only need ids + deadline + maybe initiator.
