# Story 1.6: Live roster, host badge & start gate

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a host with friends ready,
I want a live roster showing presence and the ability to start only when rules allow,
so that sessions kick off fairly (FR4, UX-DR8 lobby slice).

## Acceptance Criteria

1. **Given** two or more sanitized players connected in **lobby** **when** the **host** sends **`startMatch`** (via `@skribbl/shared` schema) **then** the server accepts, enforces **≥2 connected players**, and moves the room into a **post-start lobby handshake** state that Epic **2.1** can extend (e.g. `Room.phase` beyond `"lobby"` **or** a dedicated ack event — document the chosen contract in Dev Agent Record) **and** non-host clients receive the same factual transition (no client-only phase).
2. **Given** fewer than two players **when** the host sends **`startMatch`** **then** the server responds with structured **`error`** (stable **`code`**, neutral **optional** `message`) and **does not** change phase.
3. **Given** a non-host player **when** they send **`startMatch`** **then** the server rejects with structured **`error`** (host-only rule).
4. **Given** any join or leave in lobby **when** membership changes **then** every client still in that room receives a **roster update** over the existing WebSocket (no full-page refresh): each row includes **`playerId`**, **sanitized** `displayName`, `avatarPresetId`, and **`isHost`** (single host — the room creator’s socket identity from [`Room.hostSocket`](../../apps/server/src/room/room.ts)); list order is deterministic (document rule: e.g. join order or sorted by `playerId`).
5. **Given** the lobby UI **when** the local client is host **then** **Start** is the **primary** action only when start rules pass (≥2 players, still in lobby — UX hierarchy [Source: `ux-design-specification.md` — Button Hierarchy]); **guests** do not see a misleading primary **Start** CTA.
6. **Given** a player disconnects **when** the socket is removed from the room **then** remaining clients receive an updated roster (and **host promotion** already in [`leaveSocketRoom`](../../apps/server/src/room/room-manager.ts) must remain consistent — **`isHost`** on roster reflects the **current** host).
7. **Wire contract:** extend [`clientCommandSchema`](../../packages/shared/src/schemas.ts) with **`startMatch`**; extend [`serverEventSchema`](../../packages/shared/src/schemas.ts) with at least: **(a)** a **roster snapshot** event (name chosen consistently, e.g. `lobbyRoster` / `rosterUpdated`) carrying `players[]` + `roomId`, and **(b)** an event or phase field for successful start so clients can disable join/start appropriately; add **`serializeClientCommand` / `ws-client`** helpers; **exhaustive** `switch` on **`ServerEvent`** / **`ClientCommand`** in all demux sites ([`use-host-create-room.ts`](../../apps/web/src/features/lobby/hooks/use-host-create-room.ts), [`use-guest-join-room.ts`](../../apps/web/src/features/lobby/hooks/use-guest-join-room.ts), [`handle-client-command.ts`](../../apps/server/src/protocol/handlers/handle-client-command.ts)).
8. **Join-after-start (coordination with 1.2/1.4):** if the room has left lobby for match start, **`joinRoom`** must fail with an existing or **new** stable **`error.code`** (e.g. align with placeholder **`JOIN_NOT_ALLOWED`** from Story **1.4** notes) so UX can show “game already started” without blaming the player.

## Tasks / Subtasks

- [x] **Shared protocol** (AC: 7, 8)
  - [x] Add `startMatch` command (minimal payload — prefer empty object / no extra fields unless needed).
  - [x] Add roster event: `players: z.array(z.object({ playerId, displayName, avatarPresetId, isHost: z.boolean() }))` (reuse `avatarPresetIdSchema`; names stay plain-text).
  - [x] Add start-ack event **or** phase-bearing event consistent with AC1; keep **`phase`** literals typed — avoid `string`.
  - [x] Export types; unit-test schema parse for golden payloads.
- [x] **Server: roster + start gate** (AC: 1–4, 6–8)
  - [x] Central helper: build roster DTO from `Room` + `socketLobbyIdentity` + `hostSocket` → sorted/player list.
  - [x] After successful `createRoom` / `joinRoom`, **broadcast** roster to **all** sockets in room (including actor).
  - [x] On `leaveSocketRoom`, after mutating membership, **broadcast** roster to survivors (skip dead sockets).
  - [x] Implement `startMatch`: resolve room from socket; verify host; verify `playerCount >= 2`; verify phase is pre-start lobby; then transition + fan-out ack; **block** further joins per AC8.
  - [x] Map failures to stable codes: e.g. `NOT_HOST`, `NOT_ENOUGH_PLAYERS`, `WRONG_PHASE`, `JOIN_NOT_ALLOWED` (reuse names if already referenced in app).
- [x] **Web UI** (AC: 5)
  - [x] Lobby roster component (new): **`LobbyPlayerRoster`** under `features/lobby/components/` — rows: avatar preset + name + host badge + optional connection dot placeholder (full disconnect styling can stay minimal until **1.7**, but **a11y:** status not color-only per UX-DR8).
  - [x] Host: **Start** button wired to **`startMatch`**; disabled + `aria-disabled` / helper text when `<2` players; loading/disabled while awaiting ack.
  - [x] Guest: no primary Start; optional muted copy (“Waiting for host”) — align with UX Button Hierarchy.
  - [x] Map new **`error.code`** entries in [`protocol-error-message.ts`](../../apps/web/src/features/lobby/lib/protocol-error-message.ts).
- [x] **Tests** (AC: 1–8)
  - [x] Vitest integration: two clients join → both receive roster with correct host badge; third joins → three rows; one leaves → updates.
  - [x] Start: host with 1 player → error; with 2 → success + phase/event assertion; non-host → `NOT_HOST`.
  - [x] Join after start → rejected code.
  - [x] `pnpm --filter @skribbl/shared test`, `pnpm --filter @skribbl/server test`, `pnpm --filter @skribbl/web test`, `pnpm -r exec tsc --noEmit`, `pnpm --filter @skribbl/web build`.

## Dev Notes

### Architecture compliance

- **Single source of truth:** all new shapes in [`packages/shared/src/schemas.ts`](../../packages/shared/src/schemas.ts); parse inbound commands with existing patterns in [`handle-client-command.ts`](../../apps/server/src/protocol/handlers/handle-client-command.ts).
- **Authority:** host flag and start eligibility are **server-computed**; UI only reflects facts.
- **Broadcast:** prefer one roster event type for join, leave, and initial hydrate so the client keeps a single reducer path.
- **Coordination with Epic 2:** choose a `Room.phase` value or event name that **`match-state-machine` (Story 2.1)** can adopt without renaming public wire types — document the handshake in Dev Agent Record.

### File structure (create / touch)

| Area | Path |
|------|------|
| Schemas | [`packages/shared/src/schemas.ts`](../../packages/shared/src/schemas.ts), [`packages/shared/src/index.ts`](../../packages/shared/src/index.ts), schema tests |
| Serialize | [`apps/web/src/lib/ws-client.ts`](../../apps/web/src/lib/ws-client.ts) |
| Protocol errors | [`apps/web/src/features/lobby/lib/protocol-error-message.ts`](../../apps/web/src/features/lobby/lib/protocol-error-message.ts) |
| Handler | [`apps/server/src/protocol/handlers/handle-client-command.ts`](../../apps/server/src/protocol/handlers/handle-client-command.ts) |
| Room aggregate | [`apps/server/src/room/room.ts`](../../apps/server/src/room/room.ts) (`RoomPhase` extension), [`apps/server/src/room/room-manager.ts`](../../apps/server/src/room/room-manager.ts) |
| Integration tests | [`apps/server/src/room-ws.integration.test.ts`](../../apps/server/src/room-ws.integration.test.ts) |
| Hooks | [`use-host-create-room.ts`](../../apps/web/src/features/lobby/hooks/use-host-create-room.ts), [`use-guest-join-room.ts`](../../apps/web/src/features/lobby/hooks/use-guest-join-room.ts) |
| UI | [`LobbyHostPage.tsx`](../../apps/web/src/features/lobby/components/LobbyHostPage.tsx), [`JoinRoomClient.tsx`](../../apps/web/src/app/join/JoinRoomClient.tsx) — embed roster + start (host only) |

### Technical requirements (guardrails)

- **NFR-O1:** No stack traces over WS; stable **`error.code`**.
- **NFR-SEC2:** Roster display names are **already sanitized** server-side from Story **1.5** — render **plain text** only.
- **Exhaustive switches** on **`ServerEvent`** / **`ClientCommand`**; `never` for exhaustiveness.
- **No new UI kits** — Tailwind + DaisyUI only.
- **Duplication:** do not re-implement identity parsing — reuse `LobbySessionIdentity` / room maps from [`room-manager.ts`](../../apps/server/src/room/room-manager.ts).

### Testing requirements

- Prefer extending existing **WS integration** style over mocking the whole stack.
- Assert **broadcast** semantics (listener on peer socket), not only ack to actor.

### UX / product

- [Source: `ux-design-specification.md` — **PlayerRoster**: lobby + match; avatar + name + host badge; list semantics; status not color-only.]
- [Source: `ux-design-specification.md` — **Lobby**: “Waiting for players” empty state; live updates without refresh.]
- Host-only **Start** primary; guests must not see deceptive primary Start.

### Cross-story context (Epic 1)

- **Builds on:** **1.5** — `playerId`, display name, avatar on `roomCreated` / `roomJoined`; [`lobby-session.ts`](../../apps/server/src/room/lobby-session.ts) identity store.
- **Unlocks:** **1.7** — connection banner variants can key off roster + connection state; **2.1** — consumes post-lobby start handshake.
- **Out of scope:** full match UI, word choice, timers, chat — do not implement Epic **2** gameplay here.

### Previous story intelligence

From [`1-5-lobby-identity-nickname-avatar-presets.md`](1-5-lobby-identity-nickname-avatar-presets.md):

- Identity lives on **`createRoom` / `joinRoom`**; **`roomCreated` / `roomJoined`** echo **`playerId`** + sanitized name + avatar — roster should **match** those fields for the local player.
- **`protocol-error-message.ts`** is the single map for user-facing protocol errors — add new start/join codes there.
- **`RoomManager.leaveSocketRoom`** already reassigns **`hostSocket`** — roster **`isHost`** must follow that logic.
- Keep **one WS** per client through lobby → start; do not regress **1.4** join URL behavior.

### Git intelligence

- Recent work: **1.5** `8c1e789` — lobby identity, `LobbyHostPage` / `JoinRoomClient`, shared schemas — extend these files rather than new parallel flows.

### Latest technical specifics

- Stack pins: Next **~16.2**, React **~19**, Zod **4.x**, Node **24**, `ws` — see [`project-context.md`](../project-context.md) and [`game-architecture.md`](../game-architecture.md).
- Architecture lists **`startMatch`** (client) and **`playerJoined`** (server) as protocol members — this story should align names: either adopt **`playerJoined`**-style deltas **or** a single **`lobbyRoster`** snapshot event (pick one pattern and use it consistently to avoid duplicate fan-out logic).

### Project Context Rules

From `_bmad-output/project-context.md`:

- **All** wire JSON through **`@skribbl/shared`**; structured **`error.code`** on failures.
- **Naming:** `kebab-case` dirs, **`PascalCase.tsx`**, **`camelCase`** functions.
- **Do not** add Socket.io or duplicate message types in apps.
- **`packages/shared`:** only Zod + TS — no React/`ws` imports.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.6, FR4]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR8 / PlayerRoster, Button Hierarchy, lobby journey]
- [Source: `_bmad-output/game-architecture.md` — Commands/events (`startMatch`, `playerJoined`), no-accounts host trust]

## Dev Agent Record

### Agent Model Used

Composer (GPT-based), Cursor IDE

### Debug Log References

- Stale **`packages/shared/dist`** caused **`lobbyRoster`** parse failures at runtime (`serializeServerEvent` threw); root **`pnpm run test`** / **`pnpm run build`** run **`@skribbl/shared` build** first — rebuild shared after schema edits when tooling resolves **`dist`**.

### Completion Notes List

- **Wire contract:** `roomPhaseSchema` (`"lobby" | "matchStarting"`). **`Room.phase`** transitions **lobby → matchStarting** on successful **`startMatch`**. Clients receive **`matchStarting`** `{ roomId, phase: "matchStarting" }` (fan-out to all sockets). **`roomCreated` / `roomJoined`** carry **`phase`** from the server room. **Epic 2.1** can extend **`matchStarting`** or add follow-on events without renaming these literals.
- **Roster:** single snapshot event **`lobbyRoster`** `{ roomId, players[] }` with **`LobbyRosterPlayer`** fields; **`players`** sorted **deterministically by `playerId` (lexicographic)**. Broadcast after create/join, after **`leaveSocketRoom`** survivors (host promotion preserves **`isHost`**).
- **`startMatch`** command: `{ type: "startMatch" }`. Errors **`NOT_HOST`**, **`NOT_ENOUGH_PLAYERS`**, **`WRONG_PHASE`**, **`INTERNAL`** (no room). **`joinRoom`** when **`phase !== "lobby"`** → **`JOIN_NOT_ALLOWED`**.
- UI: **`LobbyPlayerRoster`** (+ text status lines, not color-only); host **`Start`** is **`btn-primary`** only when **`canOfferStart`**; guests see muted waiting copy without a primary Start CTA.

### File List

- `packages/shared/src/schemas.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/schemas.test.ts`
- `apps/server/src/room/room.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/protocol/handlers/handle-client-command.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/src/lib/ws-client.ts`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/features/lobby/components/LobbyPlayerRoster.tsx`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `apps/web/src/features/lobby/lib/protocol-error-message.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- Story 1.6: live **`lobbyRoster`**, host **`startMatch`** gate with **`matchStarting`** ack, deterministic roster order, **`JOIN_NOT_ALLOWED`** after start, WS integration tests, lobby UI roster + Start (2026-04-29).

### Review Findings (2026-04-29)

- [x] [Review][Patch] Guest lobby did not reflect **`matchStarting`** — `useGuestJoinRoom` updated `phase` but **`JoinRoomClient`** still showed only “Waiting for the host…”, weakening AC1’s “same factual transition” for non-hosts. Addressed: mirror host info alert when **`guestState.phase === "matchStarting"`** (`apps/web/src/app/join/JoinRoomClient.tsx`).
- [x] [Review][Dismiss] Guest joined view uses **`btn-primary`** on **Create a room** — AC5 targets a misleading primary **Start** for guests; this CTA is intentional funnel, not Start.

## Open questions _(non-blocking)_

- **Resolved:** Post-start uses **`matchStarting`** + shared **`roomPhaseSchema`**; roster order **sorted by `playerId`**.
