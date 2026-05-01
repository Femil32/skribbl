# Story 5.1: Session tokens & reconnect handshake

Status: done

<!-- gds-create-story (2026-05-01). Ultimate context engine analysis completed — comprehensive developer guide created. Epic 5 opener: extend beyond lobby-only host reclaim; issue server-side session secrets; unify reconnect path for host + guests across match phases per FR25. Story 5.2 owns snapshot/hydration (FR26). -->

## Story

As a dropped player,

I want to resume with the same nickname/score slot,

So dropouts do not punish my session (FR25).

## Acceptance Criteria

1. **Given** a player completes **`createRoom`** or **`joinRoom`** successfully **when** the server accepts them **then** the client receives an **opaque server-issued reconnect credential** (distinct from guessable `playerId` alone) bound to **`roomId` + `playerId`**, suitable to store for later resume — wire shape lives only in **`@skribbl/shared`** (new/extended fields on **`roomCreated`** / **`roomJoined`** or a follow-up event if you must avoid breaking clients; if you extend events, **dual-run** or version mindfully).
2. **Given** a transient WebSocket loss (or full reload) **when** the client opens a **new** socket and sends a **`ClientCommand`** reconnect payload that includes **`playerId` + session token + room identity** (**`roomId`** and/or **room code** — pick the minimal stable tuple the server needs) **then** the server **validates** the token **before** reattaching the socket and **either** succeeds with the **same** canonical **`playerId`** and roster slot **or** fails with a **stable `error.code`** and **user-safe `message`** per NFR-O1 (no stack traces, no internal ids beyond what UX already shows).
3. **Given** reconnect validation fails (unknown room, revoked/unknown token, wrong player binding, phase guard if any) **when** the client maps **`error.code`** through existing **`protocol-error-message` (or successor)** **then** copy is **actionable** (“create a new room”, “rejoin with code”, “session expired”) — align with **`LobbyConnectionBanner`** / transport states so **reconnecting** stays non-fatal where appropriate ([Source: **`ux-design-specification.md`** UX-DR9 pattern, **`lobby-transport.ts`**]).
4. **Given** **two live tabs** (or two sockets) attempt to hold the **same** session **when** the second connection presents a valid credential **then** behavior matches a **single documented policy** in code + story dev notes (**reject second** vs **migrate session to new socket**) — today’s **`reconnectHost`** path returns **`ALREADY_CONNECTED`** when the old socket is still in the roster; either **preserve** that policy for parity or **explicitly migrate** after token validation and **disconnect/replace** the stale socket ([Source: **`room-manager.ts`** `reconnectHost`]). **Document the choice** where operators read it (architecture comment + test name).
5. **Given** the room has left **lobby** (match phases) **when** a disconnected **guest** reconnects **then** **`joinRoom` must not be the only path** anymore — **`joinRoom`** currently fails with **`JOIN_NOT_ALLOWED`** after start ([Source: **`room-manager.ts`** `joinRoom`]); reconnect must succeed for **eligible** phases so score/identity stay bound (hydration of canvas/chat tail is **Story 5.2**, but reattach itself must land here).
6. **Given** the host **when** reconnect uses the **same** credential model as guests **then** **`reconnectHost`-specific trust** (“knows `roomId` + `playerId`”) is **either** superseded by token proof **or** `reconnectHost` is a thin shim that resolves to the unified handler — **avoid** duplicate validation logic drifting between host and guest.

## Tasks / Subtasks

- [x] **Protocol (`@skribbl/shared`)** (AC: #1–#2, #6) — Add **`sessionToken`** / **`reconnectToken`** naming (pick one globally) plus **`ReconnectPlayer`** (`reconnectRoom`/`resumeSession`/etc.) command schema; extend **`roomCreated`**, **`roomJoined`** (and tests in **`schemas.test.ts`** round-trip parity).
- [x] **Server state** (AC: #1–#2, #5–#6) — In **`RoomManager`**, persist per-**`playerId`** secret token (rotate on **`leaveSocketRoom`** teardown vs keep through disconnect-only — **decide**: token should survive **socket close** until timeout or forever-until-room-death MVP); expose **`resumeConnection`**/`reconnectPlayer` used by **`handle-client-command`**; integrate with **`Room`** aggregate if maps stay centralized.
- [x] **Handler + errors** (AC: #2–#3) — Map failure reasons to **`error.code`** constants; extend **`protocol-error-message.ts`** and **`LobbyConnectionBanner`** only if new codes need copy; maintain **`Result`**-style internal returns ([Source: **`project-context.md`**]).
- [x] **Client hooks** (AC: #2–#3, #5) — **`use-host-create-room`** / **`use-guest-join-room`**: persist issued token + ids (**`sessionStorage`** vs **`localStorage`** — scope to tab vs survive reload per product call; document); on WS **`close`**/`open`, emit reconnect command instead of blindly **`joinRoom`** when credentials exist *and* room is mid-match (`phase`≠`lobby` from memory or inferred).
- [x] **`ws-client` serializers** (AC: #2) — Add **`serializeReconnect…`** helpers mirroring host pattern (**`serializeReconnectHostCommand`** today).
- [x] **Tests** (AC: #1–#6) — **`room-manager.test.ts`** unit cases for token mismatch, duplicate tab policy, reconnect mid-**`drawing`** reattach skeleton (no hydrate assertions — defer to **5.2**); **`room-ws.integration.test.ts`** green path + **`HOST_SESSION_LOST`-grade** regressions adapted for token model; **`packages/shared`** Zod regressions.

## Dev Notes

### Brownfield state (non-negotiable facts)

- **Host lobby reclaim exists:** **`reconnectHost`** + **`RoomManager.reconnectHost`** validates **`room.phase === "lobby"`**, **`expectedPlayerId === room.hostPlayerId`**, rejects **`ALREADY_CONNECTED`** if that **`playerId`** still has a socket in **`room.sockets`** ([Source: **`handle-client-command.ts`**, **`room-manager.ts`**]).
- **Guests have no first-class reconnect** today; **`joinRoom`** rejects non-lobby phases.
- **Identity today:** **`playerId`** is a UUID minted per successful **`createRoom`**/**`joinRoom`**; no separate HMAC/session secret on the wire besides knowing **`roomId` + playerId`** for host (**weak** for reconnect story — Epic requires **session token**).

### Epic cross-story boundaries

| Story | Responsibility |
|-------|----------------|
| **5.1** (here) | Issue + validate reconnect credentials; socket reattachment; duplicate-tab policy; clear errors |
| **5.2** | **`snapshot` + op replay**/chat tail hydration after successful reattach ([Source: **`project-context.md`**, **`game-architecture.md`** canvas sync section]) |
| **5.3** | Presence decay UI + **`ConnectionBanner`** nuance vs **this** handshake |

### Architecture compliance

- **Server-authoritative** validation only; tokens never inferred client-side ([Source: **`game-architecture.md`** Decision table — Rooms & identity]).
- **Zod-first wire** — no duplicate command shapes in **`apps/web`** / **`apps/server`** ([Source: **`schemas.ts`** header comment]).
- **Technical risk explicitly in-scope:** duplicate tabs + disconnect mid-match ([Source: **`game-architecture.md`** Technical Risks]).

### Developer guardrails / file map

| Concern | Location |
|---------|----------|
| Wire enums + events | **`packages/shared/src/schemas.ts`**, **`schemas.test.ts`** |
| Room/session logic | **`apps/server/src/room/room-manager.ts`**, **`room.ts`** |
| Command routing | **`apps/server/src/protocol/handlers/handle-client-command.ts`** |
| WS ingress | **`apps/server/src/create-game-server.ts`** |
| Client serializers | **`apps/web/src/lib/ws-client.ts`** |
| Lobby/match reconnect UX | **`use-host-create-room.ts`**, **`use-guest-join-room.ts`**, **`lobby-transport.ts`**, **`LobbyConnectionBanner.tsx`**, **`protocol-error-message.ts`** |
| Integration | **`apps/server/src/room-ws.integration.test.ts`** |

### Previous epic intelligence (nearby regressions)

- **Epic 4** — **`applyChatMessage`**, **`broadcastCorrectGuess`**, **`lobbyRoster`** ordering: after reattach, socket must regain same **`playerId`** so spoiler + scoring maps stay keyed correctly **before** Story **5.2** replays deltas.
- **Story 4.4 pattern** — exhaustive **`switch`/demux** and shared-only wire fields; reuse that discipline for reconnect events/errors.

### Git intelligence

- **`ebea067`** — Epic 4.4 chat UX (touch **`MatchChatPanel`** only if reconnect surfaces new transport copy).
- Recent protocol work clusters on **`room-manager`** + hooks — inspect **`git log -15 -- packages/shared`** before editing unions.

### Latest tech / versions

- Pins: **Next ~16.x**, **React ~19.x**, **`ws 8.x`**, **Zod 4.x** — re-verify **`_bmad-output/project-context.md`** before adding deps ([Source: **`game-architecture.md`** Engine section]).

### Project Context Rules (extract)

- Dedicated Node **`ws`** server; **`@skribbl/shared`** is the **only** protocol source.
- **No MVP Mongo/session DB** — tokens are **in-memory** per server process unless scope changes.
- **Reconnect:** session token **`+`** **`playerId`** validated **before** resuming ([Source: **`project-context.md`** Critical rules]).
- **Command handlers:** structured errors; exhaustive **`never`** **`default`** in **`handleClientCommand`** when extending unions (**TypeScript exhaustive switch** discipline).

---

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

_(none — green after shared rebuild + Vitest)_ 

### Completion Notes List

- Replaced **`reconnectHost`** with unified **`resumeSession`** + **`reconnectToken`** on **`roomCreated`/`roomJoined`**. Tokens are **`base64url(32`** random bytes**)`**, per-player in **`Room.reconnectSecretsByPlayerId`**; revoked for **lobby guests** only on voluntary socket teardown; **`offlineIdentityByPlayerId`** preserves seated identity outside **lobby** for mid-match **`resumeSession`** (**same `playerId`**, server-authoritative nickname/avatar from offline snapshot).
- **Duplicate-tab:** **reject second** (**`ALREADY_CONNECTED`**) — documented on **`resumeSession`** and covered by **`resumeSession_rejects_duplicate_tab_already_connected`**. No socket migration.
- **Client persistence:** **`localStorage`** keyed by **`roomId`** (+ **`persistLastActiveHostRoom`**, **`persistGuestSessionForRoomCode`** for reload resume). **`sessionStorage`** flags on **`pagehide`** gate cold reload **`resumeSession`**. **`INVALID_SESSION`** + **`HOST_SESSION_LOST`** user copy in **`protocol-error-message.ts`**; terminal sets updated on hooks.
- Rebuild **`@skribbl/shared`** after schema changes (`pnpm --filter @skribbl/shared build`) — tests consume **`dist`**.

### File List

- `packages/shared/src/schemas.ts`
- `packages/shared/src/schemas.test.ts`
- `apps/server/src/room/room.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/room/room-manager.test.ts`
- `apps/server/src/protocol/handlers/handle-client-command.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/src/lib/ws-client.ts`
- `apps/web/src/features/lobby/lib/protocol-error-message.ts`
- `apps/web/src/features/lobby/lib/persist-room-session.ts`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- **2026-05-01** — Implemented Story **5.1**: **`resumeSession`**, **`reconnectToken`**, offline seating for non-lobby disconnects, client **`localStorage`** + reload intent, **`INVALID_SESSION`** errors, duplicate-tab **`ALREADY_CONNECTED`** policy, Vitest coverage (unit + integration + shared).


### Open questions (non-blocking — default if PM silent)

1. **Token TTL:** Infinite for room lifetime vs short TTL with refresh — MVP bias: **per-room lifetime** + clear on **`roomsById` delete**.
2. **Persistence layer on client:** **`sessionStorage`** (per-tab) reduces accidental cross-tab duplicate; **`localStorage`** survives reload — pick one and test duplicate-tab AC explicitly.
