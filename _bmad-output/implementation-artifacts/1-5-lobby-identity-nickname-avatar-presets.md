# Story 1.5: Lobby identity — nickname & avatar presets

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a participant,
I want to pick a display name and avatar preset before entering play,
so that everyone recognizes me without accounts (FR3, NFR-SEC2).

## Acceptance Criteria

1. **Given** host or guest lobby entry **when** the player submits **nickname** and optional **avatar preset** **then** the client sends identity through **`@skribbl/shared`**-validated commands (no ad-hoc `JSON.stringify` shapes) **and** the server **stores** session identity keyed to that connection/player slot before any lobby fan-out that includes names (Story **1.6** will consume the same store).
2. **Given** any nickname **when** it is accepted by the server **then** it is **sanitized server-side** (strip/neutralize HTML/markup/script-relevant patterns per NFR-SEC2) with **bounded length**; the canonical value used from that point forward is the **sanitized** string **and** clients never treat server echo as HTML — render as plain text only.
3. **Given** invalid identity (empty required nickname, overlong after trim, etc.) **when** the client submits **then** **`error`** uses stable **`code`** strings and **neutral** copy; **given** server rejects identity **then** UI maps codes through [`protocol-error-message.ts`](../../apps/web/src/features/lobby/lib/protocol-error-message.ts) and ties field-level errors to **`aria-describedby`** / labels per UX Form Patterns (UX-DR12).
4. **Given** avatar presets **when** the UX offers them **then** presets are a **fixed allow-list** (ids in **`@skribbl/shared`**) — **no** free-text avatar strings from clients; **optional** preset defaults to a defined room default (document choice in Dev Agent Record).
5. **Given** host flow ([`LobbyHostPage`](../../apps/web/src/features/lobby/components/LobbyHostPage.tsx)) **when** creating a room **then** nickname (required) + avatar preset are collected **before** or **as part of** the same interaction that establishes the room so the host is not anonymous when Epic **1** lobby features land; **given** guest flow ([`JoinRoomClient`](../../apps/web/src/app/join/JoinRoomClient.tsx)) **when** joining **then** the same fields are required **before** `joinRoom` is sent (extend the join form; do not regress paste-friendly code behavior from Story **1.4**).
6. **Wire contract:** extend **`roomJoined`** / **`roomCreated`** (or add a dedicated ack event if you prefer strict backwards compatibility) so the joining client receives **`playerId`** and an echo of **sanitized** display name + **avatar preset id** for downstream roster (minimum: client state ready for **1.6**). Exhaustive **`switch`** on **`ServerEvent`** everywhere events are demuxed ([`useHostCreateRoom`](../../apps/web/src/features/lobby/hooks/use-host-create-room.ts), [`useGuestJoinRoom`](../../apps/web/src/features/lobby/hooks/use-guest-join-room.ts)).

## Tasks / Subtasks

- [x] **Shared protocol & presets** (AC: 1, 4, 6)
  - [x] Add Zod fields for identity on **`createRoom`** and **`joinRoom`** (or justify a separate **`setLobbyIdentity`** command in Dev Notes — if separate, both host and guest must still hit it before “success” UI).
  - [x] Export a small **`avatarPresets`** allow-list (id + optional label for UI) from **`@skribbl/shared`**; unit-test unknown ids rejected server-side.
  - [x] Extend **`serverEventSchema`** for **`roomCreated` / `roomJoined`** (or new event) with **`playerId`**, sanitized nickname, **`avatarPresetId`** — keep **`phase: "lobby"`** consistent.
  - [x] Add **`serializeCreateRoomCommand` / `serializeJoinRoomCommand`** updates in [`ws-client.ts`](../../apps/web/src/lib/ws-client.ts) mirroring existing patterns.
- [x] **Server: sanitize + attach identity** (AC: 1, 2, 3)
  - [x] Implement pure **`sanitizeDisplayName(raw: string): string`** (or equivalent) in **`packages/shared`** or **`apps/server`** — prefer **shared** if used in tests from both sides; **no** `dangerouslySetInnerHTML` consumers.
  - [x] In [`handle-client-command.ts`](../../apps/server/src/protocol/handlers/handle-client-command.ts), validate identity **before** emitting success; map failures to **`error`** codes (add to client message map).
  - [x] Extend [`Room`](../../apps/server/src/room/room.ts) / **`RoomManager`** to map **`WebSocket` → `{ playerId, displayName, avatarPresetId }`** (or parallel structure) while keeping capacity/`playerCount` semantics from **1.2**.
- [x] **Web UI** (AC: 3, 5)
  - [x] **Host:** identity fields on lobby entry — either gate “Create room” behind a short form or collect then open WS (must not fire blank `createRoom`).
  - [x] **Guest:** single card flow: room code + nickname + avatar preset; preserve **`normalizeRoomCode` / `isValidRoomCodeForJoin`** from **`@skribbl/shared`**; keep accessibility from **1.4**.
  - [x] DaisyUI controls; visible **`label`**s; **`aria-describedby`** for errors; avatar preset grid/chips as **`button`**s with **`aria-pressed`** where appropriate [Source: UX spec §Form Patterns / toolbars].
- [x] **Tests** (AC: 1–6)
  - [x] Vitest: sanitization edge cases (`<script>`, entities, length, unicode); schema rejects invalid commands; server integration: join/create with identity returns expected ack fields.
  - [x] `pnpm --filter @skribbl/shared test`, `pnpm --filter @skribbl/server test`, `pnpm --filter @skribbl/web test`, `pnpm -r exec tsc --noEmit`, `pnpm --filter @skribbl/web build`.

## Dev Notes

### Architecture compliance

- **Single source of truth:** all new shapes in [`packages/shared/src/schemas.ts`](../../packages/shared/src/schemas.ts); parse with **`safeParseClientCommand` / `parseClientCommand`** on inbound server traffic; **`serializeClientCommand`** outbound on web.
- **Authority:** server owns player id assignment and sanitized nickname echo; client displays facts only.
- **Realtime:** keep **one** WS per flow; identity piggybacks on existing create/join sequence — do not drop socket after ack if **1.6** expects the same connection (per **1.4** Dev Agent Record).

### File structure (create / touch)

| Area | Path |
|------|------|
| Wire schemas | `packages/shared/src/schemas.ts`, `packages/shared/src/index.ts` |
| Sanitization / presets | `packages/shared/src/player-identity.ts` (suggested) or `apps/server/src/...` with shared tests |
| Serialize helpers | `apps/web/src/lib/ws-client.ts` |
| Protocol copy | `apps/web/src/features/lobby/lib/protocol-error-message.ts` |
| Handlers | `apps/server/src/protocol/handlers/handle-client-command.ts` |
| Room state | `apps/server/src/room/room.ts`, `apps/server/src/room/room-manager.ts` |
| Host UI | `apps/web/src/features/lobby/components/LobbyHostPage.tsx`, `use-host-create-room.ts` |
| Guest UI | `apps/web/src/app/join/JoinRoomClient.tsx`, `use-guest-join-room.ts` |

### Technical requirements (guardrails)

- **NFR-SEC2:** Treat display names like future chat input — strip tags/control chars as needed; prefer **whitelist** printable text where practical.
- **NFR-O1:** No stack traces over WS; stable **`error.code`**.
- **Exhaustive switches** on **`ServerEvent`** / **`ClientCommand`**; use `never` for exhaustiveness.
- **Dependency budget:** Tailwind + DaisyUI only on web; no new UI kits.

### Testing requirements

- Shared pure functions: fast unit tests.
- Server: extend existing integration style ([`room-ws.integration.test.ts`](../../apps/server/src/room-ws.integration.test.ts) or handler tests).
- Invalid Zod payloads → structured **`error`**, not silent ignore.

### UX / product

- [Source: `ux-design-specification.md` — Form Patterns: nickname required; avatar optional preset; validate on submit; lazy blur optional; don’t block join on avatar beyond “default preset”.]
- Match tone: neutral, actionable errors; no blame.

### Cross-story context (Epic 1)

- **Depends on:** **1.2** — rooms, codes, capacity; **1.3** — host lobby shell; **1.4** — join URL + hook patterns + WS kept open.
- **Unlocks:** **1.6** — live roster can list **avatar + sanitized name + host badge**; **1.7** — connection banner unchanged.
- **Avoid:** **`startMatch`**, full roster UI, chat, match phases — out of scope here.

### Previous story intelligence

From [`1-4-join-flow-ux-paste-friendly-code-entry.md`](1-4-join-flow-ux-paste-friendly-code-entry.md):

- Reuse **`useGuestJoinRoom`** / **`JoinRoomClient`** patterns: **`useLayoutEffect`** for instant **`connecting`**, **`safeParseServerEvent`**, **`reachedJoinedRef`**, **`messageForProtocolErrorCode`**.
- Room code logic lives in **`@skribbl/shared`** [`room-code.ts`](../../packages/shared/src/room-code.ts) — do not fork normalization.
- **`JOIN_NOT_ALLOWED`** placeholder exists for future phase gating — identity errors should use **new** distinct codes (e.g. **`BAD_NICKNAME`** / **`INVALID_AVATAR`** — pick consistent UPPER_SNAKE stable names).

### Git intelligence

- Recent commits: join flow, shareable link, authoritative rooms — extend **`features/lobby`** and shared **schemas** rather than new top-level feature islands.

### Latest technical specifics

- Stack pins: Next **~16.2**, React **~19**, Zod **4.x**, **`ws`**, Node **24** — see [`project-context.md`](../project-context.md) and [`game-architecture.md`](../game-architecture.md).

### Project Context Rules

From `_bmad-output/project-context.md`:

- **All wire JSON** through **`@skribbl/shared`**; structured **`error.code`** on failures.
- **Naming:** `kebab-case` dirs, **`PascalCase.tsx`**, **`camelCase`** functions.
- **Do not** add Socket.io or duplicate message types in apps.
- **`packages/shared`:** only Zod + TS — no React/`ws` imports.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.5, FR3, NFR-SEC2]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Form Patterns, Session bootstrap]
- [Source: `_bmad-output/planning-artifacts/prd.md` — NFR-SEC2]
- [Source: `_bmad-output/game-architecture.md` — Rooms & identity, lobby module map, playerJoined mention]

## Dev Agent Record

### Agent Model Used

Cursor agent (Claude)

### Debug Log References

### Completion Notes List

- **Protocol:** Identity is inline on `createRoom` / `joinRoom` (fewest round-trips). Commands carry `displayName` + optional `avatarPresetId` (Zod enum from shared). `roomCreated` / `roomJoined` echo `playerId`, sanitized `displayName`, and `avatarPresetId` (`phase: "lobby"` unchanged).
- **Default avatar:** `DEFAULT_AVATAR_PRESET_ID` = `preset-1` (Cyan preset). Nickname max length: `NICKNAME_MAX_GRAPHEMES` = **24** (within story 16–32 guidance), enforced with `Intl.Segmenter` when available.
- **Sanitization (shared):** `sanitizeDisplayName` strips script/style blocks, iteratively removes angle-bracket tags, strips stray `<`/`>`, removes control chars (except normal spaces preserved via collapse), normalizes interior whitespace. Plain-text UI only for name echo.
- **Server:** `RoomManager` stores `LobbySessionIdentity` per socket; `parseLobbyPlayer` validates → `BAD_NICKNAME` | `NICKNAME_TOO_LONG` | `INVALID_AVATAR`. Integration tests cover happy path + empty name + ROOM_FULL.
- **Web:** Host form before WS open; guest `/join` collects code (paste-friendly + readonly valid `?code=`) + name + preset before `joinRoom`. Protocol errors mapped; optional `eslint-disable-next-line` for intentional `connecting` sync in `use-host-create-room` (WS effect).

### File List

- `packages/shared/src/player-identity.ts`
- `packages/shared/src/player-identity.test.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/schemas.test.ts`
- `packages/shared/src/index.ts`
- `apps/server/src/room/lobby-session.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/room/room-manager.test.ts`
- `apps/server/src/protocol/handlers/handle-client-command.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/src/lib/ws-client.ts`
- `apps/web/src/features/lobby/lib/protocol-error-message.ts`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Open questions _(non-blocking; resolve in implementation)_

- Whether **`createRoom`/`joinRoom`** carry identity inline vs a follow-up **`setLobbyIdentity`** command — prefer **fewest round-trips** consistent with AC wording (“submitted” with join forms).
- Exact nickname max length (recommend **16–32** graphemes; document in shared constant).

## Change Log

- 2026-04-29: Story 1.5 implemented — shared identity + presets, server sanitize/store, host/guest UI, tests; sprint status → review.
- 2026-04-29: Follow-up — sprint status **done** after code review fixes (`NICKNAME_MAX_GRAPHEMES`, a11y protocol `aria-describedby`, sanitize/length parity UI, tab/line normalization in `sanitizeDisplayName`, integration tests for `INVALID_AVATAR` / `NICKNAME_TOO_LONG`).
