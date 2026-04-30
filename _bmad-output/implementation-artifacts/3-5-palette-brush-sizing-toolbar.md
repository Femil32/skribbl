# Story 3.5: Palette & brush sizing toolbar

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a drawer during the drawing phase,

I want obvious color and brush-thickness controls,

So that drawing stays expressive without hunting through UI (FR13, FR14, UX-DR4 partial — via epics alignment).

## Acceptance Criteria

1. **Given** the local player is the current drawer **and** match phase is `drawing` **when** they view the match canvas region **then** a toolbar exposes color selection and brush size selection with clear pressed vs idle states (`aria-pressed="true"` / `"false"` as appropriate).
2. **Given** the local player is **not** the drawer **or** phase is **not** `drawing` **when** they view the match shell **then** the drawing toolbar is **not** available as an active control surface (hidden **or** disabled with no misleading `aria-pressed` on usable buttons — prefer hidden + short hint for guessers if space allows, per UX ownership notes).
3. **Given** the drawer changes color or brush size **when** they continue drawing **then** new stroke batches use the selected `#RRGGBB` color and `lineWidthPx` consistently with `@skribbl/shared` `drawingStrokeChunk` validation (`color` regex, `lineWidthPx` between 1 and 96 inclusive).
4. **Given** rounds advance **when** the drawer returns to a later drawing phase **then** the last chosen color and brush size remain selected until the user changes them (tool persistence across rounds). Canvas **picture** resets are governed by server/op-log rules (Story 3.6 — eraser/fill/clear); **do not** reset brush picks when the canvas clears.

## Out of Scope (explicit)

- **Eraser, fill, canvas clear** — Story **3.6** only (FR15–FR17). Do not add those tools here even if UX mentions them on the full `DrawingToolbar` vision.
- **New wire protocol fields** — `drawingStrokeChunk` / `drawingStrokeCommitted` already carry `color` and `lineWidthPx`; reuse them.

## Tasks / Subtasks

- [x] **Drawing toolbar UI (client)**  
  - [x] Add a focused component (e.g. `apps/web/src/features/game/toolbar/DrawingToolbar.tsx` or adjacent kebab-case folder under `features/game/`) implementing **color presets** + **brush size presets** using **Tailwind + DaisyUI** (`btn`, `btn-group` / `join` patterns) per UX spec component notes.  
  - [x] Ensure minimum desktop hit targets (~44px logical where feasible) and compact horizontal layout with graceful wrap on narrow widths (UX responsive notes).  
  - [x] Stable **`data-testid`** on the toolbar root (e.g. `drawing-toolbar`) for Playwright — aligns with UX test-hook guidance.

- [x] **Gate toolbar by role + phase**  
  - [x] Toolbar interactive **only** when `phase === "drawing"` **and** `localPlayerId === drawerPlayerId` (authoritative drawer id from existing `matchPhase` / lobby hook state — same source as `PhaseBar`).  
  - [x] Otherwise omit toolbar from tab order or render disabled/hidden treatment consistent with **ownership**: guessers must not think they can paint.

- [x] **Wire brush state → `DrawingCanvas`**  
  - [x] Lift `brushColor` and `brushWidthPx` state to the match-shell parent that owns `DrawingCanvas` (do **not** bury defaults only inside `DrawingCanvas` for production match UI).  
  - [x] Pass props through to `DrawingCanvas`; confirm outbound batches still call `serializeClientCommand` with matching `color` / `lineWidthPx` (already implemented in `DrawingCanvas.tsx` flush path).

- [x] **Hex color contract**  
  - [x] Only emit lowercase or uppercase **6-digit** `#RRGGBB` values so Zod `drawingStrokeChunk` color regex never rejects payloads.

- [x] **Integrate into real match flows**  
  - [x] Replace or augment the current **“Full gameplay shell arrives in Epic 3”** placeholder in **`LobbyHostPage`** and **guest `JoinRoomClient`** match branches with the Direction 1 canvas column: toolbar + `DrawingCanvas`.  
  - [x] **`GamePage`** (`/game`): update dev scaffold so it mirrors production wiring (toolbar + shared defaults) for manual QA.

- [x] **Transport plumbing for drawing (if not already done when implementing)**  
  - [x] Host/guest hooks currently **no-op** on `drawingStrokeCommitted` (`use-host-create-room.ts` / `use-guest-join-room.ts`). To satisfy multiplayer correctness **together** with toolbar work, accumulate committed events the drawer **skips visually** (same rule as `DrawingCanvas` — skip `senderPlayerId === localPlayerId`) and pass `remoteCommitted` into `DrawingCanvas`.  
  - [x] Expose a **`sendJsonLine`** (or thin wrapper) so `strokeTransport.sendJsonLine(raw)` matches `DrawingCanvas` expectations without duplicating protocol types outside `@skribbl/shared`.

- [x] **Tests**  
  - [x] Component tests (Vitest + RTL): toolbar renders preset buttons; `aria-pressed` reflects selection; toolbar not interactive when `isDrawer` false or phase ≠ `drawing`.  
  - [x] Optional: snapshot selected color/width propagates to a mocked flush — only if easy without brittle canvas internals (skipped as optional; RTL covers toolbar wiring).

## Dev Notes

### Architecture compliance

- **Single protocol source:** All JSON shapes live in `packages/shared/src/schemas.ts`. Do **not** fork stroke types in apps.
- **Server-authoritative seq:** Unchanged — toolbar only affects **client intent** (`color`, `lineWidthPx` on chunks).
- **Canvas pipeline:** Pointer → local ink → ~50 ms batch — already in `DrawingCanvas`; toolbar must not break flush cadence.

### Code reuse / touch points

| Area | File(s) |
|------|---------|
| Stroke flush + props | `apps/web/src/features/game/canvas/DrawingCanvas.tsx` |
| Polyline render helper | `apps/web/src/features/game/canvas/stroke-draw.ts` |
| Chunk/commit schemas | `packages/shared/src/schemas.ts` (`drawingStrokeChunk`, `drawingStrokeCommitted`) |
| Phase / drawer state | `apps/web/src/features/lobby/hooks/use-host-create-room.ts`, `use-guest-join-room.ts` |
| Match UI shells | `apps/web/src/features/lobby/components/LobbyHostPage.tsx`, `apps/web/src/app/join/JoinRoomClient.tsx` |
| Dev shell | `apps/web/src/features/game/components/GamePage.tsx`, `apps/web/src/app/game/page.tsx` |
| Phase bar (reference) | `apps/web/src/features/match/components/PhaseBar.tsx` |

### UX compliance (summary)

- **DrawingToolbar** intent from UX spec: horizontal rail; **drawer-only** during draw phase; genre-standard grouping (**color + size** now; eraser/fill/clear later).  
- **Accessibility:** `aria-pressed` on toggle-style controls; do not rely on color alone for critical states where feasible (GDD stretch — iconography + labels help).  
- **Canvas** remains pointer-primary; toolbar is not a substitute for keyboard drawing.

### Previous story intelligence (3.4)

- Server assigns monotonic `seq` and broadcasts `drawingStrokeCommitted`; client drawer ignores own commits for replay.  
- Story 3.4 doc listed touched server/shared files; web hooks still need commit buffering for guessers — treat as **implementation dependency** when embedding canvas in lobby/guest pages.

### Git / recent patterns

- Recent epic-3 work batched under stroke capture + fan-out; follow existing **feature-folder** layout under `apps/web/src/features/game/` and **kebab-case** filenames except PascalCase React components.

### Latest tech / versions

- Stack pins in `_bmad-output/project-context.md`: Next ~16.x, React ~19.x, Zod 4.x, DaisyUI + Tailwind — match repo `package.json` at implementation time.

### Project Context Rules (extract)

- Monorepo **`pnpm --filter @skribbl/<pkg>`**; no duplicate wire schemas.  
- **`drawingStrokeChunk`** batching ~50 ms + stroke-end flush — preserve.  
- Invalid payloads → structured **`error`** events — validated commands only.  
- Desktop-first; Canvas CSS-pixel coordinates + DPR already handled in `DrawingCanvas`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3, Story 3.5]  
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — DrawingToolbar, layout Direction 1]  
- [Source: `_bmad-output/game-architecture.md` — Canvas sync, batching, stack]  
- [Source: `_bmad-output/project-context.md` — protocol & folder rules]  
- [Source: `_bmad-output/implementation-artifacts/3-4-server-sequencing-fan-out-stroke-batches-live.md` — seq + fan-out notes]

## Dev Agent Record

### Agent Model Used

Cursor Composer (Claude agent)

### Debug Log References

_None._

### Completion Notes List

- `MatchDrawingColumn` remounts `DrawingCanvas` when `matchRoundIndex` advances so rounds do not stack stale pixels (brush state stays in parent).
- Host/guest lobby hooks: `remoteStrokeCommits` (clear on lobby or `matchRoundIndex` change), append on `drawingStrokeCommitted`, exported `sendGameJsonLine` for stroke transport.
- `LobbyHostPage` / `JoinRoomClient`: lifted brush state survives across rounds; Epic 3 placeholder replaced with live column; wider card during match phases.
- `GamePage`: `use client` dev shell with same column + noop `sendJsonLine` (local ink only).
- Vitest/RTL: `DrawingToolbar.test.tsx`; `GamePage.test` asserts toolbar in canvas region.

### File List

- `apps/web/src/features/game/toolbar/DrawingToolbar.tsx`
- `apps/web/src/features/game/toolbar/DrawingToolbar.test.tsx`
- `apps/web/src/features/game/components/MatchDrawingColumn.tsx`
- `apps/web/src/features/game/components/GamePage.tsx`
- `apps/web/src/features/game/components/GamePage.test.tsx`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- **2026-04-30** — Code review follow-up: `@skribbl/shared` `normalizeClientStrokeColor` / `clampClientLineWidthPx`; `DrawingCanvas` uses them for wire + ink; toolbar uses shared normalizer; replay buffer cap 8192; brush-width RTL test. Marked **done** in sprint-status.
- **2026-04-30** — Story 3.5: palette/brush toolbar, match column integration, stroke commit replay buffer + `sendGameJsonLine`, tests.
