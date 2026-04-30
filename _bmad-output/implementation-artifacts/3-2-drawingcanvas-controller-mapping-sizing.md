# Story 3.2: DrawingCanvas controller — mapping & sizing

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the drawer,
I want accurate pointer mapping across DPI/layout changes,
so that strokes land where I aim (UX-DR3, NFR-U1, NFR-P2).

## Acceptance Criteria

1. **Given** a canvas wrapper wired with **ResizeObserver**  
   **When** CSS pixel dimensions of the drawable region change (viewport, breakpoint, font/layout shifts)  
   **Then** backing-store (`canvas.width` / `canvas.height`) and transform/scaling stay aligned so pointer positions map to drawing coordinates **without cumulative drift** on **Chrome and Safari** (minimum browsers per project-context).

2. **Given** pointer events over the drawable canvas  
   **When** `devicePixelRatio` or layout boxes change between events  
   **Then** hit-testing uses **current** layout (`getBoundingClientRect()` or equivalent) so `(clientX/clientY)` map consistently into the same logical drawing coordinate system used by `CanvasRenderingContext2D` after resize.

3. **Given** the canvas is mounted  
   **Then** the `<canvas>` exposes **`role="img"`** and a **descriptive `aria-label`** (e.g. drawing surface purpose—not generic “canvas”; align with UX spec: describe round purpose where props allow a minimal stub until match wiring).

4. **Given** Story 3.1 shell  
   **Then** **`DrawingCanvas`** replaces the inner placeholder inside **`data-testid="canvas-region"`** without breaking landmarks or responsive layout (`main` keeps `min-w-[320px]`, flex/`min-h-0` chain preserved).

## Tasks / Subtasks

- [x] Task 1 — Feature folder + surface component (AC: 1, 2, 4)  
  - [x] 1.1 Add `apps/web/src/features/game/canvas/` per architecture tree (`game-architecture.md` → Client canvas mapping).  
  - [x] 1.2 Implement **`DrawingCanvas`** (client component: **`"use client"`**) as wrapper `<div>` (flex **`flex-1 min-h-0 min-w-0`**) containing `<canvas>` filling the wrapper.  
  - [x] 1.3 **`ResizeObserver`** on the wrapper; debounce/rAF-coalesce if needed to avoid resize storms but remain correct.  
  - [x] 1.4 On resize: read **CSS layout width/height** of the drawable box; set **`canvas.width` / `canvas.height`** using **`Math.round(cssSize * devicePixelRatio)`** (or capped ratio—see Dev Notes); **`canvas.style.width/height`** as **`100%`** or sized via parent so element box matches wrapper.  
  - [x] 1.5 After resizing bitmap: **`ctx.setTransform(1,0,0,1,0,0)`** then **`ctx.scale(dpr, dpr)`** so **all drawing and pointer math use CSS-pixel coordinate space** matching architectural guidance (DPR + layout).  
  - [x] 1.6 Export a pure helper e.g. **`pointerClientToCanvasCss(canvas, clientX, clientY): { x, y }`** using **`getBoundingClientRect()`** and scale **`canvas.width / rect.width`** / **`canvas.height / rect.height`** so backing-store vs CSS mismatches are handled in one place **for Story 3.3 reuse**.

- [x] Task 2 — Accessibility + UX-DR3 partial states stub (AC: 3)  
  - [x] 2.1 `<canvas role="img" aria-label={…} />`; optional **`aria-labelledby`** later—acceptable minimal label string via prop default.  
  - [x] 2.2 Props scaffold for future **`mode: 'drawing' | 'read-only' | 'syncing'`** (Story 3.3+): default **`read-only`** or **`drawing`** stub only—apply **`pointer-events-none`** when **`read-only`** per UX-DR3 (wire fully when match role exists).

- [x] Task 3 — Integrate into `GamePage` (AC: 4)  
  - [x] 3.1 Replace inner “Canvas area” placeholder **`div`** with **`<DrawingCanvas />`** inside **`canvas-region`** **`main`**.  
  - [x] 3.2 Keep **`GamePage`** as a **Server Component** if possible; **`DrawingCanvas`** is the client boundary.

- [x] Task 4 — Tests (Vitest + RTL)  
  - [x] 4.1 Mock **`ResizeObserver`** (invoke callbacks manually like Story 3.1 patterns).  
  - [x] 4.2 Assert **`role="img"`** and **`aria-label`** present.  
  - [x] 4.3 Assert **`canvas.width`/`height`** scale with mocked **`devicePixelRatio`** and container size when observer fires.  
  - [x] 4.4 Unit-test **`pointerClientToCanvasCss`** (edge cases: rect offset, non-1 CSS vs bitmap ratio).

- [x] Task 5 — Verification  
  - [x] 5.1 `pnpm --filter @skribbl/web exec tsc --noEmit`  
  - [x] 5.2 `pnpm --filter @skribbl/web test`  
  - [x] 5.3 Manual resize smoke: `/game`, drag breakpoints, Safari + Chrome—no drift vs fixed crosshair spot (optional visual dot for debug behind **`NODE_ENV`** gate only).

## Dev Notes

### Epic / cross-story context

- **Epic 3** builds drawing pipeline + synced strokes; **3.2** owns **surface geometry + coordinate system only**—no WebSocket batches, no `@skribbl/shared` stroke schemas yet (those land in **3.3**).  
- **3.3** will consume **`pointerClientToCanvasCss`** (or renamed export) for local stroke capture + batching—**do not** fork coordinate logic in a later story.  
- **3.4–3.6**: server sequencing, toolbar, destructive ops—out of scope here.

### Previous story intelligence (3.1)

- **`GamePage.tsx`** layout is stable: **`flex h-screen flex-col`** → header → **`flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden`** → **`main`** (`data-testid="canvas-region"`, **`flex-1 min-h-[320px] min-h-0`**) with inner **`div`** **`min-w-0 flex-1 p-3`**—swap inner content for **`DrawingCanvas`** while preserving **`min-h-0`/`min-w-0`** so flex grandchildren don’t overflow.  
- Route: **`apps/web/src/app/game/page.tsx`** imports **`GamePage`**—unchanged pattern.  
- **Vitest:** **`apps/web/vitest.setup.ts`** RTL **`cleanup`** in **`afterEach`**—follow same setup for new tests.  
- Story **3.1** artifact filename typo **`.md.md`**—new stories should use **single `.md`** extension.

### Architecture compliance

- **Client canvas location:** `apps/web/src/features/game/canvas/*` [Source: `_bmad-output/game-architecture.md` — Directory tree & System location mapping].  
- **Hooks naming:** thin hooks acceptable (**`useCanvasSurface`** optional); avoid Redux [Source: architecture State management].  
- **Rendering:** Canvas 2D; target **~60 FPS** local loop later—this story establishes correctly sized bitmap so redraw isn’t blurry [Source: NFR-P2 / architecture Technical Requirements].  
- **No protocol duplication:** no new Zod in **`packages/shared`** for **3.2**.

### UX compliance

- **UX-DR3:** Wrapper + Canvas 2D; **ResizeObserver** + CSS→backing-store mapping; **`role="img"`** + descriptive label; **`pointer-events`** discipline for non-drawers when props wired [Source: `_bmad-output/planning-artifacts/epics.md` UX block].  
- **UX spec § Drawing Stage:** Pointer-primary; keyboard drawing not required MVP [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Drawing Stage / accessibility bullets].  
- **UX-DR17:** Resize at **`md`/`lg`** boundaries—coordinate mapping must stay consistent [Source: epics UX rollup].

### Library / platform notes (latest MDN-aligned behavior)

- **`canvas.width`/`height` attributes** reset context—always **re-acquire `getContext('2d')` plumbing** after resize (same reference OK but transform cleared).  
- **`window.devicePixelRatio`**: use for HiDPI sharpness; optional **`Math.min(dpr, 2)`** cap if performance degrades on extreme displays—document if used.  
- **`ResizeObserverEntry.devicePixelContentBoxSize`**: pixel-perfect but **not universal**—prefer **`contentRect` + `devicePixelRatio`** baseline for Safari/Chrome MVP unless you feature-detect and branch.

### File structure requirements

| Path | Purpose |
|------|---------|
| `apps/web/src/features/game/canvas/DrawingCanvas.tsx` | Client canvas UI + observer lifecycle |
| `apps/web/src/features/game/canvas/pointer-mapping.ts` | Pure coordinate helpers (+ tests import) |
| `apps/web/src/features/game/canvas/DrawingCanvas.test.tsx` | RTL + ResizeObserver mocks |
| `apps/web/src/features/game/components/GamePage.tsx` | Embed **`DrawingCanvas`** |

### Testing requirements

- Follow **`apps/web`** Vitest config + **`vitest.setup.ts`**.  
- Mock **`ResizeObserver`** in tests (no browser observers in jsdom without polyfill).  
- Prefer **deterministic floats** with **`fakeTimers`** only if timers added—otherwise avoid flakiness.

### Project Context Rules

Condensed from **`_bmad-output/project-context.md`**:

- **Stack:** Next.js ~16 App Router, React ~19, TS, Tailwind + DaisyUI — **`apps/web`**.  
- **Canvas:** Coordinate mapping must account for **CSS size + DPR** (desktop-first).  
- **Organization:** **`kebab-case`** dirs; **`PascalCase.tsx`** components; **`pnpm --filter @skribbl/web <cmd>`**.  
- **Client boundaries:** **`"use client"`** only where DOM/browser APIs required—isolate in **`DrawingCanvas`**.  
- **Don’t duplicate** wire schemas or introduce **`Socket.io`**.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3, Story 3.2]  
- [Source: `_bmad-output/planning-artifacts/epics.md` — UX-DR3, UX-DR17]  
- [Source: `_bmad-output/planning-artifacts/prd.md` — NFR-U1, NFR-P2]  
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Drawing Stage, responsive/coordinate QA notes]  
- [Source: `_bmad-output/game-architecture.md` — Directory tree, batched stroke pipeline context, Implementation Patterns]  
- [Source: `_bmad-output/project-context.md` — Engine & platform rules]  
- [Source: MDN — `HTMLCanvasElement` sizing, `devicePixelRatio`, `ResizeObserver` via Context7 `/websites/developer_mozilla_en-us`]  
- [Source: `_bmad-output/implementation-artifacts/3-1-direction-1-match-shell-canvas-column-chat-column-scaffold.md.md` — prior layout & test patterns]

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Codex epic-story-runner)

### Debug Log References

Vitest/jsdom stubs `ResizeObserver` and minimal `canvas.getContext("2d")` in **`vitest.setup.ts`** after jsdom warns about missing Canvas 2D.

### Completion Notes List

Implemented **`DrawingCanvas`** with rAF‑coalesced **`ResizeObserver`**, DPR cap at 2, **`pointerClientToCanvasCss`**, **`GamePage`** integration, RTL + mapping unit tests.

### File List

- `apps/web/src/features/game/canvas/DrawingCanvas.tsx`
- `apps/web/src/features/game/canvas/DrawingCanvas.test.tsx`
- `apps/web/src/features/game/canvas/pointer-mapping.ts`
- `apps/web/src/features/game/canvas/pointer-mapping.test.ts`
- `apps/web/src/features/game/components/GamePage.tsx`
- `apps/web/src/features/game/components/GamePage.test.tsx`
- `apps/web/vitest.setup.ts`

## Change Log

- 2026-04-30: Story implemented and marked done (DrawingCanvas surface + coordinate mapping).

## Questions / Clarifications (non-blocking)

- Exact **`aria-label`** copy may stay generic until PhaseBar/match props supply round index—use short descriptive default approved by UX.  
- Whether to **cap DPR** at 2: optional performance knob; document in component comment if implemented.
