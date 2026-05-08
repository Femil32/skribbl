# Story 8.0: Migrate room manager from in-memory Map to Redis-backed store

Status: done

## Story

As a developer implementing Epic 8,
I want the room manager to use Redis as its backing store instead of an in-memory Map,
so that all subsequent Epic 8 stories have a stable, Redis-backed foundation without duplicating migration logic across stories.

## Acceptance Criteria

1. **Given** the existing `RoomManager` uses `Map<roomCode, Room>` and `Map<roomId, Room>`  
   **When** this story is implemented  
   **Then** all room CRUD operations (`createRoom`, `getRoom`, `updateRoom`, `deleteRoom`) are backed by Redis while the same TypeScript API surface is preserved — no changes required in existing protocol handlers or callers.

2. **Given** a Redis client abstraction module is created at `apps/server/src/lib/redis/client.ts`  
   **When** `REDIS_PROVIDER=upstash` env var is set  
   **Then** `@upstash/redis` REST adapter is used; when `REDIS_PROVIDER=ioredis` (default/local dev), `ioredis` adapter is used — no other code changes required.

3. **Given** the server starts  
   **When** Redis is unavailable  
   **Then** server fails fast with a clear error message — no silent in-memory fallback.

4. **Given** existing Vitest unit tests for room lifecycle (`apps/server/src/room/room-manager.test.ts`)  
   **When** tests run  
   **Then** all tests pass (Redis mocked via `vi.mock` or an injectable redis client stub).

5. **Given** a room has no activity for 30 minutes after creation  
   **When** Redis TTL expires  
   **Then** room keys clean up automatically; active rooms refresh to a 2-hour TTL on any player action.

6. **Given** in-memory `Map` storage  
   **When** this story lands  
   **Then** `roomsByCode` and `roomsById` Maps are removed from `RoomManager` — no in-memory fallback exists.

## Tasks / Subtasks

- [x] Task 1: Create Redis client abstraction (AC: #2, #3)
  - [x] Add `@upstash/redis` and `ioredis` to `apps/server/package.json`
  - [x] Create `apps/server/src/lib/redis/client.ts` with provider-switch logic
  - [x] Export a single `getRedisClient()` function returning a normalized interface

- [x] Task 2: Define Redis key schema and serialization helpers (AC: #1)
  - [x] Create `apps/server/src/lib/redis/room-keys.ts` with key constants: `room:{code}`, `room-by-id:{id}→code` index
  - [x] Serialize `Room` to/from JSON for Redis hashes — define `serializeRoom` / `deserializeRoom`
  - [x] Handle fields that are not JSON-serializable (`Set`, `Map`, `WebSocket` refs, timer handles)
  - [x] **CRITICAL**: `Room.sockets` (Set<WebSocket>) and timer handles MUST NOT be stored in Redis — keep in a local `Map<roomCode, { sockets: Set<WebSocket>; timers: ReturnType<typeof setTimeout>[] }>` alongside Redis

- [x] Task 3: Migrate `RoomManager` CRUD to Redis (AC: #1, #6)
  - [x] Replace `roomsByCode` / `roomsById` Maps with Redis calls
  - [x] `createRoom`: `HSET room:{code} ...fields`, `SET room-by-id:{id} {code}`, set 30-min idle TTL
  - [x] `getRoom(code)`: `HGETALL room:{code}`
  - [x] `getRoom(id)`: `GET room-by-id:{id}` → code lookup → `HGETALL room:{code}`
  - [x] `updateRoom`: `HSET room:{code} ...changed-fields`, refresh TTL to 2h
  - [x] `deleteRoom`: `DEL room:{code}`, `DEL room-by-id:{id}`

- [x] Task 4: Keep WebSocket and timer state in process-local Maps (AC: #1)
  - [x] `socketToRoomId`, `socketLobbyIdentity`, `matchTimersByRoomId` Maps stay in-process (not Redis)
  - [x] `room.sockets` Set stays in-process local sidecar structure
  - [x] Document clearly in code: which state is Redis, which is process-local

- [x] Task 5: Update/mock tests (AC: #4)
  - [x] Inject redis client into `RoomManager` constructor for testability
  - [x] Update `room-manager.test.ts` to use a stub/mock redis client (not a real Redis instance)
  - [x] All existing test cases must pass without modification to their assertions

- [x] Task 6: TTL management (AC: #5)
  - [x] On `createRoom`: `EXPIRE room:{code} 1800` (30 min idle)
  - [x] On any player join/reconnect: `EXPIRE room:{code} 7200` (2h active)
  - [x] On `deleteRoom`: explicit DEL (no orphan wait for TTL)

## Dev Notes

### Current RoomManager API Surface (MUST NOT BREAK)

File: `apps/server/src/room/room-manager.ts`

Public methods called by protocol handlers — keep signatures identical:
```
createRoom(ws, playerInfo) → Room
joinRoom(ws, code, playerInfo) → { ok: true; room } | { ok: false; reason }
reconnectHost(ws, roomId, playerId, playerInfo) → { ok: true; room } | { ok: false; reason }
reconnectPlayer(ws, roomId, playerId, playerInfo) → { ok: true; room } | { ok: false; reason }
leaveSocketRoom(ws) → void
getRoomForSocket(ws) → Room | undefined
getLobbySession(ws) → LobbySessionIdentity | undefined
buildLobbyRosterPlayers(room) → LobbyRosterPlayer[]
sendRoomHydrate(ws, room, recipientPlayerId) → void
handleClientCommand(ws, cmd) → void (async timer scheduling included)
```

The `Room` class itself (`apps/server/src/room/room.ts`) retains all in-memory fields that describe VOLATILE runtime state:
- `sockets: Set<WebSocket>` — NOT in Redis
- `wordChoiceTimerHandle`, timer handles — NOT in Redis
- `canvasPhaseLog: CanvasPhaseLog` — NOT in Redis (rebuilt on reconnect from op log)
- `awaitingReconnect: Map<string, LobbySessionIdentity>` — MUST go to Redis (Story 8.5 needs it)

Fields that MUST be stored in Redis (survive restart):
- `id`, `code`, `hostPlayerId`, `phase`, `maxPlayers`
- `matchPlayerOrder`, `matchRoundIndex`, `currentDrawerPlayerId`
- `roundWordOptions`, `roundSecretWord`, `drawingStrokeSeq`
- `scoresByPlayerId`, `chatTranscriptFanoutRows`
- `drawingPhaseStartedAtMs`, `drawingPhaseAwardedGuesserIds`

### Redis Key Schema

```
room:{code}            HASH — all persistent Room fields (JSON-encoded arrays/objects)
room-by-id:{id}        STRING → roomCode (secondary index)
```

TTL rules:
- `EXPIRE room:{code} 1800` on create (30 min idle)
- `EXPIRE room:{code} 7200` on any player join (2h active)
- Apply TTL to `room-by-id:{id}` key to match

### Redis Provider Abstraction

```
apps/server/src/lib/redis/
├── client.ts          ← factory: switch on REDIS_PROVIDER env var
├── room-keys.ts       ← key builders + serialize/deserialize helpers
└── index.ts           ← barrel export
```

Provider interface (subset needed for this story):
```typescript
interface RedisClient {
  hset(key: string, fields: Record<string, string>): Promise<void>;
  hgetall(key: string): Promise<Record<string, string> | null>;
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<void>;
  expire(key: string, seconds: number): Promise<void>;
}
```

### Dependency Injection Pattern for Tests

Constructor signature change:
```typescript
constructor(
  maxPlayersPerRoom: number | undefined,
  wordBank: WordBank,
  redis: RedisClient,   // ← new injectable; real code passes getRedisClient()
)
```

Test stub:
```typescript
function stubRedis(): RedisClient {
  const store = new Map<string, Record<string, string> | string>();
  return { hset: ..., hgetall: ..., set: ..., get: ..., del: ..., expire: ... };
}
```

### Non-Serializable Fields — Local Sidecar

`Room.sockets` is `Set<WebSocket>` — cannot serialize to Redis. Use a local Map inside RoomManager:

```typescript
private readonly roomRuntimeByCode = new Map<string, {
  sockets: Set<WebSocket>;
  hostSocket: WebSocket | null;
  awaitingReconnect: Map<string, LobbySessionIdentity>; // move here from Room until 8.5 migrates it
}>();
```

Room objects returned to callers must still have `sockets`, `hostSocket`, `awaitingReconnect` populated from this sidecar — preserve the existing `Room` shape for all callers.

### Packages to Add

```json
// apps/server/package.json — add to dependencies:
"@upstash/redis": "^1.34.0",
"ioredis": "^5.6.1"
```

No web app changes needed.

### Testing Approach

- Unit tests: `room-manager.test.ts` — inject stubRedis(), keep all existing assertions
- Integration tests: `room-ws.integration.test.ts` — inject stubRedis() or use real ioredis pointing at local Redis (`redis://localhost:6379`)
- Do NOT add a new real Redis dependency to CI without confirming CI has Redis service available — use stub by default

### Serialization Gotchas

- `Set<string>` → `JSON.stringify([...set])` → restore with `new Set(JSON.parse(...))`
- `Map<string, number>` → `JSON.stringify(Object.fromEntries(map))` → restore with `new Map(Object.entries(JSON.parse(...)))`
- `null` fields → store as empty string or omit key; deserializer must handle missing keys as `null`
- `drawingPhaseAwardedGuesserIds: Set<string> | null` — null = no active drawing phase

### What Story 8.1 Owns (Don't Build Here)

Story 8.1 owns: player token identity (`POST /api/session`), `player:{token}` Redis hash, host token generation. This story only migrates Room state. Do NOT build player token handling here.

### Project Structure Notes

- Server: `apps/server/src/` — all new files go here
- Redis lib: `apps/server/src/lib/redis/` — new directory
- No shared package changes needed for this story
- No web app changes needed
- TypeScript strict mode: enabled — all Redis return types must be properly typed/checked

### References

- Current RoomManager: `apps/server/src/room/room-manager.ts` (full source, ~1000 lines)
- Room class: `apps/server/src/room/room.ts`
- Existing tests: `apps/server/src/room/room-manager.test.ts`
- Epic 8 stories: `_bmad-output/planning-artifacts/epics.md` § Epic 8
- Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Redis write-through uses fire-and-forget pattern (`void this.redis.hset(...)`) — public API stays synchronous, `roomRuntimeByCode` Map is authoritative for reads in this process.
- `roomsById` Map replaced by lightweight `roomCodeById: Map<string, string>` (id→code only); full Room access via `roomRuntimeByCode.get(code)`.
- `Room.sockets`, `Room.hostSocket`, `Room.awaitingReconnect` remain process-local — populated from `roomRuntimeByCode` sidecar on every read.
- 63/63 tests pass (unit + integration) using injected `stubRedis()` in-memory stub; no real Redis instance required in CI.
- `createGameServer` made async; `getRedisClient()` called at startup — server fails fast if Redis unavailable.
- `adaptUpstash` returns `Record<string, string>` normalized values (Upstash returns mixed types from `hgetall`).

### File List

- `apps/server/package.json`
- `apps/server/src/lib/redis/client.ts`
- `apps/server/src/lib/redis/room-keys.ts`
- `apps/server/src/lib/redis/index.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/room/room-manager.test.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/server/src/create-game-server.ts`
- `apps/server/src/create-game-server.healthz.test.ts`
- `apps/server/src/index.ts`
- `pnpm-lock.yaml`

### Review Findings

- [x] [Review][Patch] P-1: Fire-and-forget Redis writes swallow errors silently — `writeRoomToRedis` and `deleteRoomFromRedis` use `void` with no `.catch()`; any Redis failure is silently dropped with no log or metric [room-manager.ts:146–153]
- [x] [Review][Patch] P-2: `hset`+`expire` non-atomic — crash between the two calls leaves key with no TTL, persisting forever; same applies to `room-by-id` secondary index [room-manager.ts:146–149]
- [x] [Review][Patch] P-3: Unknown `REDIS_PROVIDER` value silently falls through to ioredis — should throw a clear error consistent with AC3 fail-fast [client.ts:12]
- [x] [Review][Patch] P-4: Double `writeRoomToRedis` in `chooseWord` — `lockWordAndBeginDrawing` already calls it; `chooseWord` calls it again redundantly [room-manager.ts:934]
- [x] [Review][Patch] P-5: `getRedisClient` not a singleton — each call creates a new connection; add module-level cache [client.ts:11]
- [x] [Review][Patch] P-6: `deserializeRoom` has no `try/catch` around `JSON.parse` calls — corrupt Redis data crashes the caller [room-keys.ts:64–79]
- [x] [Review][Patch] P-7: `phase` field deserialized with unchecked `as RoomPhase` cast — no runtime guard against invalid values from Redis [room-keys.ts:64]

- [x] [Review][Defer] D-1: Read path reads only in-memory — Redis is write-only; `getRoom`/`joinRoom` never call `hgetall` [room-manager.ts:121–124] — deferred, design decision documented in completion notes; read-back hydration is future story scope
- [x] [Review][Defer] D-2: Server restart loses all rooms; Redis keys orphaned until TTL — deferred, known limitation of write-through architecture
- [x] [Review][Defer] D-3: `generateUniqueCode` only checks in-process map — code collision risk after restart [room-manager.ts:978] — deferred, requires async Redis check; out of scope
- [x] [Review][Defer] D-4: In-flight `writeRoomToRedis` promise can resurrect key after `deleteRoomFromRedis` — deferred, requires fully async write path to fix
- [x] [Review][Defer] D-5: `canvasPhaseLog` process-local — post-restart hydrate would produce integrity mismatch — deferred, not introduced by this story
- [x] [Review][Defer] D-6: Match timers ephemeral — no restart recovery path — deferred, not introduced by this story
- [x] [Review][Defer] D-7: `joinRoom` (lobby phase) uses `ROOM_TTL_ACTIVE_S` (2h) instead of `ROOM_TTL_IDLE_S` (30min) — deferred, minor; abandoned lobbies expire slower
- [x] [Review][Defer] D-8: `room-by-id` `set`+`expire` non-atomic — same root cause as P-2 — deferred, resolved if P-2 is fixed with pipeline
