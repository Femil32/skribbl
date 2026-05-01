# Story 5.2: Snapshot + op replay hydration

Status: done

<!-- gds-create-story (2026-05-01). Ultimate context engine analysis completed — comprehensive developer guide created. Depends on Story 5.1 reconnect acceptance path emitting or enabling this hydrate payload. -->

## Story

As a returning client,

I want up-to-date canvas + chat tail restored,

So I can guess mid-round confidently (FR26).

## Acceptance Criteria

1. **Given** successful reconnect acceptance after a transport drop (Story 5.1 — session token / player id validated; same logical player session) **when** the server sends the **hydrate** payload for that socket **then** the client receives **contiguous** drawing-phase canvas ops: every integer **`seq`** from `1` through the room’s current `room.drawingStrokeSeq` exactly once (no gaps, no duplicates) for the **active** drawing phase.
2. **Given** the room is **not** in **`drawing`** (or there is no active canvas op log) **when** hydrate runs **then** canvas portion is a well-defined empty or no-op baseline (no stale ink from a prior round on the reconnecting client).
3. **Given** hydrate **when** the client applies canvas data **then** it **replays** ops in **`seq`** order through the same path as live **`drawingStrokeCommitted`** / **`drawingCanvasOpCommitted`** handling (so clear / fill / eraser / stroke semantics stay identical to Epic 3.4–3.6).
4. **Given** hydrate **when** chat tail is included **then** it is **bounded** (cap documented; consistent with `MAX_CHAT_FEED` order semantics on the client) and each replayed row matches **anti-spoiler rules**: reconnecting player sees the same **per-recipient** text / optional `revealedWord` they would have seen had they been connected at broadcast time (FR21 family — no extra leaks vs live fan-out).
5. **Given** a defect or trim causes non-contiguous **`seq`** in the server buffer **when** the server cannot satisfy AC #1 **then** it must **not** silently skip: emit a structured **`error`** (stable `code`) and/or a dedicated **resync** server event documented in **`@skribbl/shared`** (project rule: never silently skip seq gaps).

## Tasks / Subtasks

- [x] **Shared protocol** (AC: #1, #3, #5) — Extend `packages/shared/src/schemas.ts` with hydrate / resync shapes (single event or small burst is fine; must Zod-parse on both sides). Include canvas op list typed as existing commit payloads **or** a narrow replay DTO that maps 1:1 to `DrawingCanvas` / `CanvasReplayEvent` expectations. Add/adjust `schemas.test.ts`.
- [x] **Server canvas log** (AC: #1–#3, #5) — Introduce an authoritative **per-room, per-drawing-phase** ordered buffer of canvas commits (stroke + `drawingCanvasOpCommitted` payloads with `seq`). **Append on every** `applyDrawingStrokeChunk` / canvas op success path in `apps/server/src/room/room-manager.ts`; **clear** when entering `drawing` (same reset boundary as `room.drawingStrokeSeq = 0`). Prefer a dedicated module (architecture names `apps/server/src/room/canvas-log.ts` — file does **not** exist yet; create it or colocate with clear boundaries).
- [x] **MVP snapshot semantics** (AC: #1) — Without a server raster, interpret “snapshot” as **baseline empty canvas at `seq` 0** + **full ordered op replay** for the current phase, bounded by a documented **max ops** or ring buffer with **hard resync** if over cap (per AC #5). Document the interpretation in dev notes for portfolio readers.
- [x] **Server chat transcript** (AC: #4) — Today chat is **ephemeral** (broadcast-only in `applyChatMessage` / `broadcastCorrectGuess`). Add a **bounded** server-side transcript so hydrate can replay tail. Recommended pattern: on each fan-out, append a transcript record with enough data to synthesize **the reconnecting player’s** view — e.g. store `id`, `ts`, discriminant (`player` | `system` | `correctGuess`), common fields, and either **per-`playerId` text** / `revealedWord` flags captured **at broadcast time** (room ≤8 players keeps this small) **or** a pure replay helper that re-derives visibility; **avoid** reusing **current** drawer/award state for **past** rows unless provably equivalent.
- [x] **Emit hydrate** (AC: #1–#4) — On reconnect acceptance (Story 5.1 hook point: after identity is validated and socket is registered to the room), send hydrate to **that** socket only (others must not see duplicate chat rows). If 5.1 is not merged yet, coordinate on the exact trigger (`roomJoined` extension vs follow-up `roomHydrate` event).
- [x] **Client apply** (AC: #3–#4) — `apps/web/src/features/lobby/hooks/use-host-create-room.ts` and `use-guest-join-room.ts`: handle new event(s); **replace or merge** `remoteCanvasCommits` and `chatFeed` deterministically (avoid duplicating rows already received this session). Reset canvas buffer on phase transitions as today. Ensure `DrawingCanvas` receives sorted replay-compatible events.
- [x] **Tests** — `apps/server/src/room-ws.integration.test.ts`: reconnect fixture asserts **full seq range** replayed; chat tail shows **masked** text for a still-guessing reconnector when history contains an adjudicated guess; gap / overflow path asserts **error or resync**, not silent loss. Reuse patterns from existing `chatCorrectGuess` spoiler tests.

## Dev Notes

### Brownfield reality (read first)

- **`Room`** (`apps/server/src/room/room.ts`) tracks **`drawingStrokeSeq`** but **does not** persist op history; hydrate **cannot** be implemented without new storage + wiring.
- **Architecture** documents `canvas-log.ts` for **seq, snapshot, replay** — implement this story as the **authoritative** home for that responsibility ([Source: `_bmad-output/game-architecture.md` — System location mapping, Canvas op log + snapshot pattern]).
- **Live client path** already appends `drawingStrokeCommitted` / `drawingCanvasOpCommitted` into `remoteCanvasCommits` with `MAX_REMOTE_CANVAS_COMMITS_BUFFER` ([Source: `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`]). Hydrate must feed the **same** `CanvasReplayEvent` shape expected by `DrawingCanvas` ([Source: `apps/web/src/features/game/canvas/DrawingCanvas.tsx` — `remoteCanvasCommits`]).
- **Spoiler-safe chat** is non-negotiable on replay: mirror **`broadcastPlayerChatWithPerRecipientText`** / **`broadcastCorrectGuess`** semantics ([Source: `apps/server/src/room/room-manager.ts`]).

### Architecture compliance

- **Server-authoritative `seq`** — only server assigns; hydrate lists **facts**, not intents ([Source: `_bmad-output/project-context.md` — Engine rules]).
- **Zod-only wire** — all new payloads in `packages/shared`; `safeParseServerEvent` / handler `switch` must stay exhaustive ([Source: `_bmad-output/project-context.md`]).
- **Two-process WS server** — no Next.js route owns game hydrate logic.

### Developer guardrails / file map

| Concern | Location |
| -------- | -------- |
| Room aggregate + seq | `apps/server/src/room/room.ts` |
| Canvas commands + broadcast | `apps/server/src/room/room-manager.ts` |
| Op log module (new) | `apps/server/src/room/canvas-log.ts` (recommended) |
| Wire schemas | `packages/shared/src/schemas.ts` |
| Client demux | `use-host-create-room.ts`, `use-guest-join-room.ts` |
| Canvas replay | `DrawingCanvas.tsx`, `remote-chunk-bridge.ts` |
| Reference prior art (spoiler tests) | `apps/server/src/room-ws.integration.test.ts` |

### Epic 5 cross-story context

- **5.1** — Session tokens & reconnect handshake: hydrate must be **downstream** of “reconnect accepted” ([Source: `_bmad-output/planning-artifacts/epics.md` — Story 5.1]). If 5.1 delivers a new command/event, hydrate should align with that flow without forking identity rules.
- **5.3** — Presence decay UI: do not block on roster icons; hydrate is transport/state recovery only.

### Previous story intelligence

- **No committed story file for 5.1** in-repo at authoring time; treat 5.1 epic text + current `roomJoined` / future token command as the integration contract.
- **4.2 story file** documents spoiler fan-out primitives — **reuse** those primitives for transcript capture, do not fork adjudication ([Source: `_bmad-output/implementation-artifacts/4-2-guess-adjudication-exact-match-spoiler-safe-broadcasts.md`]).
- **4.1** — `MAX_CHAT_FEED` (400); server transcript cap should be **≤ or aligned** with product expectations for reconnect.

### Git intelligence

- Recent work on Epic 4 chat/guesses (`97fcbaf`, `ebea067`) established **`chatCorrectGuess`** / per-recipient **`chatPlayerMessage`** — hydrate must stay consistent with those payloads.

### Latest tech / versions

- Re-verify pins in `_bmad-output/project-context.md` (Next ~16.x, React ~19.x, Zod 4.x, `ws` 8.x) before adding dependencies; prefer **no** new runtime deps for log/buffer.

### Project Context Rules

- Reconnect / late join: **`snapshot` + replay ops since `seq`**; if **`seq`** gap → **resync** path — **never silently skip** ([Source: `_bmad-output/project-context.md` — Engine rules]).
- **Anti-spoiler / chat:** guessing and reveal rules follow GDD — don’t leak the word ahead of server ([Source: `_bmad-output/project-context.md`]).
- **Monorepo commands:** `pnpm --filter @skribbl/server test`, `pnpm --filter @skribbl/shared test` ([Source: `_bmad-output/project-context.md`]).

## Dev Agent Record

### Agent Model Used

_(implementation session — Cursor agent)_

### Debug Log References

_(none)_

### Completion Notes List

- Implemented **`roomHydrate`** (+ **`canvasOpLogResync`**) in `@skribbl/shared` with wire tests; exported **`MAX_CANVAS_OPS_PER_DRAWING_PHASE`** (8192) and **`MAX_HYDRATE_CHAT_TAIL`** (400, aligned with client feed cap).
- **`CanvasPhaseLog`** enforces contiguous **`seq`** append and fail-closed **`CANVAS_OP_LOG_OVERFLOW`** / **`CANVAS_OP_LOG_GAP`**; **`notifyCanvasIntegrityFailure`** emits **`error`** + fan-out **`canvasOpLogResync`** (no silent gap handling).
- **`awaitingReconnect`** identity stash on disconnect when **`phase !== "lobby"`**; **`reconnectHost`** restored for mid-match host reclaim; added **`reconnectPlayer`** for non-host seats; both receive **`sendRoomHydrate`** after handshake.
- Bounded **per-recipient** chat fan-out transcript (`chat-transcript.ts`) replays spoiler-safe **`chatTail`** on hydrate; client **`hydrate-merge`** merges by **`seq`** / **`id`** into existing buffers; guests use **`serializeReconnectPlayerCommand`** after transport drop when a prior join context exists.
- Tests: shared schema round-trips, **`canvas-log.test`**, integration **contiguous seq hydrate** + **spoiler-safe reconnectPlayer**; full **`pnpm --filter @skribbl/server test`** and **`pnpm --filter @skribbl/shared test`** green; **`pnpm --filter @skribbl/web exec tsc --noEmit`** green.

### File List

- `packages/shared/src/schemas.ts`
- `packages/shared/src/schemas.test.ts`
- `packages/shared/src/index.ts`
- `apps/server/src/room/canvas-log.ts`
- `apps/server/src/room/canvas-log.test.ts`
- `apps/server/src/room/chat-transcript.ts`
- `apps/server/src/room/room.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/protocol/handlers/handle-client-command.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/src/features/lobby/lib/hydrate-merge.ts`
- `apps/web/src/features/lobby/lib/protocol-error-message.ts`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/lib/ws-client.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Review Findings

- [x] [Review][Patch] Integration coverage for canvas integrity on wire — `room-ws.integration.test.ts` now asserts `notifyCanvasIntegrityFailure` reaches sockets (`error` + `canvasOpLogResync`) for simulated append failure and hydrate verify failure. [`apps/server/src/room-ws.integration.test.ts`]
- [x] [Review][Defer] `chatSystemMessage` hydrate parity — server does not emit system chat today; no transcript row until a broadcast path exists. Closed as N/A for 5.2.

## Change Log

- 2026-05-01 — Addressed review: integration tests for canvas integrity wire path; overflow unit test fills log via public API; story → `done`.
- 2026-05-01 — Code review (GDS): findings in **Review Findings**; story → `in-progress` (open integration item).
- 2026-05-01 — Story 5.2: snapshot + hydrate wire protocol, server canvas log & chat transcript, reconnect + client merge, tests; status → review.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5, Story 5.2]
- [Source: `_bmad-output/game-architecture.md` — Canvas op log + snapshot, Implementation Patterns §2]
- [Source: `_bmad-output/project-context.md` — full rules]

---

Completion note: Ultimate context engine analysis completed — comprehensive developer guide created.
