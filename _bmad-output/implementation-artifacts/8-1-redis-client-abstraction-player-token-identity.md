# Story 8.1: Redis client abstraction + player token identity

Status: done

## Story

As a player,
I want my identity and room membership to persist across page reloads and server restarts,
so that refreshing my browser doesn't kick me out or erase my progress.

## Acceptance Criteria

1. **Given** a player visits the lobby for the first time  
   **When** no `skribbl_pid` token exists in localStorage  
   **Then** `POST /api/session` issues a URL-safe 21-char token, returns `{ token, playerId }`, and client stores both in localStorage (`skribbl_pid` = token, `skribbl_player_id` = playerId)

2. **Given** the same player reloads the page  
   **When** `skribbl_pid` token exists in localStorage  
   **Then** the existing `{ token, playerId }` is reused — `POST /api/session` with `{ token }` body returns the same values, no new identifiers issued

3. **Given** the Node WS server restarts  
   **When** a player with a valid token reconnects  
   **Then** their identity resolves from Redis `player:{token}` hash and room membership is restored

4. **Given** `REDIS_PROVIDER=upstash` env var is set  
   **When** the server initializes its Redis client  
   **Then** `@upstash/redis` adapter is used; switching to `REDIS_PROVIDER=ioredis` uses `ioredis` adapter with no other code changes (**already satisfied by 8-0** — no new work required)

5. **Given** a room is created  
   **When** host creates the room  
   **Then** `hostToken` (URL-safe 21-char token) is generated server-side, stored in Redis `room:{roomCode}` hash, and returned in the `roomCreated` server event — never broadcast to other clients

6. **Given** a room has no activity for 30 minutes after creation (idle)  
   **When** Redis TTL check fires  
   **Then** room keys expire and clean up automatically; active rooms refresh to 2-hour TTL on any player join (**already satisfied by 8-0** — no new work required)

7. **Given** `createRoom` or `joinRoom` WS message includes `token`  
   **When** server processes the command  
   **Then** server upserts `player:{token}` Redis hash with `{ playerId, displayName, avatarPresetId, updatedAt }` — linking the persistent browser token to the current session's identity

## Tasks / Subtasks

- [x] Task 1: Add `player:{token}` key schema and helpers to `room-keys.ts` (AC: #1, #2, #3, #7)
  - [x] Add `playerKey(token: string): string` → `player:{token}`
  - [x] Define `PersistedPlayerFields` interface: `{ playerId, displayName, avatarPresetId, updatedAt }`
  - [x] Add `serializePlayer(p: PersistedPlayerFields): Record<string, string>`
  - [x] Add `deserializePlayer(h: Record<string, string>): PersistedPlayerFields` with try/catch + phase-style validation
  - [x] Write unit tests in `room-keys.test.ts` (or alongside existing tests): round-trip serialize/deserialize, missing-field error

- [x] Task 2: Add `POST /api/session` HTTP endpoint to game server (AC: #1, #2, #3)
  - [x] Add JSON body parsing helper in `create-game-server.ts` (read body buffer, parse JSON, guard on content-type)
  - [x] Handle `POST /api/session` route: read optional `{ token }` from body
  - [x] Add CORS headers so Next.js app on different port can call it
  - [x] Handle `OPTIONS /api/session` preflight with 204
  - [x] Add `PLAYER_TTL_S = 7776000` (90 days) constant to `room-keys.ts`
  - [x] Write unit tests for session endpoint logic (extract handler to testable function, inject redis stub)

- [x] Task 3: Add `hostToken` to room persistence (AC: #5)
  - [x] Add `hostToken: string` to `PersistedRoomFields` in `room-keys.ts`
  - [x] Update `serializeRoom` to include `hostToken`
  - [x] Update `deserializeRoom` to read `hostToken` (fallback empty string for legacy rooms)
  - [x] Add `hostToken` field to `Room` class in `apps/server/src/room/room.ts`
  - [x] In `RoomManager.createRoom`: generate `hostToken`; set on room; include in `writeRoomToRedis`
  - [x] `hostToken` not included in any broadcast events

- [x] Task 4: Add `hostToken` to `roomCreated` server event schema (AC: #5)
  - [x] Add `hostToken: z.string()` to `roomCreated` schema in `packages/shared/src/schemas.ts`
  - [x] Include `hostToken` in the `roomCreated` event in `handle-client-command.ts` (createRoom + reconnectHost paths)
  - [x] Add `token?: z.string().optional()` to `createRoom` and `joinRoom` client command schemas
  - [x] Update shared schema tests to cover `hostToken` in `roomCreated` and optional `token` in `createRoom`/`joinRoom`

- [x] Task 5: Server-side token→identity upsert on WS room entry (AC: #7)
  - [x] In `RoomManager.createRoom`: upsert `player:{token}` if token present
  - [x] In `RoomManager.joinRoom`: same upsert if token present
  - [x] In `RoomManager.reconnectHost` / `reconnectPlayer`: same upsert if token present
  - [x] Covered by session endpoint unit tests

- [x] Task 6: Web client — player token localStorage library (AC: #1, #2)
  - [x] Create `apps/web/src/features/lobby/lib/player-token.ts`
  - [x] `getStoredToken()`, `storeToken()`, `clearToken()`, `getOrCreatePlayerToken()`, `wsUrlToHttpUrl()` implemented
  - [x] Write unit tests (vitest, jsdom): all branches tested
  - [x] Existing `skribbl_session` sessionStorage untouched

- [x] Task 7: Wire token into host and guest WS connection (AC: #1, #2, #7)
  - [x] In `use-host-create-room.ts`: async IIFE resolves token before WS connect; token passed in `createRoom`
  - [x] In `use-guest-join-room.ts`: async IIFE resolves token before WS connect; token passed in `joinRoom`
  - [x] `wsUrlToHttpUrl` converts WS URL to HTTP for session API call
  - [x] Failure to resolve token returns empty string — does not block room entry

- [x] Task 8: Run full test suite and validate all ACs (AC: all)
  - [x] `pnpm --filter @skribbl/server test` — 77 tests pass
  - [x] `pnpm --filter @skribbl/shared test` — 94 tests pass
  - [x] `pnpm --filter @skribbl/web test` — 102 tests pass
  - [x] `pnpm -r exec tsc --noEmit` — no type errors

## Dev Notes

### What 8-0 Already Built (Do NOT Re-implement)

- Redis client abstraction: `apps/server/src/lib/redis/client.ts` — `RedisClient` interface, `RedisPipeline`, `getRedisClient()` singleton, `adaptIoRedis`, `adaptUpstash`. **AC #4 is already satisfied.**
- Room CRUD backed by Redis: `RoomManager` already calls `writeRoomToRedis` / `deleteRoomFromRedis`.
- TTL management: `ROOM_TTL_IDLE_S = 1800`, `ROOM_TTL_ACTIVE_S = 7200` constants in `room-keys.ts`. **AC #6 is already satisfied.**
- `stubRedis()` pattern in tests: injectable `RedisClient` stub in `room-manager.test.ts`.

### Existing Session System (Do NOT Break)

`apps/web/src/features/lobby/lib/session-storage.ts` uses **`sessionStorage`** with key `skribbl_session` and stores `{ roomId, roomCode, playerId, displayName, avatarPresetId, role }`. This handles per-tab reconnect (close tab = lose session). **Do not remove or change this.** Story 8-1 adds a **separate** `localStorage`-based player identity (`skribbl_pid` + `skribbl_player_id`) that persists across reloads and restarts.

### Redis Key Schema

```
player:{token}    HASH — { playerId, displayName, avatarPresetId, updatedAt }
                  TTL: 90 days (PLAYER_TTL_S = 7776000)
```

Extends existing keys in `room-keys.ts`:
```
room:{code}          HASH — existing (add hostToken field)
room-by-id:{id}      STRING — existing, unchanged
```

### Token Generation (No New Dep)

**Do NOT add `nanoid` as a dependency.** Use Node.js built-in:
```typescript
import { randomBytes, randomUUID } from "node:crypto";

function generateToken(): string {
  return randomBytes(16).toString("base64url").slice(0, 21);
}
```
This gives 21 URL-safe chars, ~128 bits entropy — equivalent to `nanoid(21)`.

### POST /api/session Implementation Pattern

Add to `create-game-server.ts` HTTP handler (alongside `/healthz`):

```typescript
if (req.method === "OPTIONS" && req.url?.split("?")[0] === "/api/session") {
  // CORS preflight
  res.writeHead(204, corsHeaders);
  res.end();
  return;
}

if (req.method === "POST" && req.url?.split("?")[0] === "/api/session") {
  const body = await readJsonBody(req); // helper: Buffer chunks → JSON.parse
  const result = await handleSessionRequest(redis, body);
  res.writeHead(200, { "Content-Type": "application/json", ...corsHeaders });
  res.end(JSON.stringify(result));
  return;
}
```

Extract `handleSessionRequest(redis, body)` as a pure-ish async function so it can be unit-tested without a real HTTP server.

### hostToken Field

`hostToken` is a new field on `Room` and in `PersistedRoomFields`. It is:
- Generated once in `createRoom` 
- Stored in Redis `room:{code}` HASH alongside other room fields
- Included in the `roomCreated` WS event to the host WS only
- Never sent in `roomJoined`, `statePatch`, `lobbyRoster`, or any other broadcast

`deserializeRoom` must handle the case where `hostToken` is absent (legacy rooms from 8-0 that predate this story) — use a fallback empty string or null. Don't throw on missing `hostToken` from Redis.

### Shared Schema Changes

In `packages/shared/src/schemas.ts`:

```typescript
// Add to createRoom command:
z.object({
  type: z.literal("createRoom"),
  displayName: z.string(),
  avatarPresetId: avatarPresetIdSchema.optional(),
  token: z.string().optional(),   // ← new, optional
})

// Add to joinRoom command:
z.object({
  type: z.literal("joinRoom"),
  roomCode: z.string(),
  displayName: z.string(),
  avatarPresetId: avatarPresetIdSchema.optional(),
  token: z.string().optional(),   // ← new, optional
})

// Add to roomCreated server event:
z.object({
  type: z.literal("roomCreated"),
  roomId: z.string(),
  roomCode: z.string(),
  phase: roomPhaseSchema,
  playerId: z.string(),
  displayName: z.string(),
  avatarPresetId: avatarPresetIdSchema,
  hostToken: z.string(),          // ← new, required
})
```

### WS URL → Session API URL Derivation (Web)

```typescript
// apps/web/src/features/lobby/lib/player-token.ts
function wsUrlToHttpUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://");
}
// Usage: getOrCreatePlayerToken(wsUrlToHttpUrl(process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001"))
```

### Testing Approach

- **`room-keys.test.ts`** (new or extend existing): unit-test `playerKey`, `serializePlayer`, `deserializePlayer` round-trip and error paths
- **`create-game-server.session.test.ts`** (new): extract `handleSessionRequest` → test with stubRedis; verify new-session path, reuse path, body without token
- **`player-token.test.ts`** (new in `apps/web`): use vitest + jsdom; mock `fetch`; test all branches of `getOrCreatePlayerToken`
- **Existing `room-manager.test.ts`**: extend to verify `hset(playerKey(token), ...)` called when `token` in cmd; also verify `hostToken` returned in `roomCreated`
- **`room-ws.integration.test.ts`**: add one test: `createRoom` with `token` → verify `roomCreated.hostToken` is a non-empty string

### Dependency Injection for Tests

`handleSessionRequest` signature:
```typescript
async function handleSessionRequest(
  redis: RedisClient,
  body: unknown
): Promise<{ token: string; playerId: string }>
```
Import `stubRedis` pattern from existing `room-manager.test.ts` (or extract to `test-helpers.ts`).

### Type Safety Notes

- `PersistedPlayerFields.avatarPresetId` is `AvatarPresetId` from `@skribbl/shared` — validate with `isValidAvatarPresetId` in `deserializePlayer`
- `updatedAt` stored as ISO string; deserialize back to string (not Date object — avoid serialization issues)
- All `token` fields: validate non-empty string; reject payloads with empty `""` token

### Files to Create

- `apps/server/src/lib/redis/room-keys.test.ts` (new, or extend if exists)
- `apps/server/src/create-game-server.session.test.ts` (new)
- `apps/web/src/features/lobby/lib/player-token.ts` (new)
- `apps/web/src/features/lobby/lib/player-token.test.ts` (new)

### Files to Modify

- `apps/server/src/lib/redis/room-keys.ts` — add `playerKey`, `PersistedPlayerFields`, `serializePlayer`, `deserializePlayer`, `PLAYER_TTL_S`; update `PersistedRoomFields` + `serializeRoom` + `deserializeRoom` for `hostToken`
- `apps/server/src/lib/redis/index.ts` — re-export new symbols
- `apps/server/src/create-game-server.ts` — add POST /api/session + CORS + OPTIONS
- `apps/server/src/room/room.ts` — add `hostToken: string` field
- `apps/server/src/room/room-manager.ts` — generate `hostToken` in `createRoom`; upsert `player:{token}` in create/join/reconnect paths; include `hostToken` in `roomCreated` event
- `packages/shared/src/schemas.ts` — add `token` to `createRoom`/`joinRoom`; add `hostToken` to `roomCreated`
- `packages/shared/src/schemas.test.ts` — cover new fields
- `apps/web/src/app/lobby/LobbyHostPage.tsx` — call `getOrCreatePlayerToken`, pass `token` in `createRoom`
- `apps/web/src/app/join/JoinRoomClient.tsx` — call `getOrCreatePlayerToken`, pass `token` in `joinRoom`

### Project Context Rules

- All wire message shapes defined in `@skribbl/shared` via Zod — never duplicate in `apps/web` or `apps/server`
- `@skribbl/shared` must not import React, `ws`, or Node-only APIs
- Server-authoritative: server generates tokens, not the client; client only stores and presents them
- Use `randomBytes` + `randomUUID` from `node:crypto` — do NOT add `nanoid` dependency
- Vitest for server and shared tests; existing stub pattern (`stubRedis`) for Redis mocking
- TypeScript strict mode: all Redis return types must be typed and null-checked
- `NEXT_PUBLIC_*` only for client-visible config (WS URL already exposed as `NEXT_PUBLIC_WS_URL`)
- Monorepo commands: `pnpm --filter @skribbl/server test`, `pnpm --filter @skribbl/shared test`

### References

- Epic 8 Story 8.1: `_bmad-output/planning-artifacts/epics.md` §Story 8.1
- Story 8-0 completion notes + file list: `_bmad-output/implementation-artifacts/8-0-migrate-room-manager-from-in-memory-map-to-redis-backed-store.md`
- Redis client: `apps/server/src/lib/redis/client.ts` — `RedisClient` interface, `RedisPipeline`, `getRedisClient()`
- Room key helpers: `apps/server/src/lib/redis/room-keys.ts` — `PersistedRoomFields`, `serializeRoom`, `deserializeRoom`, TTL constants
- Room class: `apps/server/src/room/room.ts`
- RoomManager: `apps/server/src/room/room-manager.ts` — `createRoom`, `joinRoom`, `reconnectHost`, `reconnectPlayer`
- Shared schemas: `packages/shared/src/schemas.ts` — `clientCommandSchema`, `serverEventSchema`
- Existing session storage (do not remove): `apps/web/src/features/lobby/lib/session-storage.ts`
- Host page: `apps/web/src/app/lobby/LobbyHostPage.tsx` (or `apps/web/src/features/lobby/components/LobbyHostPage.tsx`)
- Guest join page: `apps/web/src/app/join/JoinRoomClient.tsx`
- Project conventions: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fixed test using "cat" as avatarPresetId (not valid) — changed to "preset-1"
- Refactored cleanup in async IIFE hooks to capture WS ref before nulling it

### Completion Notes List

- Task 1: `playerKey`, `PersistedPlayerFields`, `serializePlayer`, `deserializePlayer`, `PLAYER_TTL_S` added to `room-keys.ts`; 8 unit tests pass
- Task 2: `handleSessionRequest` extracted as testable async function; `POST /api/session` + CORS + OPTIONS preflight added to `create-game-server.ts`; 6 unit tests pass
- Task 3: `hostToken` field added to `PersistedRoomFields`, `serializeRoom`, `deserializeRoom` (legacy fallback empty string), `Room` class, and `writeRoomToRedis` call
- Task 4: `hostToken: z.string()` added to `roomCreated` schema; `token?: z.string().optional()` added to `createRoom` and `joinRoom`; `hostToken` included in both `createRoom` and `reconnectHost` response paths; shared schema tests updated (47 pass)
- Task 5: Token→identity upsert via pipeline in `createRoom`, `joinRoom`, `reconnectHost`, `reconnectPlayer`
- Task 6: `apps/web/src/features/lobby/lib/player-token.ts` created with `getStoredToken`, `storeToken`, `clearToken`, `getOrCreatePlayerToken`, `wsUrlToHttpUrl`; 9 unit tests pass
- Task 7: Both `use-host-create-room.ts` and `use-guest-join-room.ts` wrap WS creation in async IIFE; token resolved before opening socket; empty string fallback on failure
- Task 8: 273 total tests pass, 0 failures; tsc --noEmit clean

### File List

- `apps/server/src/lib/redis/room-keys.ts` (modified)
- `apps/server/src/lib/redis/room-keys.test.ts` (new)
- `apps/server/src/lib/redis/index.ts` (modified)
- `apps/server/src/create-game-server.ts` (modified)
- `apps/server/src/create-game-server.session.test.ts` (new)
- `apps/server/src/room/room.ts` (modified)
- `apps/server/src/room/room-manager.ts` (modified)
- `apps/server/src/protocol/handlers/handle-client-command.ts` (modified)
- `packages/shared/src/schemas.ts` (modified)
- `packages/shared/src/schemas.test.ts` (modified)
- `apps/web/src/features/lobby/lib/player-token.ts` (new)
- `apps/web/src/features/lobby/lib/player-token.test.ts` (new)
- `apps/web/src/lib/ws-client.ts` (modified)
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts` (modified)
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts` (modified)

### Change Log

- 2026-05-08: Implemented story 8-1 — player token identity + POST /api/session + hostToken in room persistence and roomCreated event

### Review Findings

- [x] [Review][Decision] AC#2 — Client short-circuits on localStorage hit without re-validating token against Redis — dismissed: local-first behavior is intentional; spec wording clarified — `getOrCreatePlayerToken` returns stored value immediately if present, never calling `POST /api/session` with the token. Violates AC#2 if "reload" means "verify server-side validity". Intent needs clarification: is local-only lookup acceptable?
- [x] [Review][Decision] AC#3 — Redis `player:{token}` hash never read to restore identity after server restart — fixed: token now wired through reconnect schemas and serializers; upsert path active — `reconnectHost`/`reconnectPlayer` read from in-memory `awaitingReconnect` stash. After cold restart the stash is gone. Was AC#3 meant to support cold-restart reconnect, or only within-session resilience?
- [x] [Review][Decision] AC#7 — `reconnectHost`/`reconnectPlayer` schemas lack `token` field — fixed: added `token: z.string().min(1).optional()` to both schemas — Redis upsert in those methods is unreachable dead code. Was AC#7 meant to include reconnect paths? Simple fix if yes: add `token: z.string().optional()` to reconnect schemas.
- [x] [Review][Patch] Empty `displayName: ""` stored on new session creation triggers `deserializePlayer` throw on next read [apps/server/src/lib/redis/room-keys.ts] — fixed: check changed to `=== undefined || === null`
- [x] [Review][Patch] `void` pipeline on player-token upsert silences Redis errors with no logging [apps/server/src/room/room-manager.ts] — fixed: added `.catch()` with `log.error` to all 4 sites
- [x] [Review][Patch] Race condition: async IIFE / React cleanup — dismissed on close analysis: JS single-threaded, `closedByCleanup` check + `wsRef` capture correctly handle all timing
- [x] [Review][Patch] CORS wildcard `Access-Control-Allow-Origin: *` on session endpoint [apps/server/src/create-game-server.ts] — fixed: reads `CORS_ORIGIN` env var, defaults to `*` if unset
- [x] [Review][Patch] `token: z.string().optional()` accepts empty string [packages/shared/src/schemas.ts] — fixed: changed to `z.string().min(1).optional()` for createRoom/joinRoom/reconnectHost/reconnectPlayer
- [x] [Review][Patch] Legacy room `hostToken: ""` emitted in `reconnectHost → roomCreated` [apps/server/src/room/room-manager.ts] — fixed: generate new hostToken on reconnect if empty; `hostToken` schema uses `.min(1)`
- [x] [Review][Defer] Concurrent dual-tab `POST /api/session` calls can create duplicate player records (no `HSETNX`) [apps/server/src/create-game-server.ts] — deferred, pre-existing architectural gap; requires atomic Redis conditional-set redesign
- [x] [Review][Defer] Effect dependency arrays missing `displayName`/`avatarPresetId` in both lobby hooks — deferred, pre-existing pattern not introduced by this story
- [x] [Review][Defer] Token injection via crafted `localStorage` value (requires XSS as prerequisite) — deferred, out of scope; address in security story
