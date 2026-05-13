# Story 8.3: pre-game-lobby-chat-relay

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

## Story

As a player waiting in the lobby,
I want to send and receive text messages with other players before the match starts,
so that we can coordinate and socialize while waiting for the host to start the game.

## Acceptance Criteria

1. **Given** a player in lobby phase emits `lobbyChat { roomCode, message }`  
   **When** server receives the message  
   **Then** `LobbyChatSchema` (Zod, `@skribbl/shared`) validates it — `message` max **200 graphemes** (after sanitize); excess rejected with structured `error` using code **`MESSAGE_TOO_LONG`** (align `sendProtocolError` / client-visible code with this string exactly).

2. **Given** sender is not a member of the room identified by `roomCode` (no room, wrong code, or socket not in that room)  
   **When** `lobbyChat` arrives  
   **Then** server returns **`error { code: "NOT_IN_ROOM" }`** — message not relayed.

3. **Given** a player sends **more than 5** valid `lobbyChat` messages within any rolling **3 second** window (per stable `playerId`)  
   **When** the sixth+ message would exceed the budget  
   **Then** excess messages are dropped and **only the sender** receives **`error { code: "RATE_LIMITED" }`** — other players unaffected, no partial broadcast.

4. **Given** a valid `lobbyChat` while `room.phase === "lobby"`  
   **When** server relays it  
   **Then** **`lobbyChatMessage`** is broadcast to **all** sockets in that room **including the sender**, with payload shape per epic: **`{ type: "lobbyChatMessage", playerId, displayName, message, timestamp }`** (use **server clock** ms for `timestamp`; reuse `sanitizeChatMessage` output as the canonical `message` text).

5. **Given** match phase has started (`startMatch` processed — `room.phase !== "lobby"`)  
   **When** `lobbyChat` arrives  
   **Then** server rejects with **`error { code: "MATCH_IN_PROGRESS" }`** — lobby chat is **lobby-only**.  
   **Do not** block existing **`chatMessage`** used for drawing-phase guessing (Epic 4).

## Tasks / Subtasks

- [x] **Shared protocol (`@skribbl/shared`)** (AC: #1, #4, #5)  
  - [x] Add `lobbyChat` to `clientCommandSchema` discriminated union: `{ type: "lobbyChat", roomCode: string, message: string }` with validation consistent with 200-grapheme cap (prefer reusing `sanitizeChatMessage` + `countGraphemes` / `CHAT_MESSAGE_MAX_GRAPHEMES` patterns from `chat-text.ts`).  
  - [x] Add `lobbyChatMessage` to `serverEventSchema`: `{ type: "lobbyChatMessage", playerId, displayName, message, timestamp }` (add `roomCode` only if clients need disambiguation — epic omits it; single-room clients are fine without).  
  - [x] Export inferred TypeScript types; extend `schemas.test.ts` with valid/invalid lengths, unknown fields rejected, round-trip parse.

- [x] **Server — handler + rate limit** (AC: #2–#5)  
  - [x] Add `RoomManager.applyLobbyChat(ws, roomCode, rawMessage)` (or equivalent) returning `{ ok: true } | { ok: false; code: string }` with Result-style guards — **no uncaught throws** over WS.  
  - [x] Resolve room: `getRoomForSocket(ws)` + compare `room.code` (short code from `Room`) to normalized incoming `roomCode` — mismatch / missing → `NOT_IN_ROOM` (epic wording; avoid reusing `BAD_ROOM` for this path unless you explicitly map it in tests).  
  - [x] Phase guard: `room.phase !== "lobby"` → `MATCH_IN_PROGRESS`.  
  - [x] Sanitize + length: reuse `sanitizeChatMessage` / length assert; map **`CHAT_TOO_LONG`**-style checks to wire code **`MESSAGE_TOO_LONG`** for this command path.  
  - [x] **Rate limit:** maintain per-`playerId` sliding window (e.g. push `Date.now()` into a bounded queue, drop entries older than 3s; allow ≤5 sends per window). Suggested placement: `RoomManager` private state keyed by `playerId` or `${roomId}:${playerId}`.  
  - [x] Broadcast via existing `sendEvent` / fan-out patterns so payloads stay Zod-validated.  
  - [x] Wire `case "lobbyChat"` in `handle-client-command.ts` mirroring `updateSettings` / `chatMessage` error emission.

- [x] **Web — host lobby** (AC: #4)  
  - [x] `LobbyHostPage.tsx` today: pre-game chat is **local-only** (“backend wired in later story”). Replace local-only send path with **`lobbyChat`** over `sendGameJsonLine` using **`state.roomCode`** (same value users share).  
  - [x] Handle incoming `lobbyChatMessage` in `use-host-create-room.ts` (and/or page state) to append to the visible feed with stable ids for React keys.  
  - [x] Map `RATE_LIMITED`, `MESSAGE_TOO_LONG`, `MATCH_IN_PROGRESS`, `NOT_IN_ROOM` to user-visible toasts or inline error — follow existing protocol error UX (`LobbyConnectionBanner` / toast patterns).

- [x] **Web — guest join flow** (AC: #4)  
  - [x] **Guests** use `JoinRoomClient` + `use-guest-join-room` with `MatchChatPanel` / `chatFeed` for **match** chat. For **lobby phase**, ensure guests can send/receive **lobby** chat: extend dispatch to handle `lobbyChatMessage` into a lobby-visible feed (either extend `chatFeed` with a narrow type guard or add `lobbyChatFeed` in guest state — avoid mixing match spoiler logic with lobby relay).  
  - [x] Send `lobbyChat` from guest composer when `phase === "lobby"` only; after `startMatch`, use existing **`chatMessage`** path for guesses (unchanged).

- [x] **Tests** (AC: all)  
  - [x] `packages/shared`: schema tests for new command/event.  
  - [x] `apps/server`: unit tests on `RoomManager` — `NOT_IN_ROOM`, `MATCH_IN_PROGRESS`, `MESSAGE_TOO_LONG`, `RATE_LIMITED`, happy broadcast including sender.  
  - [x] `apps/server/src/room-ws.integration.test.ts`: add/extend coverage for lobby relay without emitting `chatCorrectGuess` (similar to existing “lobby chat never emits chatCorrectGuess” test but for **`lobbyChat`**).  
  - [x] `apps/web`: focused tests for reducer/hooks if dispatch grows (optional if covered by server integration + manual smoke).

- [x] **Verification**  
  - [x] `pnpm --filter @skribbl/shared test`  
  - [x] `pnpm --filter @skribbl/server test`  
  - [x] `pnpm --filter @skribbl/web test`  
  - [x] `pnpm -r exec tsc --noEmit`  
  - Read `apps/web/AGENTS.md` before changing Next.js surfaces.

## Dev Notes

### Brownfield reality vs epic naming (read this first)

| Area | Current codebase | Epic 8.3 contract | Story direction |
| --- | --- | --- | --- |
| Lobby traffic | Host chat UI is **fake local state** (`LobbyHostPage` comment ~line 120); guests may not have full lobby chat parity | Real WS relay | Wire host + guest; remove fake-only send path on host. |
| Match traffic | `chatMessage` + `chatPlayerMessage` with guess adjudication (`applyChatMessage`) | N/A | **Leave match path intact.** |
| Wire IDs | `chatMessage` uses `roomId` (UUID) | `lobbyChat` uses **`roomCode`** | Implement epic **`roomCode`** on new command; compare to `room.code` after normalizing the same way as join (`normalizeRoomCode` / shared helpers). |
| Length | `CHAT_MESSAGE_MAX_GRAPHEMES = 200`, error `CHAT_TOO_LONG` today | Code **`MESSAGE_TOO_LONG`** | Emit **`MESSAGE_TOO_LONG`** for **`lobbyChat`** validation failures per AC. |

### Why a new command (not only `chatMessage`)

- Epic AC #5 requires rejecting **`lobbyChat`** when the match has started **without** breaking drawing-phase **`chatMessage`** (guesses). A dedicated **`lobbyChat`** command satisfies AC5 cleanly.

### Architecture compliance

- All wire shapes live only in **`packages/shared/src/schemas.ts`** (and tests). No duplicate enums in apps.  
- Server remains authoritative; clients send intent only.  
- Use **`sendProtocolError`** / existing error envelope patterns consistent with Story 8.2 (`updateSettings`).  
- Redis persistence of lobby chat history is **not** required for this story — ephemeral relay is sufficient unless a follow-up epic adds it.

### File / module touch list (expected)

- `packages/shared/src/schemas.ts`, `schemas.test.ts`, `index.ts` exports  
- `apps/server/src/protocol/handlers/handle-client-command.ts`  
- `apps/server/src/room/room-manager.ts`  
- `apps/server/src/room-ws.integration.test.ts`  
- `apps/web/src/lib/ws-client.ts` — helper to serialize `lobbyChat`  
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`  
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`  
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`  
- `apps/web/src/app/join/JoinRoomClient.tsx` (if guest UI wiring needs composition changes)

### Testing standards

- Vitest (server/shared); RTL/web tests per package conventions.  
- Maintain **302+** test discipline from prior stories — new tests must not flake on timing; use fake timers for rate limits if needed.

## Previous story intelligence (8.2)

- Story 8.2 established **`updateSettings`**, Redis persistence for **`room.settings`**, and **`sendEvent`-validated** broadcasts. Reuse **Result-style** `{ ok, code, detail }` patterns and **`writeRoomToRedis`** only when mutating room state — **lobby chat does not require** Redis writes for message bodies.  
- Review notes from 8.2: prefer **schema-validated** emits, avoid silent casts, filter unknown keys when merging partial objects.  
- **`roomJoined` / `roomCreated`** already carry **`settings`** — no change required for 8.3 unless you discover a shared `roomHydrate` need for lobby chat tail (out of scope unless reconnect-in-lobby UX requires it).

## Git intelligence (recent commits)

- Latest feature work: **`feat(lobby): implement lobby settings host broadcast`** — touched shared schemas, `RoomManager`, `handle-client-command`, lobby hooks, `LobbyHostPage`. New work should follow the same layering (shared → server → web).

## Latest technical notes (2026)

- Stack pins from **`project-context.md`**: Next **16.x**, React **19.x**, Zod **4.x**, Node **24**, `ws` **8.20.x** — re-verify versions on branch before claiming compatibility.  
- Rate limiting: simple in-memory per-process structure is acceptable for MVP (matches room manager model); document that multi-instance deployments would need a shared rate-limit store (future).

## Project context rules (extract)

- **Single protocol source:** `@skribbl/shared` Zod schemas — never fork message types in web/server.  
- **Server-authoritative** relay; sanitize with **`sanitizeChatMessage`** before length checks.  
- **pnpm** workspaces only (`pnpm --filter @skribbl/<pkg>`).  
- **No Socket.io**; **`ws`** only (ADR-001).  
- **Two processes** (Next + game server) — WS URL via **`NEXT_PUBLIC_WS_URL`** when split.  
- Read **`apps/web/AGENTS.md`** when editing Next.js app code.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8, Story 8.3]  
- [Source: `_bmad-output/planning-artifacts/gdd.md` — Real-time sync, lobby]  
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — “Alive together”, lobby social]  
- [Source: `_bmad-output/project-context.md` — stack, protocol rules]  
- [Source: `_bmad-output/game-architecture.md` — shared schemas, server authority]  
- [Source: `apps/server/src/room/room-manager.ts` — `applyChatMessage`, phase behavior]  
- [Source: `packages/shared/src/chat-text.ts` — `CHAT_MESSAGE_MAX_GRAPHEMES`, sanitize]

## Dev Agent Record

### Agent Model Used

Cursor agent (Claude) — story 8.3 completion pass

### Debug Log References

- Lobby relay unit/integration tests showed no `lobbyChatMessage` on the wire despite `applyLobbyChat` returning `{ ok: true }`: **`sendEvent`** swallows **`serializeServerEvent`** failures (`RoomManager`). Root cause was **stale `packages/shared/dist`** (gitignored exports from `@skribbl/shared` lacked the new discriminator). **`pnpm --filter @skribbl/shared build`** (or root **`pnpm test` / `pnpm typecheck`**, which build shared first) refreshes **`dist`** and fixes runtime validation.
- `clientCommandSchema` lobbyChat test: TypeScript narrowing after **`safeParse`** required **`toMatchObject`** instead of direct **`r.data.message`** access.

### Completion Notes List

- Implemented **`lobbyChat`** / **`lobbyChatMessage`** in shared Zod schemas with grapheme validation, **`CHAT_EMPTY`** / **`MESSAGE_TOO_LONG`** issues, and tests.
- Server: **`RoomManager.applyLobbyChat`**, sliding-window rate limit (5 / 3s per **`playerId`**), **`handle-client-command`** + **`create-game-server`** error mapping; integration test for relay.
- Web: host + guest **`lobbyChat`** send, **`lobbyChatMessage`** receive, protocol error UX strings; **`LobbyHostPage`** effect deps use **`[state]`** for correct **`HostLobbyState` discriminated union** typing.

### File List

- `packages/shared/src/schemas.ts`
- `packages/shared/src/schemas.test.ts`
- `packages/shared/src/index.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/room/room-manager.test.ts`
- `apps/server/src/protocol/handlers/handle-client-command.ts`
- `apps/server/src/create-game-server.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/src/lib/ws-client.ts`
- `apps/web/src/features/lobby/lib/protocol-error-message.ts`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `_bmad-output/implementation-artifacts/8-3-pre-game-lobby-chat-relay.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- **2026-05-13** — Story status **done**; sprint synced. Code review decision resolved (dual guest error surfacing documented).

## Story completion status

- **Status:** `done`  
- **Note:** Code review patches applied 2026-05-13. **[Review][Decision]** closed: intentional dual surfacing for guest lobby errors (snack + connection banner), documented on `LOBBY_CHAT_RECOVERABLE` in `use-guest-join-room.ts`.

---

### Open questions / product clarifications (non-blocking)

1. Epic event omits **`roomId`/`roomCode`** on `lobbyChatMessage` — confirm clients rely on single-room context only (recommended for MVP).  
2. If product wants one unified chat transcript across lobby→match, that is a **separate** UX/tech story; 8.3 intentionally keeps **`lobbyChatMessage`** separate from **`chatPlayerMessage`** for clear phase boundaries.

### Review Findings

<!-- gds-code-review 2026-05-13 — parallel layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor -->

- [x] [Review][Decision] Recoverable guest lobby chat errors fire **`onLobbyProtocolNotice`** (inline snack) **and** **`setTransportErrorMessage`** (connection banner). Pick a **single primary surface** for `LOBBY_CHAT_RECOVERABLE` codes in `use-guest-join-room.ts`, or document intentional dual surfacing. — **resolved 2026-05-13:** documented intentional dual surfacing (comment on `LOBBY_CHAT_RECOVERABLE`).

- [x] [Review][Patch] Lobby composers drop overlong input **silently** after sanitize when `assertChatMessageLength` fails — [`JoinRoomClient.tsx:440`](../../apps/web/src/app/join/JoinRoomClient.tsx), [`LobbyHostPage.tsx:444`](../../apps/web/src/features/lobby/components/LobbyHostPage.tsx). Surface user-visible feedback (or send so server emits **`MESSAGE_TOO_LONG`**) for consistency with AC1. — **fixed 2026-05-13:** toast / guest snack via `messageForProtocolErrorCode` for **`CHAT_EMPTY`** and **`MESSAGE_TOO_LONG`**.

- [x] [Review][Patch] **`create-game-server.ts`** maps **`lobbyChat`** parse failures by comparing Zod `issue.message` **strings** to shared constants (lines ~161–167) — brittle if Zod/internal copy changes. Prefer a single **`lobbyChatCommandSchema.safeParse`** outcome branch with explicit `issue.code` / typed codes. — **fixed 2026-05-13:** centralized **`wireCodeFromLobbyChatZodError`** in `@skribbl/shared` + unit tests.

- [x] [Review][Patch] **`room-ws.integration.test.ts`** (Story 8.3 case) asserts ≥1 **`lobbyChatMessage`** per socket but does not assert **host** receives the same **`message`/`playerId`** as **guest** or that **both** match the send — tighten relay parity assertions. — **fixed 2026-05-13:** host vs guest **`lobbyChatMessage`** parity on **`message`**, **`playerId`**, **`displayName`**.

- [x] [Review][Defer] [`room-manager.ts`](../../apps/server/src/room/room-manager.ts) **`lobbyChatSendTimestampsByPlayerId`** never deletes **`playerId` keys** after idle — low-risk MVP leak; revisit if long-lived processes or multi-tenant scale. — deferred, pre-existing pattern concern
