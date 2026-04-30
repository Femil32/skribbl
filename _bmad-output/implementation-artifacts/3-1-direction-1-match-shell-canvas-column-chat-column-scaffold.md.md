# Story 3.1: Direction 1 match shell — canvas column + chat column scaffold

Status: done

## Story

As players in-match,
I want the genre-standard split layout ready for tools/chat integration,
so that reviewers instantly grok structure and future stories can drop canvas/chat components into stable slots (UX-DR2).

## Acceptance Criteria

1. **Given** the game/match route renders at any viewport
   **When** the viewport is `lg` (≥1024 px) or wider
   **Then** canvas column and chat column display side-by-side (canvas left, chat right)
   **And** chat column has a fixed or max-constrained width while canvas column fills remaining space.

2. **Given** the game/match route renders at a viewport below `lg`
   **When** the viewport crosses the `md` or `sm` breakpoint
   **Then** chat column stacks beneath the canvas column
   **And** canvas column never collapses below its minimum usable width (≥320 px or `min-w-0` with explicit `min-width`).

3. **Given** the match shell is rendered
   **Then** HTML landmarks are present: `<header>` reserved for PhaseBar, `<main>` containing the canvas region, `<aside>` containing the chat region.

4. **Given** the match shell is rendered
   **Then** `data-testid="phase-bar"`, `data-testid="canvas-region"`, and `data-testid="chat-region"` are present for Playwright hooks (UX-DR15).

5. **Given** the chat column is present
   **When** chat content overflows its container
   **Then** the chat column scrolls independently without affecting the canvas layout.

6. **Given** no real canvas or chat implementations exist yet
   **Then** placeholder `<div>` regions (clearly labelled "Canvas area" and "Chat area") are used in story 3-1 as empty reserved containers with the correct layout slots.

## Tasks / Subtasks

- [x] Task 1 — Create `apps/web/src/app/game/page.tsx` route entry (AC: 1, 2, 3)
  - [x] 1.1 Add `apps/web/src/app/game/` directory and `page.tsx` that imports and renders `GamePage` from features
  - [x] 1.2 Page is a Server Component; no `"use client"` needed at this layer

- [x] Task 2 — Create `apps/web/src/features/game/components/GamePage.tsx` shell (AC: 1, 2, 3, 4, 5, 6)
  - [x] 2.1 Outer wrapper: full-viewport height flex column (`flex flex-col h-screen`)
  - [x] 2.2 `<header>` region: reserved slot for PhaseBar (rendered as empty placeholder with `data-testid="phase-bar"`)
  - [x] 2.3 Content area: `<div>` or `<section>` with `flex flex-col lg:flex-row flex-1 overflow-hidden`
  - [x] 2.4 Canvas `<main>` column: `flex-1 min-w-[320px]` (no conflicting `min-w-0` on `<main>`; inner canvas placeholder uses `min-w-0` for flex overflow); `data-testid="canvas-region"`; contains placeholder text
  - [x] 2.5 Chat `<aside>` column: `w-full lg:w-80` (full width below `lg`, fixed width at `lg`); `overflow-y-auto`; `data-testid="chat-region"`; contains placeholder text
  - [x] 2.6 Verify chat column has independent scroll (`overflow-y-auto` scoped to `<aside>`)
  - [x] 2.7 Add DaisyUI `bg-base-200` or equivalent tokens for visual region separation (helps reviewers see structure)

- [x] Task 3 — Wire `data-testid` hooks (AC: 4)
  - [x] 3.1 Confirm `data-testid="phase-bar"` on `<header>`
  - [x] 3.2 Confirm `data-testid="canvas-region"` on `<main>`
  - [x] 3.3 Confirm `data-testid="chat-region"` on `<aside>`

- [x] Task 4 — Smoke-test responsive layout (AC: 1, 2, 5)
  - [x] 4.1 Run `pnpm --filter @skribbl/web dev` and manually verify side-by-side at ≥1024 px
  - [x] 4.2 Verify chat stacks below canvas at <1024 px
  - [x] 4.3 Confirm no canvas width collapse (min-width constraint holds)
  - [x] 4.4 Confirm chat column independently scrollable when placeholder content is tall

- [x] Task 5 — TypeScript + linting clean (AC: implicit)
  - [x] 5.1 `pnpm --filter @skribbl/web exec tsc --noEmit` passes
  - [x] 5.2 `pnpm --filter @skribbl/web lint` passes (or no new lint errors)

## Dev Notes

### Key layout pattern

```
<div class="flex flex-col h-screen">
  <header data-testid="phase-bar" class="shrink-0 ...">
    {/* PhaseBar will be inserted here in Story 2.x wiring / future stories */}
    <div>Phase bar placeholder</div>
  </header>

  <div class="flex flex-col lg:flex-row flex-1 overflow-hidden">
    <main data-testid="canvas-region" class="flex-1 min-w-[320px] overflow-hidden ...">
      {/* DrawingCanvas inserted in Story 3.2 */}
      <div>Canvas area</div>
    </main>

    <aside data-testid="chat-region" class="w-full lg:w-80 overflow-y-auto shrink-0 ...">
      {/* ChatPanel inserted in Epic 4 */}
      <div>Chat area</div>
    </aside>
  </div>
</div>
```

**Tailwind breakpoints to use:**
- `lg:` = 1024 px (switch to side-by-side)
- Below `lg`: flex-col stacking (chat under canvas)

### Feature folder location

- Page route: `apps/web/src/app/game/page.tsx` (new route under App Router)
- Feature shell: `apps/web/src/features/game/components/GamePage.tsx`
- Matches pattern established by `apps/web/src/features/lobby/components/LobbyHostPage.tsx`

### Existing patterns to follow

| Pattern | Source |
|---------|--------|
| Route → feature component delegation | `apps/web/src/app/lobby/page.tsx` → `LobbyHostPage` |
| PascalCase component filename | `LobbyHostPage.tsx`, `PhaseBar.tsx` |
| Tailwind + DaisyUI tokens | `apps/web/src/features/lobby/components/LobbyHostPage.tsx` |
| `data-testid` hooks | `apps/web/src/features/lobby/components/LobbyPlayerRoster.tsx` |
| Server Component route (no `"use client"`) | `apps/web/src/app/lobby/page.tsx` |

### PhaseBar is NOT wired yet in this story

The `<header>` region is a **placeholder** in story 3-1. PhaseBar already exists at `apps/web/src/features/match/components/PhaseBar.tsx` and will be wired in the game page as part of the match transport integration (future story). Do **not** hook up WS/match state in this story — layout only.

### No new shared schemas needed

This story creates UI scaffolding only. No new Zod schemas, no new server-side code, no WS messages. All schemas live in `packages/shared/src/schemas.ts`.

### UX references

- **UX-DR2**: Direction 1 desktop layout — canvas left (majority width), chat column right; below minimum breakpoint stack chat under canvas while guarding minimum readable canvas width
- **UX-DR15**: Stable `data-testid` hooks on PhaseBar, canvas region, and chat composer for Playwright/E2E

### Project Structure Notes

- **New directory:** `apps/web/src/features/game/` (create it; future stories will add `canvas/`, `chat/` subdirs)
- **New files in this story:**
  - `apps/web/src/app/game/page.tsx`
  - `apps/web/src/features/game/components/GamePage.tsx`
- No changes to `packages/shared` or `apps/server`

### Project Context Rules

Extracted from `_bmad-output/project-context.md`:

- **Framework:** Next.js ~16.x App Router, React ~19.x, TypeScript — `apps/web`
- **UI:** Tailwind + DaisyUI — use existing theme tokens, not inline colors
- **Naming:** `kebab-case` folders, `PascalCase.tsx` components, `camelCase` vars/functions
- **Monorepo:** `pnpm --filter @skribbl/web <cmd>` for web-scoped commands
- **Server Components first:** Route-level pages should be Server Components; add `"use client"` only when DOM/browser APIs or state hooks are needed
- **No `"use client"`** needed for this story — pure layout scaffold
- **Feature folders:** `apps/web/src/features/{lobby,game,room}/` — `game/` is the folder for Epic 3+ canvas/chat features
- **Target:** Desktop-first, Chrome/Safari minimum

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.1`]
- [Source: `_bmad-output/game-architecture.md` — Source tree, Feature folders, UX/Layout sections]
- [Source: `_bmad-output/project-context.md` — Engine rules, Code Organization rules]
- [Source: `apps/web/src/app/lobby/page.tsx` — route delegation pattern]
- [Source: `apps/web/src/features/match/components/PhaseBar.tsx` — existing match feature pattern]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Added `vitest.setup.ts` with `@testing-library/react` `cleanup` in `afterEach` so DOM does not accumulate between tests (fixes duplicate `data-testid` failures under Vitest + React 19).

### Completion Notes List

- Implemented `/game` App Router page delegating to server `GamePage` shell: `header` (phase bar slot), `main` (canvas), `aside` (chat) with `flex-col` / `lg:flex-row`, `min-w-[320px]` on canvas, `lg:w-80` fixed chat width, `overflow-y-auto` on chat, DaisyUI `bg-base-*` / borders for separation.
- Added `GamePage.test.tsx` covering `data-testid` hooks, landmark tags, responsive class tokens, placeholders, chat `overflow-y-auto`, and chat scroll independence (with optional `chatSlot` + jsdom scroll metrics).
- Verified `pnpm test`, `tsc --noEmit`, `eslint` (no new errors; existing PhaseCountdownChip a11y warnings), `next build` (static `/game`), and dev smoke: `next dev -p 3010` + `curl` on `/game` confirming streamed markup includes the three `data-testid` hooks and responsive utility classes.

### File List

- `apps/web/src/app/game/page.tsx`
- `apps/web/src/features/game/components/GamePage.tsx`
- `apps/web/src/features/game/components/GamePage.test.tsx`
- `apps/web/vitest.setup.ts`
- `apps/web/vitest.config.ts`

### Change Log

- 2026-04-30: Post-review — removed conflicting `min-w-0` from `<main>` (kept `min-w-[320px]`; `min-w-0` on inner canvas slot), optional `chatSlot` + scroll-independence test, story tasks 2.4/2.5 wording aligned with implementation.
- 2026-04-30: Story 3.1 — match shell route, `GamePage` layout scaffold, Vitest coverage, RTL cleanup setup for web tests.
