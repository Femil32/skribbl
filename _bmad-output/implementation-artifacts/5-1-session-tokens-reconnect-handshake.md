# Story 5.1: Session tokens & reconnect handshake

Status: review

<!-- gds-create-story (2026-05-05). Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a dropped player,

I want to resume with the same nickname/score slot after a page reload or transport drop,

So that brief network hiccups or accidental refreshes do not evict me from an active session (FR25).

## Acceptance Criteria

1. **Given** a player successfully completes `roomCreated` or `roomJoined` **when** the client stores session context **then** `{ roomId, roomCode, playerId, displayName, avatarPresetId, role: "host" | "guest" }` is written to `sessionStorage` under key `skribbl_session` — so a page reload can attempt reconnect.

2. **Given** the page loads and a valid `skribbl_session` entry exists in `sessionStorage` **when** the stored `roomId` points to a room still active on the server **then** the client automatically sends `reconnectHost` (role=host) or `reconnectPlayer` (role=guest) on WS open without showing the join form — user lands directly in the lobby or match.

3. **Given** `reconnectHost` or `reconnectPlayer` succeeds **when** the server responds with `roomCreated` / `roomJoined` **then** the client resumes its full game state (roster, phase, scores) and `sendRoomHydrate` delivers canvas + chat tail (5.2 path — already wired in `handle-client-command.ts`).

4. **Given** reconnect fails with any server error (`UNKNOWN_ROOM`, `JOIN_NOT_ALLOWED`, `NO_STASHED_SESSION`, `NOT_HOST`, `ROOM_FULL`) **when** client receives `error` event **then** `sessionStorage` entry is cleared, user is returned to the join/create form with a clear error message per NFR-O1 (no stack traces, no raw error codes visible to user).

5. **Given** a player opens the same room URL in a second tab while already connected **when** the second tab sends `reconnectHost`/`reconnectPlayer` with the same `playerId` **then** the server returns `ALREADY_CONNECTED` and the second tab shows copy: "Already open in another tab" — existing session is not disrupted.

6. **Given** a player is in **lobby phase** as a non-host guest and reloads **when** `reconnectPlayer` fails with `NO_STASHED_SESSION` (server only stashes mid-match, not lobby drops) **then** client falls back to normal `joinRoom` using stored `displayName` + `avatarPresetId` — sessionStorage is NOT cleared (player re-joins as if fresh but with prefilled identity fields). Room code is read from URL (`/room/[code]`).

7. **Given** deliberate navigation away (match ends + scoreboard dismissal, or user manually leaves) **when** that action completes **then** `sessionStorage` is cleared so stale context does not trigger reconnect on next visit.

## Tasks / Subtasks

- [x] **Session persistence on join** (AC: #1) — In `use-host-create-room.ts` on `roomCreated` parse success and in `use-guest-join-room.ts` on `roomJoined` parse success, write `skribbl_session` to `sessionStorage`. Shape: `{ roomId, roomCode, playerId, displayName, avatarPresetId, role: "host" | "guest" }`. Use a typed helper `apps/web/src/features/lobby/lib/session-storage.ts` (new file): `saveSession(s: SkribblSession)`, `loadSession(): SkribblSession | null`, `clearSession()`. Keep it thin — just `sessionStorage.getItem/setItem/removeItem` with JSON + Zod parse guard.

- [x] **Auto-reconnect on page load** (AC: #2, #3) — In both host and guest page/component entry points, call `loadSession()` before deciding whether to show the join form. If a session exists and the URL matches `roomCode`, suppress the join form and immediately trigger the WS connect + `reconnectHost`/`reconnectPlayer` send. Re-use the existing `retryAfterJoinedDrop` / `guestResumeContextRef` patterns — the `serializeReconnectHostCommand` / `serializeReconnectPlayerCommand` serializers already exist in `@skribbl/shared`. No new WS code needed; route the stored identity through existing retry path.

- [x] **Reconnect failure → graceful degradation** (AC: #4, #6) — On receiving `error` after reconnect attempt, check `error.code`:
  - `UNKNOWN_ROOM`, `NOT_HOST`, `ROOM_FULL`, `JOIN_NOT_ALLOWED` → clear `sessionStorage` + show join form with message (e.g. "Session expired or room no longer exists").
  - `NO_STASHED_SESSION` (guest, lobby phase) → do NOT clear; fall through to normal `joinRoom` with prefilled `displayName`/`avatarPresetId` from stored session (AC #6).
  - `ALREADY_CONNECTED` → do NOT clear; show banner "Already open in another tab" — no form, no reconnect loop (AC #5).

- [x] **Session clear on deliberate exit** (AC: #7) — Call `clearSession()` in:
  - Host hook: after `returnToLobby` is sent and the match has ended (scoreboard dismiss path).
  - Guest hook: same — after scoreboard dismiss or explicit leave action.
  - Both hooks: on component unmount if `status === "error"` (already cleared in failure path above).
  - Do NOT clear on transport drops or when retry is in flight.

- [x] **Duplicate-tab UX** (AC: #5) — Add `ALREADY_CONNECTED` handling to both hooks' error demux. Show a non-fatal banner (DaisyUI `alert-warning`) with copy "Already open in another tab — close this tab or the other one." Do not redirect. No `clearSession()` call.

- [x] **Tests** — `apps/server/src/room-ws.integration.test.ts`: add test that simulates page-reload reconnect: connect, join, drop socket, reconnect with same `playerId` → server responds with `roomCreated`/`roomJoined` + triggers hydrate. Test `ALREADY_CONNECTED`: two sockets same `playerId` → second gets error. Test `NO_STASHED_SESSION` for lobby guest. `apps/web/src/features/lobby/lib/session-storage.test.ts` (new): round-trip save/load/clear + Zod parse guard for corrupt/missing fields.

## Dev Notes

### Brownfield reality (read first)

- **Transport-drop reconnect already works** for mid-match (refs preserved). Story 5.1 adds **page-reload** reconnect by persisting to `sessionStorage`. Do NOT refactor the existing `closedWhileJoinedRef` / `guestResumeContextRef` ref pattern — just feed it from storage on fresh load.
- `reconnectHost` works in **lobby phase** (server checks `room.hostPlayerId === expectedPlayerId`, no stash required) — host can always reclaim by `playerId` + `roomId`.
- `reconnectPlayer` requires `awaitingReconnect` stash → only populated when `room.phase !== "lobby"`. Lobby-phase guest page-reload must fall back to normal `joinRoom` (AC #6). This is intentional; the stash comment in `room.ts` line 46 confirms: "Lobby-phase drops do not populate this map."
- `sendRoomHydrate` is already called after both `reconnectHost` and `reconnectPlayer` in `handle-client-command.ts` (lines ~272, ~337). Story 5.1 just needs the client to reach the reconnect command — hydrate delivery is automatic.
- `ALREADY_CONNECTED` is already returned by both server reconnect methods when same `playerId` already has a live socket (room-manager.ts lines ~1003, ~1051). No server changes needed for duplicate-tab.

### Architecture compliance

- **`sessionStorage`** (not `localStorage`) — scoped to browser tab; clears on tab close. Survives F5/page reload within the tab. Using `localStorage` would cause cross-tab reconnect race on room open in multiple tabs; `sessionStorage` limits scope to same tab by default (AC #5 is still possible because same playerId may appear in two tabs that were duplicated, but `sessionStorage` of a duplicated tab IS copied — handle via `ALREADY_CONNECTED` error).
- **Session helper in `apps/web/src/features/lobby/lib/`** — not a hook; pure functions. Follows existing lib pattern (`hydrate-merge.ts`, `lobby-transport.ts`).
- **No new server schemas needed** — `reconnectHost` / `reconnectPlayer` commands already in `@skribbl/shared`. `SkribblSession` type is client-only; keep it out of `@skribbl/shared`.
- **Zod parse guard on load** — `sessionStorage` may contain stale/corrupt JSON. Parse defensively; treat parse failure as no-session (return null, don't throw).

### Developer guardrails / file map

| Concern | Location |
|---------|---------|
| Session storage helper (new) | `apps/web/src/features/lobby/lib/session-storage.ts` |
| Session storage tests (new) | `apps/web/src/features/lobby/lib/session-storage.test.ts` |
| Host reconnect send | `apps/web/src/features/lobby/hooks/use-host-create-room.ts` (existing retry path) |
| Guest reconnect send | `apps/web/src/features/lobby/hooks/use-guest-join-room.ts` (existing retry path) |
| Reconnect serializers | `packages/shared/src/schemas.ts` — `serializeReconnectHostCommand`, `serializeReconnectPlayerCommand` (already exported) |
| Server reconnect handlers | `apps/server/src/protocol/handlers/handle-client-command.ts` — `reconnectHost` / `reconnectPlayer` cases (no changes needed) |
| Server stash logic | `apps/server/src/room/room-manager.ts` — `reconnectHost`, `reconnectPlayer`, `ALREADY_CONNECTED` guard (no changes needed) |
| Integration tests | `apps/server/src/room-ws.integration.test.ts` |

### Epic 5 cross-story context

- **5.2** (done): hydrate fires automatically after server accepts reconnect — no extra client trigger needed.
- **5.3** (done): roster shows disconnected peers during `awaitingReconnect` window — once 5.1 reconnect succeeds, server roster updates `connectionStatus: "connected"` via existing `broadcastLobbyRoster` path.

### Previous story intelligence (5.2 + 5.3)

- `serializeReconnectPlayerCommand` already imported in `use-guest-join-room.ts` line 29 — just call it on page-load path with stored identity, same as transport-drop path.
- `serializeReconnectHostCommand` already imported in `use-host-create-room.ts` line 24.
- Both hooks already have `guestResumeContextRef` / analogous host ref pattern storing `{ roomId, playerId, displayName, avatarPresetId }` — `loadSession()` should return the same shape so the existing retry code can consume it without modification.
- Completed: `awaitingReconnect.delete(expectedPlayerId)` fires on successful reconnect (server cleanup is automatic).

### Failure copy reference (NFR-O1)

| Error code | User-visible message |
|-----------|---------------------|
| `UNKNOWN_ROOM` | "Session expired or room no longer exists. Rejoin with the link." |
| `JOIN_NOT_ALLOWED` | "This room is no longer accepting reconnects." |
| `NO_STASHED_SESSION` | (guest lobby) → silent fallback to joinRoom; no user message |
| `NOT_HOST` | "Session mismatch. Rejoin with the invite link." |
| `ROOM_FULL` | "Room is full — your seat was taken." |
| `ALREADY_CONNECTED` | "Already open in another tab — close this tab or the other one." |

### Git intelligence

- `5f67f6d` (latest): Zustand integration + roster UI — check if any store was added that should also receive `playerId` on reconnect. If `useGameStore` or equivalent carries `playerId`, ensure it is hydrated from `sessionStorage` the same way React refs are.
- Transport-drop retry was in place before 5.2 (`closedWhileJoinedRef` pattern) — story 5.1 reuses, does not replace it.

### Project Context Rules

- No `localStorage` for game session — `sessionStorage` only (tab-scoped).
- No Socket.io — `ws` only; no protocol changes.
- Zod parse at all boundaries — corrupt `sessionStorage` → `null` return, not throw.
- `pnpm --filter @skribbl/web exec tsc --noEmit` must pass; `pnpm --filter @skribbl/server test` for integration.
- No duplicate schemas in `apps/web` — `SkribblSession` type is client lib only, not shared wire type.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `session-storage.ts` with `saveSession/loadSession/clearSession` + manual parse guard (no Zod in web; uses `isValidAvatarPresetId` from shared). Returns null on any corrupt/missing field.
- Host hook: loads session on fresh connect, feeds into existing `hostResumeContextRef` + `pageReloadReconnectRef`. Saves session on `roomCreated`. Clears session on fatal errors (except `ALREADY_CONNECTED`). Clears on `returnToLobby` (scoreboard dismiss). Added `protocolCode` to error state type.
- Guest hook: same pattern. `NO_STASHED_SESSION` does NOT clear session — page auto-retries with `joinRoom` (lobby-phase fallback AC#6). `ALREADY_CONNECTED` does NOT clear session.
- LobbyHostPage: mounts with `loadSession()`, auto-fills identity + sets `submitted=true` for host session. Renders `alert-warning` banner (not error card) for `ALREADY_CONNECTED`.
- JoinRoomClient: same auto-connect on mount for guest session matching URL code. `useEffect` detects `NO_STASHED_SESSION` error and bumps `joinGeneration` to fall back to `joinRoom`. Renders `alert-warning` for `ALREADY_CONNECTED`.
- Integration tests: page-reload reconnect (connect→drop→reconnectPlayer→roomJoined+roomHydrate), ALREADY_CONNECTED (two sockets same playerId), NO_STASHED_SESSION (lobby-phase guest reconnect). All 62 server tests pass.
- Web tests: 10 session-storage unit tests (round-trip, corrupt JSON, invalid fields). All 82 web tests pass.
- TypeScript: `pnpm --filter @skribbl/web exec tsc --noEmit` clean.

### File List

- `apps/web/src/features/lobby/lib/session-storage.ts` (new)
- `apps/web/src/features/lobby/lib/session-storage.test.ts` (new)
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `apps/server/src/room-ws.integration.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5, Story 5.1, FR25]
- [Source: `_bmad-output/game-architecture.md` — Authentication/authorization §, Rooms & identity ADR]
- [Source: `_bmad-output/project-context.md` — Engine rules, reconnect token validation]
- [Source: `apps/server/src/room/room-manager.ts` — `reconnectHost`, `reconnectPlayer`, `ALREADY_CONNECTED`]
- [Source: `apps/server/src/protocol/handlers/handle-client-command.ts` — reconnect cases, `sendRoomHydrate` wiring]
- [Source: `apps/web/src/features/lobby/hooks/use-guest-join-room.ts` — `guestResumeContextRef`, transport-drop retry path]
- [Source: `apps/web/src/features/lobby/hooks/use-host-create-room.ts` — `serializeReconnectHostCommand` usage]
- [Source: `_bmad-output/implementation-artifacts/5-2-snapshot-op-replay-hydration.md`]
- [Source: `_bmad-output/implementation-artifacts/5-3-presence-decay-ui-muted-roster-rows.md`]

---

Completion note: Ultimate context engine analysis completed — comprehensive developer guide created.

## Change Log

- 2026-05-05: Implemented Story 5.1 — session tokens & reconnect handshake. New `session-storage.ts` helper, host/guest hook integration, page-level auto-connect, graceful error handling (ALREADY_CONNECTED banner, NO_STASHED_SESSION lobby fallback, fatal error session clear), duplicate-tab UX, and full test suite (10 unit + 3 integration).
