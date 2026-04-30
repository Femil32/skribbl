# Story 3.6: Eraser, fill & clear semantics via op log

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a drawer during the drawing phase,

I want eraser, fill, and clear actions replicated consistently for every participant,

So that viewers stay synced through destructive edits (FR15–FR17, epics “Additional reqs canvas operations”; UX-DR4).

## Acceptance Criteria

1. **Given** the drawer issues **eraser**, **fill**, or **clear** intents **when** the server validates drawer + `drawing` phase + room id **then** each accepted operation receives the **same monotonic ordering contract** as stroke chunks (single authoritative **`seq`** stream per drawing phase — extend the existing counter; do **not** fork a second sequence).
2. **Given** a validated operation **when** the server broadcasts **then** all peers (including the drawer) can apply it in **`seq`** order; late join / reconnect **Story 5.x** is not implemented yet, but **persist enough structure** (Room fields + event shapes) that a future **`snapshot` + op replay** can consume the same ops without a breaking redesign.
3. **Given** **clear** **when** exposed as destructive **then** the drawer must confirm before send (UX-DR4; UX spec: modal pattern for destructive-adjacent actions — DaisyUI `dialog` / confirm pattern).
4. **Given** guessers or wrong phase **when** they attempt canvas ops **then** server rejects with structured **`error`** codes consistent with strokes (**`NOT_DRAWER`**, **`WRONG_PHASE`**, **`BAD_ROOM`**).
5. **Given** complete implementation **when** exercising multiplayer **then** no client-only clears/fills/eraser that skip the wire — **project-context** explicitly forbids client-only clears.

## Out of Scope (explicit)

- **Full `canvas-log.ts` module + snapshot delivery** — Architecture lists `apps/server/src/room/canvas-log.ts`; if not present, implement **minimal** in-Room / RoomManager logic now with a **clear extraction path** (typed append + broadcast helper) so Epic 5 hydration can adopt without renaming wire types.
- **Hint/spoiler logic** — Epic 4.
- **Toolbar polish beyond functional tools** — Icon parity with marketing HTML mocks is nice-to-have; behavior + a11y matter first.

## Tasks / Subtasks

- [x] **Wire protocol (`@skribbl/shared`)**  
  - [x] Extend **`clientCommandSchema`** with drawer-only commands, e.g. (names indicative — pick one consistent naming scheme):  
    - **`drawingCanvasClear`** — `{ type, roomId }`  
    - **`drawingCanvasFill`** — `{ type, roomId, x, y, color }` (CSS-pixel space; **`color`** `#RRGGBB` like strokes)  
    - **`drawingEraserChunk`** — mirror **`drawingStrokeChunk`** shape **or** reuse stroke chunk with a **`tool`** / **`blendMode`** discriminator — **prefer explicit ops** so replay and audits stay obvious.  
  - [x] Extend **`serverEventSchema`** with a single downstream fact type, e.g. **`drawingCanvasOpCommitted`** carrying **`seq`**, **`senderPlayerId`**, **`op`** discriminated union (`clear` | `fill` | `eraserChunk` | …), **or** mirror **`drawingStrokeCommitted`** per op — **must** share one **`seq`** counter with strokes for ordering.  
  - [x] **`serializeClientCommand` / `serializeServerEvent`** — unchanged pattern (parse validates).  
  - [x] Unit tests in **`packages/shared/src/schemas.test.ts`** for new shapes.

- [x] **Server (`RoomManager` + handler)**  
  - [x] Increment **`room.drawingStrokeSeq`** (rename to **`canvasSeq`** only if you update **all** stroke references consistently — optional refactor; otherwise document that **`drawingStrokeSeq` is the unified canvas seq**).  
  - [x] **`handle-client-command.ts`** — dispatch new command types; reuse **`applyDrawingStrokeChunk`** validation skeleton (**phase**, **drawer**, **roomId**).  
  - [x] Broadcast new event to **`room.sockets`** like **`drawingStrokeCommitted`**.  
  - [x] Consider **rate limits** / max eraser points per chunk (reuse stroke chunk **256** cap pattern).

- [x] **Client — toolbar (`DrawingToolbar.tsx`)**  
  - [x] Add **eraser**, **fill**, **clear** controls per UX (**`aria-pressed`** for active tool; clear opens confirm modal).  
  - [x] Lift **`activeTool: 'brush' | 'eraser' | 'fill'`** (or equivalent) next to existing brush state in **`MatchDrawingColumn`** / parents — Story 3.5 lifted color/width there.  
  - [x] Stable **`data-testid`** for new buttons.

- [x] **Client — canvas (`DrawingCanvas.tsx`)**  
  - [x] **Brush:** unchanged composite (`source-over`).  
  - [x] **Eraser:** use **`globalCompositeOperation = 'destination-out'`** (or equivalent) when stroking eraser chunks; restore after draw.  
  - [x] **Fill:** implement flood fill in bitmap space at **`devicePixelRatio`** — convert CSS coords → bitmap coords before **`getImageData`**; write **`putImageData`**; **then** emit **one** fill command with **CSS-space seed** so remote peers match geometry (document tolerance: identical canvas backing store sizing logic is required — reuse existing **`DrawingCanvas`** sizing helpers).  
  - [x] **Clear:** on confirmed action, send clear command; on **`drawingCanvasOpCommitted`**, **`clearRect`** full logical canvas + reset any stroke-local state if needed.  
  - [x] **Replay:** extend guest/host **`drawingStrokeCommitted`** buffers pattern — append **`drawingCanvasOpCommitted`** into the same ordered replay consumer passed into **`DrawingCanvas`** (may rename prop to **`remoteCanvasCommits`**). Drawer skips own **`senderPlayerId`** commits **only** where local optimistic render already applied (mirror stroke rule).

- [x] **Tests**  
  - [x] Vitest: toolbar tool switching + modal gate for clear (RTL).  
  - [x] Server Vitest: unauthorized canvas op → **`NOT_DRAWER`** / **`WRONG_PHASE`**.  
  - [x] Optional pure test: fill helper with tiny synthetic **`ImageData`**.

## Dev Notes

### Architecture compliance

- **Intent upstream, facts downstream** — Client sends commands; server assigns **`seq`** and broadcasts facts ([Source: `_bmad-output/game-architecture.md` — Batched stroke pipeline, Canvas op log + snapshot]).  
- **`canvas-log.ts`** — Documented as **Canvas op ordering** location; **create module** when keeping Room lean, **or** centralize **`appendCanvasOp`** in RoomManager with a **`// TODO: extract to canvas-log.ts for Epic 5`** comment — avoid orphan logic spread across three files.  
- **Single protocol source** — **`packages/shared/src/schemas.ts`** only.

### Code reuse / touch points

| Area | File(s) |
|------|---------|
| Stroke validation + fan-out | `apps/server/src/room/room-manager.ts` (`applyDrawingStrokeChunk`) |
| Command demux | `apps/server/src/protocol/handlers/handle-client-command.ts` |
| Schemas | `packages/shared/src/schemas.ts`, `schemas.test.ts` |
| Polyline draw | `apps/web/src/features/game/canvas/stroke-draw.ts` — extend or add **`drawEraserPolylineOnContext`** sibling |
| Canvas | `apps/web/src/features/game/canvas/DrawingCanvas.tsx` |
| Toolbar | `apps/web/src/features/game/toolbar/DrawingToolbar.tsx` |
| Match shell | `apps/web/src/features/game/components/MatchDrawingColumn.tsx` |
| WS handlers | `apps/web/src/features/lobby/hooks/use-host-create-room.ts`, `use-guest-join-room.ts` |
| Room seq reset | `apps/server/src/room/room.ts`, **`lockWordAndBeginDrawing`** path — ensure **seq resets once per drawing phase** (same as Story 3.4). |

### UX compliance

- **DrawingToolbar** — Full rail: color, size, **eraser, fill, clear** ([Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — DrawingToolbar]).  
- **Clear** — Destructive-adjacent confirmation ([Source: UX spec § Overlays / DrawingToolbar Accessibility]).  
- **60 FPS** — Fill runs on pointer click (single heavy frame acceptable); eraser follows stroke path batching (~50 ms).

### Previous story intelligence (3.5)

- Toolbar is **drawer + `drawing` phase** only; brush color/width persisted across rounds; **canvas picture** resets are **not** the same as brush reset — Story 3.5 warned canvas resets are **server/op-log** (this story).  
- **`normalizeClientStrokeColor` / `clampClientLineWidthPx`** live in **`@skribbl/shared`** — reuse for fill color and eraser line width.  
- **`remoteStrokeCommits`** / replay buffer pattern — **generalize** rather than duplicating a second buffer per op type.

### Git / recent patterns

- Epic 3 commits: feature folder under **`apps/web/src/features/game/`**, PascalCase components, shared schemas-first.

### Latest tech / versions

- Canvas 2D **flood fill** is custom (`getImageData` / stack-based BFS); no new npm dependency required. Stack pins: **`_bmad-output/project-context.md`**.

### Project Context Rules (extract)

- **No client-only clears** — ops must hit server ([Source: `_bmad-output/project-context.md`]).  
- **Monotonic canvas `seq`** — server-only assignment.  
- **Zod** on wire; **`error`** events with stable **`code`**.  
- **pnpm** workspaces; **kebab-case** dirs.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3, Story 3.6]  
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — DrawingToolbar, modals]  
- [Source: `_bmad-output/planning-artifacts/gdd.md` — Tools FR12–FR18]  
- [Source: `_bmad-output/game-architecture.md` — Canvas op log + snapshot, system mapping]  
- [Source: `_bmad-output/implementation-artifacts/3-5-palette-brush-sizing-toolbar.md`]  
- [Source: `_bmad-output/implementation-artifacts/3-4-server-sequencing-fan-out-stroke-batches-live.md`]

## Dev Agent Record

### Agent Model Used

Cursor agent (GPT-5.2)

### Debug Log References

### Completion Notes List

- Implemented **`drawingCanvasClear`**, **`drawingCanvasFill`**, **`drawingEraserChunk`** client commands and **`drawingCanvasOpCommitted`** server event with discriminated **`op`** payload; unified **`room.drawingStrokeSeq`** for strokes and canvas ops.
- **`RoomManager.validateDrawerCanvasCommand`** + **`applyDrawingCanvasCommand`** mirror stroke validation; integration tests for **`NOT_DRAWER`** and **`WRONG_PHASE`** on canvas clear.
- Web: **`remoteCanvasCommits`** (`CanvasReplayEvent[]`) in host/guest hooks; **`DrawingCanvas`** replays strokes + ops, eraser via **`destination-out`**, fill via **`flood-fill.ts`**, clear via transport + **`clearCanvas()`** ref; toolbar uses DaisyUI-style **`modal modal-open`** (no native `showModal` in jsdom).
- Full **`pnpm test`** and **`pnpm typecheck`** pass.

### File List

- `packages/shared/src/schemas.ts`
- `packages/shared/src/schemas.test.ts`
- `packages/shared/src/index.ts`
- `apps/server/src/room/room.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/protocol/handlers/handle-client-command.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/src/features/game/canvas/DrawingCanvas.tsx`
- `apps/web/src/features/game/canvas/stroke-draw.ts`
- `apps/web/src/features/game/canvas/flood-fill.ts`
- `apps/web/src/features/game/canvas/flood-fill.test.ts`
- `apps/web/src/features/game/toolbar/DrawingToolbar.tsx`
- `apps/web/src/features/game/toolbar/DrawingToolbar.test.tsx`
- `apps/web/src/features/game/components/MatchDrawingColumn.tsx`
- `apps/web/src/features/game/components/GamePage.tsx`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3-6-eraser-fill-clear-semantics-via-op-log.md`

## Change Log

- **2026-04-30** — Story 3.6 implemented: wire protocol, server fan-out, client toolbar/canvas/replay, tests; status → review.
- **2026-04-30** — Code review remediation: replay after resize (`layoutGeneration` + watermark only on backing-store resize), `seq`-sorted replay, server-authoritative clear, `BAD_ROOM` integration test; status → done.
