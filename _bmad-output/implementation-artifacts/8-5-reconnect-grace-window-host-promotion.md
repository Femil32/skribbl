# Story 8.5: Reconnect grace window + host promotion

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

## Story

As a player who loses connection mid-lobby,

I want a 30-second window to reconnect and rejoin my room automatically,

So that brief network hiccups don't remove me from the game.

## Acceptance Criteria

1. **Given** a player's WebSocket disconnects  
   **When** disconnect is detected server-side  
   **Then** player is marked **not connected** in authoritative state (persisted to Redis with the rest of the room); a **30-second** grace window starts; **`playerLeft` is not emitted yet**; remaining clients receive a roster update where that seat shows **`connectionStatus: "disconnected"`** (today: use existing **`lobbyRoster`** fan-out — there is **no** `statePatch` event in the codebase yet).

2. **Given** the player reconnects within the 30-second grace window  
   **When** the client completes the existing reconnect handshake (**`reconnectHost`** or **`reconnectPlayer`** with `roomId`, `playerId`, profile fields, and optional **`token`**)  
   **Then** server resolves **`player:{token}`** in Redis to the same **`playerId`** when a token is supplied; membership is restored; **`connectionStatus: "connected"`** for that seat; **`lobbyRoster`** is broadcast to the room.

3. **And** the rejoining client receives a **full lobby snapshot**: current **`settings`** (already on **`roomJoined`**), authoritative roster, and **active `voteKick`** state if any.  
   **Brownfield gap:** **`roomHydrate`** today does **not** carry **`settings`** or **`voteKick`**. Extend **`roomHydrate`** (optional fields) **or** send a defined **multi-event sequence** (e.g. **`roomJoined`** + targeted **`voteKickStarted`** replay) — pick one approach, document it, and test.

4. **Given** 30 seconds elapse without reconnection  
   **When** grace expires  
   **Then** the player is removed from the room; broadcast **`playerLeft { playerId, reason: "disconnected" }`** to remaining members **and** **`lobbyRoster`** reflecting removal.

5. **And** if the removed player was **host**, promote the **next host** by **`joinedAt` ascending** (smallest timestamp first); broadcast **`lobbyRoster`** (and **`settingsUpdated`** only if settings changed — normally no).  
   **Brownfield gap:** roster rows have **no `joinedAt` today**; **8.4** used **lexicographic `playerId`** for some host paths. This story **supersedes** promotion ordering to **`joinedAt`** per epic.

6. **Given** host explicitly emits **`leaveRoom { roomCode }`**  
   **When** server processes voluntary leave  
   **Then** remove immediately (**no** grace); if host, promote by **`joinedAt`**; emit **`playerLeft { reason: "voluntary" }`** + updated **`lobbyRoster`**.  
   **Brownfield gap:** **`leaveRoom` command does not exist** in `@skribbl/shared` — add it and handle in **`handle-client-command.ts`**.

7. **Given** room drops to **zero** connected players **and** no grace seats remain  
   **When** last live socket is gone and all grace timers have fired  
   **Then** delete room keys from Redis (**`deleteRoomFromRedis`** path) — no orphan state.

8. **Given** reconnecting player presents a **token** with **no** matching Redis session **or** token maps to a **different** `playerId` than claimed  
   **When** reconnect is processed  
   **Then** respond with **`error { code: "TOKEN_MISMATCH" }`**; web maps it in **`protocol-error-message.ts`** and offers “rejoin as new player”.

## Tasks / Subtasks

- [x] **Protocol (`packages/shared`)** (AC: 2, 6, 8)  
  - [x] Extend **`playerLeftReasonSchema`** beyond **`"kicked"`** → add **`"disconnected"`**, **`"voluntary"`**; update **`schemas.test.ts`**.  
  - [x] Add **`leaveRoom { roomCode }`** to **`clientCommandSchema`** (normalize `roomCode` like **`joinRoom`**).  
  - [x] Epic names **`identify { token, roomCode }`** — **do not** introduce a parallel command unless PM requires it; implement grace + token checks inside **`reconnectHost` / `reconnectPlayer`** (and document that mapping in Dev Notes).  
  - [x] Extend **`roomHydrate`** with optional **`settings`**, **`voteKick`** (or equivalent), **`roomCode`** if missing — only what’s needed for lobby snapshot (AC3); keep backward compatibility (omitted fields OK for older clients).

- [x] **`joinedAt` + persisted roster membership** (AC: 1, 4, 5, 7)  
  - [x] Add **`joinedAtMs`** (integer) to **`lobbyRosterPlayerSchema`** (default for legacy: e.g. `0` or omit and treat as “unknown” in tests).  
  - [x] Persist lobby membership list in Redis via **`PersistedRoomFields`** + **`serializeRoom` / `deserializeRoom`** — e.g. JSON array `{ playerId, joinedAtMs, displayName?, avatarPresetId?, graceExpiresAtMs?, connected }` or split fields per existing patterns.  
  - [x] On **`joinRoom` / `createRoom`**, set **`joinedAtMs`**.  
  - [x] Ensure **`writeRoomToRedis`** runs on every grace transition.

- [x] **`RoomManager` — grace + disconnect** (AC: 1–7)  
  - [x] Today **`leaveSocketRoom`** only stashes **`awaitingReconnect`** when **`phase !== "lobby"`**; **lobby** drops remove the socket and can **drop the row from roster** — change so lobby disconnects enter a **grace state** (new map or extend stash) with **`graceExpiresAtMs = now + 30_000`**, **`connected: false`**, seat retained for headcount / **`maxPlayers` / vote-kick eligibility** per product rules (see Dev Notes).  
  - [x] Register a **polling** pass (prefer **30s** interval in **`create-game-server.ts`** next to **`pollVoteKicks`**, **or** per-room timers — document tradeoff; polling matches Upstash-friendly story 8.4).  
  - [x] On grace expiry: remove member, **`playerLeft` + `writeRoomToRedis`**, **`broadcastLobbyRoster`**, host promotion helper using **`joinedAtMs`**.  
  - [x] **`leaveRoom`**: validate member, skip grace, same removal + voluntary reason.  
  - [x] Reuse / align with **`syncLobbyHostPointers`**: update **`hostPlayerId` + `hostSocket`** consistently; voluntary host leave already has special cases in **8.4** — merge cleanly.  
  - [x] **Vote-kick (8.4):** define behavior when target is **grace-disconnected** / **target_left** after grace expiry — **`eligibleKickVoters`** remain **connected**-socket based.

- [x] **Token verification** (AC: 2, 8)  
  - [x] Before completing reconnect, **`GET player:{token}`** must match **`expectedPlayerId`**; else **`TOKEN_MISMATCH`**. Wire errors through **`sendProtocolError`**.

- [x] **Protocol handler**  
  - [x] Handle **`leaveRoom`**; extend **`reconnectHost` / `reconnectPlayer`** success paths to clear grace stash and broadcast (**AC2**).

- [x] **Web (`@skribbl/web`)**  
  - [x] Lobby: optional **Leave** control calling **`leaveRoom`**.  
  - [x] On **`TOKEN_MISMATCH`**, user-facing copy + path to join fresh.  
  - [x] Ensure **`use-host-create-room` / `use-guest-join-room`** tolerate extended **`roomHydrate`** / roster **`joinedAtMs`**.  
  - [x] **`ws-client`**: typed helper for **`leaveRoom`**.

- [x] **Tests**  
  - [x] **`room-manager.test.ts`**: lobby disconnect → roster shows disconnected; no **`playerLeft`** until 30s; reconnect clears; grace expiry → **`playerLeft`** reason **`disconnected`**; host promotion order by **`joinedAtMs`**; voluntary **`leaveRoom`**.  
  - [x] **`room-ws.integration.test.ts`**: multi-socket timeline for grace + broadcast ordering.  
  - [x] **`room-keys.test.ts`**: serialize/deserialize membership + grace fields.  
  - [x] **`schemas.test.ts`**: reasons + new commands + hydrate shape.  
  - [x] Verify: `pnpm --filter @skribbl/shared test`, `pnpm --filter @skribbl/server test`, `pnpm --filter @skribbl/web test`, `pnpm -r exec tsc --noEmit`.

## Dev Notes

### Brownfield reality (read first)

| Area | Current code | Story 8.5 needs |
| --- | --- | --- |
| Lobby disconnect | **`leaveSocketRoom`** does **not** stash lobby players → they disappear from **`buildLobbyRosterPlayers`** | Retain seat in roster **30s** with **`connectionStatus: "disconnected"`** |
| Reconnect | **`reconnectPlayer`** requires **`awaitingReconnect`** (match-phase stash) | Lobby grace must populate a stash or unified model **`reconnectPlayer`** can consume |
| `playerLeft` | Reasons **only** **`kicked`** | Add **`disconnected`**, **`voluntary`** |
| Host promotion | **8.4** lexicographic smallest **`playerId`** in some paths | Epic **8.5**: **`joinedAt` ascending** — implement **`joinedAtMs`** and use for promotion |
| Epic `statePatch` | Documented in **epics** / **architecture** prose only | Use **`lobbyRoster`** (+ **`settingsUpdated`** if needed); add **`statePatch` only** if you need a slimmer event — avoid duplicate sources of truth |
| `roomHydrate` | **Match-oriented** hydrate | Lobby snapshot must include **settings + voteKick** (AC3) |
| Redis room | **`PersistedRoomFields`** has no roster seats | Add membership blob or side key pattern; keep **TTL** rules (**`ROOM_TTL_*`**) consistent |

### Architecture compliance

- Single schema source: **`@skribbl/shared`** only.  
- Server-authoritative; Result-style internals; structured **`error`** with stable **`code`**.  
- Parse outbound events through **`serializeServerEvent`**. After shared changes, **`pnpm --filter @skribbl/shared build`** if events “missing” on wire during dev.

### Suggested new / extended error codes

- **`TOKEN_MISMATCH`** (AC8)  
- Reuse **`NO_STASHED_SESSION`** / grace-expired copy where appropriate

### File / module touch list (expected)

- `packages/shared/src/schemas.ts`, `schemas.test.ts`, `index.ts`  
- `apps/server/src/lib/redis/room-keys.ts`, `room-keys.test.ts`  
- `apps/server/src/room/room.ts` (optional: grace maps)  
- `apps/server/src/room/room-manager.ts`, `room-manager.test.ts`  
- `apps/server/src/protocol/handlers/handle-client-command.ts`  
- `apps/server/src/create-game-server.ts` (grace poll registration)  
- `apps/server/src/room-ws.integration.test.ts`  
- `apps/web/src/lib/ws-client.ts`  
- `apps/web/src/features/lobby/lib/protocol-error-message.ts`  
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`, `use-guest-join-room.ts`  
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`, `JoinRoomClient.tsx` (leave control if UX warrants)

### Testing standards

- **Vitest** + fake timers for **30s** grace.  
- Assert **ordering**: grace disconnect → **`lobbyRoster`** with disconnected row → **no** **`playerLeft`** until expiry.

## Previous story intelligence (8.4)

- Vote-kick paths **`handleVoteKickOnMemberDisconnected`**, **`pollVoteKicks`**, and kick host reassignment **must stay coherent** with grace semantics.  
- **8.4** Completion Notes: voluntary host disconnect avoided calling **`syncLobbyHostPointers`** in some flows to preserve **`hostPlayerId`** for **`reconnectHost`** — re-validate after **8.5** so grace + host promotion don’t regress host reclaim.  
- Redis **`voteKick`** hydration: extend hydration path if **`roomHydrate`** carries **`voteKick`**.

## Git intelligence (recent commits)

- **`feat(lobby): implement vote-kick system…`** — patterns for **`RoomManager`**, **`create-game-server`** polling, shared enums, integration tests — **mirror** for grace polling and protocol extensions.

## Latest technical notes (2026)

- Stack pins: **Next ~16.x**, **React ~19.x**, **Zod ~4.x**, **Node 24**, **`ws` ~8.20**, **Upstash** — see **`project-context.md`**.

## Project context rules (extract)

- **pnpm** workspaces — `pnpm --filter @skribbl/<pkg>`.  
- **No Socket.io**; **`ws`** only.  
- **Two processes** (Next + game server) for real deploy.  
- All wire types in **`@skribbl/shared`**; **`player:{token}`** identity from story **8.1**.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8, Story 8.5]  
- [Source: `_bmad-output/game-architecture.md` — reconnect, Zod protocol, Redis direction]  
- [Source: `_bmad-output/project-context.md`]  
- [Source: `_bmad-output/implementation-artifacts/8-4-vote-kick-system.md`]  
- [Source: `apps/server/src/room/room-manager.ts` — `leaveSocketRoom`, `reconnectHost`, `reconnectPlayer`, `buildLobbyRosterPlayers`, `pollVoteKicks`]  
- [Source: `packages/shared/src/schemas.ts` — `clientCommandSchema`, `serverEventSchema`, `lobbyRosterPlayerSchema`]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (Cursor agent)

### Debug Log References

- Ensured `@skribbl/shared` `dist` is rebuilt after schema changes so runtime `serializeServerEvent` matches source (local dev).

### Completion Notes List

- **AC3 approach:** Extended **`roomHydrate`** with optional **`settings`**, **`voteKick`**, **`roomCode`**; server includes lobby snapshot on reconnect hydrate. Web hooks apply **`settings`** to the lobby store and replay **`voteKickStarted`** when **`voteKick.status === "PENDING"`**.
- Lobby **Leave** uses **`leaveRoom`** via **`serializeLeaveRoomCommand`**; host/guest hooks expose **`leaveLobby`** (clears **`sessionStorage`** after send).
- **`TOKEN_MISMATCH`** is terminal in both hooks; copy in **`protocol-error-message.ts`** directs users to rejoin with the room code.
- **`joinedAtMs`** on roster rows drives host promotion after grace expiry / voluntary leave; Redis persistence includes membership grace metadata.
- **Vote-kick + grace:** Target in lobby grace does not immediately emit **`target_left`**; expiry follows grace handling.

### File List

- `packages/shared/src/schemas.ts`
- `packages/shared/src/schemas.test.ts`
- `packages/shared/src/index.ts`
- `apps/server/src/create-game-server.ts`
- `apps/server/src/lib/redis/room-keys.ts`
- `apps/server/src/lib/redis/room-keys.test.ts`
- `apps/server/src/protocol/handlers/handle-client-command.ts`
- `apps/server/src/room/lobby-session.ts`
- `apps/server/src/room/room.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/room/room-manager.test.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/src/lib/ws-client.ts`
- `apps/web/src/features/lobby/lib/protocol-error-message.ts`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `apps/web/src/features/game/components/GamePage.tsx`
- `apps/web/src/features/lobby/components/LobbyHostPage.test.tsx`
- `apps/web/src/features/match/components/PhaseBar.test.tsx`
- `apps/web/src/features/match/lib/sort-players-by-final-score.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/8-5-reconnect-grace-window-host-promotion.md`

### Change Log

- 2026-05-13 — Story 8.5 implementation: lobby reconnect grace (30s), **`joinedAtMs`** + Redis membership, **`leaveRoom`**, **`TOKEN_MISMATCH`**, extended **`roomHydrate`**, host promotion by **`joinedAtMs`**, web leave + hydrate UX, tests green.
- 2026-05-13 — Review follow-up: per-socket WS command queue, lobby grace one-shot timers (~30s) + reconnect deadline checks, **`roomWirePlayerCount`** for **`roomJoined`**, **`leaveRoom`** / **`TOKEN_MISMATCH`** tests, lobby **`roomHydrate`** + **`voteKick`** schema test.

### Review Findings

_Findings below were addressed in the second 2026-05-13 changelog entry unless marked defer._

- [x] [Review][Patch] Fire-and-forget async WS handler — **Fixed:** per-connection `commandChain` promise queue in `create-game-server.ts` so `handleClientCommand` runs sequentially per socket.

- [x] [Review][Patch] Lobby reconnect after grace deadline — **Fixed:** `isLobbyGracePast` rejects **`reconnectHost` / `reconnectPlayer`**; per-seat **`scheduleLobbyGraceTimer`** (~30s, `unref`) evicts without waiting for poll; **`pollLobbyReconnectGrace`** kept as backup; timers cleared on voluntary leave / reconnect / teardown.

- [x] [Review][Defer] Small edits in match/score tests (`PhaseBar.test.tsx`, `sort-players-by-final-score.test.ts`, `GamePage.tsx`) are outside story 8.5 scope — deferred, pre-existing noise / typing ripple only

- [x] [Review][Defer] Process restart vs Redis grace metadata (story open question #2) — deferred, out of scope unless product asks for cold-restart reconciliation

## Story completion status

- **Status:** `done`  
- **Note:** Review patches applied; `@skribbl/shared` + `@skribbl/server` tests and `tsc --noEmit` pass.

---

### Open questions / product clarifications (non-blocking)

1. During grace, is a **grace-disconnected** player counted toward **`maxPlayers`** and **vote-kick eligibility** as “present”? (Default: **yes** for capacity, **eligible voters = connected only** to match **8.4**’s live-socket rule — confirm.)  
2. If **`REDIS`/`RoomManager`** loses process memory but Redis still has **grace metadata**, should cold restart honor grace? (Optional hardening: persist **`graceExpiresAtMs`** in Redis and reconcile on load — out of scope unless stated.)
