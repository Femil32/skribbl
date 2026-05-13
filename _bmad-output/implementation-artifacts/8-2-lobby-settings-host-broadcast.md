# Story 8.2: Lobby settings host broadcast

Status: done

## Story

As a host,
I want changes I make to match settings (rounds, draw time, max players, word pack, hints, AFK skip, voice) to appear instantly for all players in the lobby,
So that everyone sees the same configuration before the game starts.

## Acceptance Criteria

1. **Given** host emits `updateSettings` with a partial settings object  
   **When** server receives the message  
   **Then** `UpdateSettingsSchema` (Zod, `@skribbl/shared`) validates the payload — invalid fields rejected with `error { code: "VALIDATION_ERROR" }`

2. **Given** sender's `playerId !== room.hostPlayerId` (i.e. `hostSocket !== actor`)  
   **When** `updateSettings` arrives  
   **Then** server returns `error { code: "NOT_HOST" }` — room state unchanged

3. **Given** valid host settings update  
   **When** server merges partial settings into `room.settings` in Redis  
   **Then** `settingsUpdated` broadcast reaches all connected room members within 100ms  
   **And** late-joining players receive current `settings` object in their `roomJoined` response

4. **Given** `startMatch` has already been emitted  
   **When** host sends `updateSettings`  
   **Then** server returns `error { code: "MATCH_IN_PROGRESS" }` — settings locked once match starts

5. **Given** host sets `maxPlayers` below current player count  
   **When** server validates the settings  
   **Then** server rejects with `error { code: "VALIDATION_ERROR", detail: "maxPlayers below current count" }`

6. **Given** `allowVoice` setting is updated  
   **When** stored and broadcast  
   **Then** server treats it as a UI flag only — no WebRTC signaling required server-side

## Tasks / Subtasks

- [x] Task 1: Define `RoomSettings` type and `updateSettings`/`settingsUpdated` schemas in `@skribbl/shared` (AC: #1, #3, #5)
  - [x] Add `roomSettingsSchema` Zod object with all 7 fields (see Dev Notes for exact fields + constraints)
  - [x] Add `updateSettingsSchema` command: `{ type: "updateSettings", settings: z.partial(roomSettingsSchema) }`
  - [x] Add `settingsUpdatedSchema` server event: `{ type: "settingsUpdated", roomId: string, settings: roomSettingsSchema }`
  - [x] Add `settings` field to `roomJoined` server event: `settings: roomSettingsSchema`
  - [x] Export `RoomSettings`, `UpdateSettings`, `SettingsUpdated` inferred types
  - [x] Add unit tests in `packages/shared/src/schemas.test.ts` covering: valid full update, valid partial update, extra fields rejected, invalid `rounds` range, `maxPlayers` out of range

- [x] Task 2: Add `settings` field to `Room` class and `PersistedRoomFields` (AC: #3, #4)
  - [x] Add `settings: RoomSettings` field to `Room` class in `apps/server/src/room/room.ts`
  - [x] Initialize with defaults from `DEFAULT_ROOM_SETTINGS` constant
  - [x] Add `settings` to `PersistedRoomFields` interface in `apps/server/src/lib/redis/room-keys.ts`
  - [x] Update `serializeRoom` to JSON-stringify the settings object
  - [x] Update `deserializeRoom` to JSON-parse settings with safe fallback to `DEFAULT_ROOM_SETTINGS` for legacy rooms
  - [x] No new tests needed here — covered by integration tests in Task 5

- [x] Task 3: Implement `updateSettings` handler in `RoomManager` (AC: #1, #2, #3, #4, #5, #6)
  - [x] Add `updateSettings(actor: WebSocket, partial: Partial<RoomSettings>): { ok: true } | { ok: false; code: string; detail?: string }` method
  - [x] Guard: `actor !== room.hostSocket` → `{ ok: false, code: "NOT_HOST" }`
  - [x] Guard: `room.phase !== "lobby"` → `{ ok: false, code: "MATCH_IN_PROGRESS" }`
  - [x] Guard: `partial.maxPlayers !== undefined && partial.maxPlayers < room.sockets.size` → `{ ok: false, code: "VALIDATION_ERROR", detail: "maxPlayers below current count" }`
  - [x] Merge `partial` into `room.settings` (only valid keys from schema)
  - [x] Call `writeRoomToRedis(room)` (existing pattern from RoomManager)
  - [x] Broadcast `settingsUpdated { type, roomId, settings: room.settings }` to all sockets in room
  - [x] Add unit tests in `apps/server/src/room/room-manager.test.ts`: NOT_HOST, MATCH_IN_PROGRESS, maxPlayers-below-count, valid partial merge + broadcast, full settings replace

- [x] Task 4: Wire `updateSettings` into protocol handler (AC: #1)
  - [x] Add `case "updateSettings"` to `handle-client-command.ts`
  - [x] Parse with `updateSettingsSchema` before calling `roomManager.updateSettings`
  - [x] Emit `error { code }` on `{ ok: false }` result (match existing error pattern)

- [x] Task 5: Include `settings` in `roomJoined` response (AC: #3 — late joiners)
  - [x] In `RoomManager.joinRoom`, include `settings: room.settings` in the `roomJoined` event
  - [x] In `RoomManager.reconnectHost` and `reconnectPlayer`, include `settings: room.settings` in `roomJoined`/`roomCreated` responses as applicable
  - [x] Update `room-manager.test.ts` to verify settings included in `roomJoined`

- [x] Task 6: Web — wire Zustand settings store actions to `updateSettings` WS command (AC: #3 client-side)
  - [x] In `lobby-settings-store.ts`, wrap each setter to also call `sendUpdateSettings(partial)` if connected
  - [x] OR: add a `useLobbySettings` hook in `apps/web/src/features/lobby/hooks/use-lobby-settings.ts` that wraps setters and calls `sendGameJsonLine(JSON.stringify({ type: "updateSettings", settings: partial }))` via the existing `sendGameJsonLine` ref
  - [x] Handle incoming `settingsUpdated` event in `useHostCreateRoom` event handler to sync store from server
  - [x] Handle `settingsUpdated` in guest WS hook so guest UI reflects host changes in read-only mode
  - [x] On `roomJoined`, read `settings` field and hydrate Zustand store
  - [x] Add `data-testid="settings-rounds"` etc. on stepper inputs for E2E

- [x] Task 7: Run full test suite and validate all ACs (AC: all)
  - [x] `pnpm --filter @skribbl/shared test` — all pass (106 tests)
  - [x] `pnpm --filter @skribbl/server test` — all pass (83 tests, +6 new updateSettings tests)
  - [x] `pnpm --filter @skribbl/web test` — all pass (113 tests)
  - [x] `pnpm -r exec tsc --noEmit` — no type errors

## Dev Notes

### Settings Schema (exact fields + Zod constraints)

Define `DEFAULT_ROOM_SETTINGS` as a plain const in `apps/server/src/config/game.ts` (server) and export `roomSettingsSchema` from `@skribbl/shared`:

```typescript
// packages/shared/src/schemas.ts
export const roomSettingsSchema = z.object({
  rounds:     z.number().int().min(1).max(20),
  drawTime:   z.number().int().min(20).max(240),     // seconds
  maxPlayers: z.number().int().min(2).max(12),
  wordPack:   z.enum(["classic", "cryptids", "foods", "movies", "custom"]),
  showHints:  z.boolean(),
  skipAfk:    z.boolean(),
  allowVoice: z.boolean(),
});
export type RoomSettings = z.infer<typeof roomSettingsSchema>;

// Add to clientCommandSchema union:
z.object({
  type: z.literal("updateSettings"),
  settings: roomSettingsSchema.partial(),
})

// Add to serverEventSchema union:
z.object({
  type: z.literal("settingsUpdated"),
  roomId: z.string(),
  settings: roomSettingsSchema,
})
```

**IMPORTANT:** `wordPack` values must match `WORD_PACKS` from `apps/web/src/features/lobby/design/tokens.ts` — IDs are `"classic" | "cryptids" | "foods" | "movies" | "custom"`. Use `z.enum([...])` with these exact strings. Do NOT import from web into shared — hardcode the same enum values in the shared schema.

### Default Settings

```typescript
// apps/server/src/config/game.ts
export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  rounds: 6,
  drawTime: 80,
  maxPlayers: 8,   // matches DEFAULT_MAX_PLAYERS
  wordPack: "classic",
  showHints: true,
  skipAfk: true,
  allowVoice: false,
};
```

Note: `lobby-settings-store.ts` already uses these exact values as its initial state — no mismatch.

### Room class change

```typescript
// apps/server/src/room/room.ts
import type { RoomSettings } from "@skribbl/shared";
import { DEFAULT_ROOM_SETTINGS } from "../config/game.js";

export class Room {
  // ... existing fields ...
  settings: RoomSettings = { ...DEFAULT_ROOM_SETTINGS };
  // ...
}
```

### RoomManager.updateSettings pattern

Follow exact same Result-style pattern as `startMatch`:

```typescript
updateSettings(
  actor: WebSocket,
  partial: Partial<RoomSettings>
): { ok: true } | { ok: false; code: string; detail?: string } {
  const room = this.getRoomForSocket(actor);
  if (!room) return { ok: false, code: "NOT_IN_ROOM" };
  if (room.hostSocket !== actor) return { ok: false, code: "NOT_HOST" };
  if (room.phase !== "lobby") return { ok: false, code: "MATCH_IN_PROGRESS" };
  if (
    partial.maxPlayers !== undefined &&
    partial.maxPlayers < room.sockets.size
  ) {
    return { ok: false, code: "VALIDATION_ERROR", detail: "maxPlayers below current count" };
  }
  room.settings = { ...room.settings, ...partial };
  void this.writeRoomToRedis(room).catch((err) => {
    log.error({ err }, "Redis settings write failed");
  });
  const event = JSON.stringify({ type: "settingsUpdated", roomId: room.id, settings: room.settings });
  for (const ws of room.sockets) {
    if (ws.readyState === ws.OPEN) ws.send(event);
  }
  return { ok: true };
}
```

### Protocol handler (handle-client-command.ts)

Add after existing `case "startMatch"` block:

```typescript
case "updateSettings": {
  const parsed = updateSettingsSchema.safeParse(cmd);  // cmd already parsed by clientCommandSchema
  // clientCommandSchema union already validated — cmd.settings is Partial<RoomSettings>
  const outcome = roomManager.updateSettings(ws, cmd.settings);
  if (!outcome.ok) {
    sendError(ws, outcome.code, outcome.detail);
  }
  break;
}
```

Use the existing `sendError(ws, code, detail?)` helper pattern.

### roomJoined — include settings

In `RoomManager.joinRoom` (and reconnect paths), add `settings: room.settings` to the event payload. The `roomJoinedSchema` must be updated in shared to include `settings: roomSettingsSchema`.

### Web — settings sync pattern

The cleanest approach: keep Zustand store as single source of truth for UI, but sync bidirectionally:

1. **Host changes setting** → Zustand setter called → also call `sendGameJsonLine(JSON.stringify({ type: "updateSettings", settings: { [key]: newValue } }))` 
2. **`settingsUpdated` event received** (host or guest) → call Zustand setters to update all fields from `event.settings`
3. **`roomJoined` received** → hydrate Zustand store from `event.settings`

The `useLobbySettingsStore` setters are already wired to the UI in `LobbyHostPage.tsx` — only the network sync layer is missing.

**Recommended: create `apps/web/src/features/lobby/hooks/use-lobby-settings.ts`:**

```typescript
// Wraps the store and provides a sendSettings(partial) that calls sendGameJsonLine
export function useLobbySettingsSync(
  sendGameJsonLine: (raw: string) => void,
  isHost: boolean
) {
  const store = useLobbySettingsStore();
  const sendSettings = useCallback((partial: Partial<RoomSettings>) => {
    if (!isHost) return;
    sendGameJsonLine(JSON.stringify({ type: "updateSettings", settings: partial }));
  }, [sendGameJsonLine, isHost]);
  return { store, sendSettings };
}
```

**Handle incoming `settingsUpdated` in `useHostCreateRoom` dispatch:**

```typescript
case "settingsUpdated": {
  const s = event.settings;
  useLobbySettingsStore.setState(s); // or call individual setters
  break;
}
```

Note: Calling `useLobbySettingsStore.setState(s)` directly (Zustand's static API) is safe outside React and won't cause extra re-renders via the store's subscription.

### Redis serialization for settings

```typescript
// serializeRoom — add:
settings: JSON.stringify(r.settings),

// deserializeRoom — add:
settings: h["settings"] ? (JSON.parse(h["settings"]) as RoomSettings) : { ...DEFAULT_ROOM_SETTINGS },
```

No migration needed for legacy rooms — `deserializeRoom` falls back to defaults on missing key.

### What NOT to do

- Do NOT move `DEFAULT_MAX_PLAYERS` out of `game.ts` — it's still used for room creation. `maxPlayers` in `RoomSettings` is the per-room configurable value; the env-based `resolveMaxPlayers()` sets the initial default only.
- Do NOT change `Room.maxPlayers` (readonly field used by `hasCapacity()`) — instead, update `hasCapacity()` to read from `room.settings.maxPlayers` OR keep `Room.maxPlayers` mutable and sync it from `room.settings.maxPlayers` on update. **Recommended:** make `room.maxPlayers` a getter `get maxPlayers() { return this.settings.maxPlayers; }` and remove the constructor assignment.
- Do NOT add WebRTC signaling for `allowVoice` — it's a UI flag only per spec.
- Do NOT send `updateSettings` from guest clients — guard at both server (NOT_HOST) and client (isHost check before calling sendSettings).

### Testing Approach

**`packages/shared/src/schemas.test.ts`** — add tests:
- `updateSettings` with all fields → parses
- `updateSettings` with partial → parses  
- `updateSettings` with extra unknown field → fails (strict mode)
- `settingsUpdated` round-trip
- `roomJoined` now includes `settings`

**`apps/server/src/room/room-manager.test.ts`** — add tests:
- `updateSettings` NOT_HOST guard
- `updateSettings` MATCH_IN_PROGRESS guard (phase = "drawing")
- `updateSettings` maxPlayers-below-count guard
- valid partial merge: only changed fields updated, others preserved
- broadcast sent to all room sockets
- Redis write called after update

### Files to Create

- `apps/web/src/features/lobby/hooks/use-lobby-settings.ts` (new — optional helper)

### Files to Modify

- `packages/shared/src/schemas.ts` — add `roomSettingsSchema`, `updateSettings` command, `settingsUpdated` event; add `settings` to `roomJoined`
- `packages/shared/src/schemas.test.ts` — cover new schemas
- `apps/server/src/config/game.ts` — add `DEFAULT_ROOM_SETTINGS`
- `apps/server/src/room/room.ts` — add `settings: RoomSettings` field (and optionally convert `maxPlayers` to getter)
- `apps/server/src/lib/redis/room-keys.ts` — add `settings` to `PersistedRoomFields`, `serializeRoom`, `deserializeRoom`
- `apps/server/src/room/room-manager.ts` — add `updateSettings` method; include `settings` in `roomJoined`/`roomCreated` events
- `apps/server/src/protocol/handlers/handle-client-command.ts` — add `case "updateSettings"`
- `apps/server/src/room/room-manager.test.ts` — new test cases
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts` — handle `settingsUpdated` event; hydrate store from `roomJoined.settings`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts` — handle `settingsUpdated`; hydrate store from `roomJoined.settings`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx` — wire setting changes to `sendGameJsonLine`

### Project Context Rules

- All wire message shapes in `@skribbl/shared` — never duplicate in apps
- `@skribbl/shared` must not import React, `ws`, or Node-only APIs
- Server-authoritative: server merges settings, stores in Redis, broadcasts full settings object
- Use existing `stubRedis()` pattern for Redis mocking in tests
- TypeScript strict mode — all new interfaces fully typed
- `pnpm --filter @skribbl/<pkg> <cmd>` for workspace commands
- Result-style returns `{ ok: true } | { ok: false; code: string }` — no thrown exceptions over WS
- Existing error emission pattern: `sendError(ws, code, detail?)` helper in `handle-client-command.ts`
- Read `apps/web/AGENTS.md` before touching Next.js — this Next.js version has breaking changes

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Added `roomSettingsSchema` (7 fields) to `@skribbl/shared/schemas.ts` before room phase schema; also exported `RoomSettings`, `UpdateSettings`, `SettingsUpdatedEvent`, `WordPackId` types
- Added `updateSettings` to `clientCommandSchema` discriminated union; added `settingsUpdated` to `serverEventSchema`; made `settings` optional in `roomJoined` for backward compat
- `Room.maxPlayers` converted from readonly constructor field to getter `get maxPlayers() { return this.settings.maxPlayers; }` — `hasCapacity()` unchanged, naturally reads from settings
- `DEFAULT_ROOM_SETTINGS` added to `apps/server/src/config/game.ts` (rounds:6, drawTime:80, maxPlayers:8, wordPack:classic, showHints:true, skipAfk:true, allowVoice:false)
- `updateSettings` in RoomManager uses `this.sendEvent()` helper (validates via schema before sending) — ensures corrupt state fails loudly
- `settings` serialized/deserialized in Redis; legacy rooms fall back to `DEFAULT_ROOM_SETTINGS` on missing key
- `joinRoom` and `reconnectPlayer` cases in `handle-client-command.ts` both include `settings: room.settings` in `roomJoined` event
- Web: created `use-lobby-settings.ts` hook; added `serializeUpdateSettingsCommand` to `ws-client.ts`; wired all 7 setting controls in `LobbyHostPage` to `sendSettings`; handled `settingsUpdated` in both host and guest WS hooks
- 302 total tests pass (106 shared + 83 server + 113 web); 0 TypeScript errors

### File List

- `packages/shared/src/schemas.ts` — added roomSettingsSchema, updateSettings command, settingsUpdated event, settings to roomJoined, exported types
- `packages/shared/src/index.ts` — exported new types
- `packages/shared/src/schemas.test.ts` — added 23 new tests for roomSettingsSchema, updateSettings, settingsUpdated, roomJoined+settings
- `apps/server/src/config/game.ts` — added DEFAULT_ROOM_SETTINGS
- `apps/server/src/room/room.ts` — added settings field, converted maxPlayers to getter, imported RoomSettings and DEFAULT_ROOM_SETTINGS
- `apps/server/src/lib/redis/room-keys.ts` — added settings to PersistedRoomFields, serializeRoom, deserializeRoom
- `apps/server/src/room/room-manager.ts` — added updateSettings method, added settings to writeRoomToRedis call, imported RoomSettings
- `apps/server/src/protocol/handlers/handle-client-command.ts` — added case "updateSettings", added settings to joinRoom and reconnectPlayer roomJoined events
- `apps/server/src/room/room-manager.test.ts` — added 6 updateSettings tests
- `apps/web/src/lib/ws-client.ts` — added serializeUpdateSettingsCommand
- `apps/web/src/features/lobby/hooks/use-lobby-settings.ts` — new file: useLobbySettingsSync hook
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts` — handle settingsUpdated and roomJoined.settings
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts` — handle settingsUpdated and roomJoined.settings
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx` — wire all 7 settings controls to sendSettings, add data-testid attributes

### Change Log

- Story 8.2 implemented: lobby settings host broadcast (Date: 2026-05-12)

### Review Findings

- [x] [Review][Decision] maxPlayers validation uses `room.sockets.size` — resolved: keep sockets.size (active connections only); stashed-session edge case accepted

- [x] [Review][Patch] reconnectHost path missing settings — added `settings: room.settings` to both `roomCreated` emissions; added `settings` field to `roomCreated` schema [apps/server/src/protocol/handlers/handle-client-command.ts, packages/shared/src/schemas.ts]
- [x] [Review][Patch] `writeRoomToRedis` fire-and-forget — confirmed internal `.catch()` already present in method; no call-site change needed [apps/server/src/room/room-manager.ts]
- [x] [Review][Patch] `settings` field on `roomJoined` schema was `.optional()` — changed to required; updated backward-compat test to expect rejection [packages/shared/src/schemas.ts]
- [x] [Review][Patch] Unknown keys not filtered before spreading into `room.settings` — added `knownKeys` filter; only valid `RoomSettings` keys applied [apps/server/src/room/room-manager.ts]
- [x] [Review][Patch] `as RoomSettings` cast without Zod parse — removed casts; `safeParseServerEvent` already validates via Zod; removed unused `RoomSettings` imports [apps/web/src/features/lobby/hooks/use-host-create-room.ts, use-guest-join-room.ts]
- [x] [Review][Patch] Empty partial `{}` triggers unnecessary Redis write + broadcast — added early return guard [apps/server/src/room/room-manager.ts]
- [x] [Review][Patch] `WordPackId` type manually duplicated — changed to `z.infer<typeof roomSettingsSchema.shape.wordPack>` [packages/shared/src/schemas.ts]
- [x] [Review][Patch] `wordPack` control missing `data-testid` — added `data-testid="settings-wordPack-{wp.id}"` per button; also fixed biome comma-operator lint warning [apps/web/src/features/lobby/components/LobbyHostPage.tsx]

- [x] [Review][Defer] No debounce on `sendSettings` — rapid stepper input floods server with Redis writes + broadcasts [apps/web/src/features/lobby/components/LobbyHostPage.tsx] — deferred, pre-existing UX pattern; out of story scope
- [x] [Review][Defer] `deserializeRoom` throws on corrupt JSON settings — no graceful fallback to defaults on parse error [apps/server/src/lib/redis/room-keys.ts] — deferred, pre-existing error handling pattern
- [x] [Review][Defer] Client settings desync if server rejects `updateSettings` — Zustand already updated but server error means no settingsUpdated broadcast; no rollback [apps/web/src/features/lobby/components/LobbyHostPage.tsx] — deferred, enhancement for future story
