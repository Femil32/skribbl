# Story 1.2: Authoritative rooms & secure codes on the server

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a player creating or joining a session,
I want server-backed rooms with non-guessable codes,
so that strangers cannot wander into my lobby (NFR-SEC1).

## Acceptance Criteria

1. **Given** the WS server running with a room aggregate skeleton **when** `createRoom` / `joinRoom` commands are sent with payloads validated by `@skribbl/shared` **then** new rooms receive **unique** room codes and successful operations are reflected in **structured server→client events** (no raw exceptions to the client).
2. **Given** an invalid, unknown, or malformed room code **when** `joinRoom` runs **then** the client receives a **recoverable** `error` event with a **stable `code`** string and optional human-readable `message`—**no stack traces** on the wire (NFR-O1).
3. **Given** a room at capacity **when** `joinRoom` would exceed the configured maximum **then** the server rejects with a structured recoverable error (honor **`MAX_PLAYERS`** toward NFR-S1).
4. **Given** room codes are generated server-side **when** inspected **then** they are **non-sequential and non-guessable** (use **`crypto`**-grade randomness or an equivalent vetted approach—not `Math.random`-only).

## Tasks / Subtasks

- [x] **Shared protocol** (AC: 1–4)
  - [x] Extend `clientCommandSchema` in `packages/shared/src/schemas.ts` with `createRoom` and `joinRoom` variants (minimal fields: e.g. optional display metadata only if needed for this story—avoid duplicating Story 1.5 nickname/avatar payloads until that story).
  - [x] Extend `serverEventSchema` with events the server must emit for “room created” and “joined room” success paths, plus any minimal lobby snapshot fields later stories will grow (keep **discriminant `type`** consistent with existing `ping` / `pong` / `error` pattern).
  - [x] Export `safeParse` / `serializeServerEvent` paths for new shapes; add or extend **Vitest** in `@skribbl/shared` for at least one **invalid** command and one **invalid** server event rejection.
- [x] **Config** (AC: 3)
  - [x] Add **`MAX_PLAYERS`** (default **8**) to `apps/server/src/config/game.ts` with env read—match epics/NFR-S1 expectations; document in code comment for `WORDS_PATH`-style consistency.
- [x] **Room aggregate & manager** (AC: 1, 3, 4)
  - [x] Implement in-memory **`Room`** (skeleton): id/code, capacity bound, minimal phase indicator (`lobby` stub acceptable), host/player placeholders sufficient for join/create bookkeeping.
  - [x] **`RoomManager`** (or equivalent): generate codes via **`node:crypto`** (`randomBytes` / random ints mapped to alphabet)—**collision retry** loop until unique in the manager map.
  - [x] **Normalize codes** at the boundary (e.g. uppercase alphanumeric strip whitespace) so casing mistakes are handled consistently before Story 1.4 UX—document canonical form in Dev Notes.
- [x] **WS integration** (AC: 1–4)
  - [x] Route parsed commands in `apps/server` through **`Result`-style** internal handlers that map failures to **`serializeServerEvent({ type: 'error', code, … })`**—reuse patterns from Story 1.1 (`BAD_PAYLOAD`, etc.).
  - [x] Introduce stable **`error` codes** for this story at minimum: e.g. `UNKNOWN_ROOM`, `ROOM_FULL`, `BAD_CODE`—extend the Story 1.1 list rather than inventing parallel naming schemes.
  - [x] Track each **`WebSocket` → room membership** enough to support “same room broadcast” stubs later (even if broadcast is minimal in 1.2).
- [x] **Tests** (AC: 1–4)
  - [x] **Vitest** in `@skribbl/server`: create → join succeeds; duplicate join or full room yields expected error **`code`**; unknown code yields `UNKNOWN_ROOM` (or chosen equivalent); malformed payload stays `BAD_PAYLOAD`.
- [x] **Verification**
  - [x] `pnpm -r exec tsc --noEmit` (or per-package scripts) passes; shared build still consumable by Next + Node per Story 1.1 `dist` arrangement.

## Dev Notes

### Architecture compliance

- **Single source of truth:** All new command and event shapes live in **`@skribbl/shared`** only—no parallel types in `apps/*` ([Source: `_bmad-output/project-context.md`, `_bmad-output/game-architecture.md` — API / realtime pattern]).
- **Server-authoritative:** Room existence, code validity, and capacity are decided only on the server; clients send **intent** (`createRoom`, `joinRoom`).
- **Recoverable errors:** Use the existing **`error`** event schema; **`pino`** may log stack traces **server-side**, but responses on the socket must remain structured JSON without internal exception text (NFR-O1).
- **Room system location:** Transport + fanout under `apps/server/src/room/*`; wire schemas in `packages/shared/src/schemas.ts` ([Source: `game-architecture.md` — System location mapping]).
- **Two processes:** Do not collapse the game server into Next; keep dedicated `apps/server` process.

### File structure (must create or align)

| Area | Path |
|------|------|
| Wire protocol | `packages/shared/src/schemas.ts`, `packages/shared/src/index.ts`, tests alongside |
| Game limits | `apps/server/src/config/game.ts` |
| Rooms | `apps/server/src/room/` — e.g. `room-manager.ts`, `room.ts` (names `kebab-case` files per project conventions) |
| Handlers | `apps/server/src/protocol/handlers/` — dedicated modules or a single room command module if simpler |
| WS entry | `apps/server/src/create-game-server.ts` (or extracted router) — keep **thin** orchestration |

### Technical requirements (guardrails)

- **Discriminant field** on JSON: **`type`** (already established in Story 1.1)—do not introduce a second discriminant name.
- **Exhaustive `switch`** on `ClientCommand` / handler results in the style of Story 1.1’s `handleClientCommand`.
- **Dependency budget:** Prefer **no** new runtime deps for code generation if `node:crypto` suffices; if you add `nanoid` or similar, justify in Dev Agent Record and keep bundle impact zero on **`@skribbl/shared`** (still Zod + TS only).

### Testing requirements

- **Vitest:** `@skribbl/shared` — schema rejection tests for new unions; `@skribbl/server` — room manager + handler integration tests with **mock WebSockets** if needed (`ws` package types) or lightweight real `WebSocketServer` in test.
- **Playwright:** Out of scope for 1.2 (covered by Epic 1 UI stories); do not block on E2E here.

### UX / product

- **No mandatory lobby UI** in this story—server-only foundation. Stories **1.3–1.4** will add copy/paste UX; **1.5+** nickname/avatar—do not scope those into `createRoom`/`joinRoom` unless the epics explicitly require placeholder fields (default: **defer** identity fields).

### Cross-story context (Epic 1)

- **Depends on:** Story **1.1** — monorepo, shared Zod parsers, `createGameServer`, `/healthz`.
- **Unlocks:** **1.3** (shareable link/copy feedback needs a real room code); **1.4** (join flow against live validation).
- **Future:** Session tokens / reconnect (**Epic 5**) will attach to join flows—avoid painting yourself into a corner: reserve identifiers (`playerId`, `sessionToken`) in types only if you already emit them in events for 1.2; otherwise keep events minimal and extensible.

### Previous story intelligence

From [`1-1-scaffold-monorepo-shared-protocol-package.md`](_bmad-output/implementation-artifacts/1-1-scaffold-monorepo-shared-protocol-package.md):

- **`@skribbl/shared`** publishes **built `dist/`** with `exports` pointing at compiled output—web and server both resolve shared this way; changing `schemas.ts` requires **rebuild** of shared for consumers.
- **`createGameServer()`** returns `{ server, wss }`; `index.ts` is the thin listener entry—extend **message handling** inside the established **safe-parse → switch** flow.
- Review items addressed: bootstrap split (`create-game-server.ts` vs `index.ts`); **`@types/node`** aligned with Node 24—keep new server code consistent.
- Dev-only WS demo on web exists—room work can stay **server-tested** first; optional follow-up to point demo at `createRoom` is **not** required for AC.

### Git intelligence

- Latest work: monorepo initialization with shared Zod protocol and `ws` server—patterns are **greenfield**; follow existing **pino** logging and **`serializeServerEvent`** for all outbound WS JSON.

### Latest technical specifics

- **Stack pins (re-verify before merge):** Next **16.2.4**, React **19.2.5**, **ws 8.20.0**, **Zod 4.3.6**, Node **24.x** ([Source: `_bmad-output/project-context.md`]).
- **WebSocket:** **`ws`** only (ADR / project-context — no Socket.io).

### Project Context Rules

Extracted from `_bmad-output/project-context.md` — **must follow**:

- **`@skribbl/shared`** is the **only** place for wire message shapes; invalid payloads → **`error`** with stable **`code`**.
- **Monorepo:** `pnpm --filter @skribbl/<pkg> <cmd>`; packages **`@skribbl/web`**, **`@skribbl/server`**, **`@skribbl/shared`**.
- **Do not** duplicate schemas in apps; **do not** add Mongo/ORM for MVP room state.
- **`/healthz`** remains on game server; **`WORDS_PATH`** / words load still Story **2.x**.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.2]
- [Source: `_bmad-output/planning-artifacts/epics.md` — NFR-SEC1, NFR-S1, NFR-O1]
- [Source: `_bmad-output/game-architecture.md` — API / realtime pattern, System location mapping, Configuration, Error handling levels]
- [Source: `_bmad-output/project-context.md` — stack and boundaries]
- [Source: `_bmad-output/implementation-artifacts/1-1-scaffold-monorepo-shared-protocol-package.md` — implemented patterns and file list]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

(None)

### Completion Notes List

- Extended `@skribbl/shared` Zod unions with `createRoom`, `joinRoom`, `roomCreated`, `roomJoined`; invalid `joinRoom` / incomplete server events covered by Vitest.
- Added `DEFAULT_MAX_PLAYERS` / `resolveMaxPlayers()` from **`MAX_PLAYERS`** env (default **8**, clamped 2–64).
- Implemented **`Room`**, **`RoomManager`** (`node:crypto` **`randomBytes`** + collision retry; charset **`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`** excludes ambiguous glyphs; **`normalizeRoomCode`** strips whitespace/non-alphanumeric and uppercases).
- WS routing: **`handle-client-command`** exhaustive **`switch`**, structured **`error`** codes **`UNKNOWN_ROOM`**, **`ROOM_FULL`**, **`BAD_CODE`** (extend Story 1.1 **`BAD_PAYLOAD`** / **`INTERNAL`**); **`leaveSocketRoom`** on **`close`** for membership cleanup.
- Verification: **`pnpm test`**, **`pnpm --filter @skribbl/shared build && pnpm -r exec tsc --noEmit`**.

### File List

- `packages/shared/src/schemas.ts`
- `packages/shared/src/schemas.test.ts`
- `apps/server/src/config/game.ts`
- `apps/server/src/create-game-server.ts`
- `apps/server/src/room/room.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/room/room-manager.test.ts`
- `apps/server/src/protocol/handlers/handle-client-command.ts`
- `apps/server/src/room-ws.integration.test.ts`

### Review Findings

- **Report:** `_bmad-output/implementation-artifacts/1.2-REVIEW.md` (status **resolved**).
- **Fixes applied:** `MAX_WS_MESSAGE_BYTES` + `ws` `maxPayload` + inbound size guard before parse; safe `send` with `leaveSocketRoom` on failure; `ROOM_FULL` integration test; one-time warn for invalid `MAX_PLAYERS`; `config/game.test.ts` for inbound byte length.

## Saved questions / clarifications (optional follow-up)

- Exact **room code alphabet** (e.g. exclude ambiguous `0`/`O`)—pick one approach and document in `room-manager` comments.
- Whether `createRoom` should return the code only via server event or also accept a client-provided display name stub—**default:** server-only code in 1.2 unless PM confirms otherwise.

## Change Log

- 2026-04-29 — Code review remediation (payload limits, safe `ws.send`, tests, `MAX_PLAYERS` warn); story marked **done** (`sprint-status`).
- 2026-04-29 — Implemented authoritative rooms: shared protocol, `RoomManager`, WS handlers, Vitest + `tsc` verification (Story 1.2 dev complete → status `review`).
- 2026-04-29 — Story context file generated (`gds-create-story`, epic 1 story 1-2).
