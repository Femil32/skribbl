# Story 6.5: Reduced-motion variants, testids & responsive QA

Status: done

<!-- gds-create-story (2026-05-04). Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As QA/demo owners,

I want deterministic automation hooks and motion-safe celebrations,

So CI can smoke gameplay shells (UX-DR14, UX-DR15, UX-DR17).

## Acceptance Criteria

1. **Given** match and dev shells that show celebration or urgency motion **when** the user agent reports **`prefers-reduced-motion: reduce`** **then** non-essential animations (e.g. pulsing banners, countdown pulse) are removed or replaced with static emphasis **and** remaining motion is either essential (e.g. live timer updates) or justified in dev notes ([Source: `_bmad-output/planning-artifacts/epics.md` §Epic 6 Story 6.5; `ux-design-specification.md` motion + Emotional Principles; FR cross-ref UX-DR14]).
2. **Given** **`MatchChatPanel`** correct-guess feedback **when** reduced motion is active **then** the banner does **not** apply continuous pulse animation (current pattern: Tailwind **`motion-safe:animate-pulse`** + **`motion-reduce:animate-none`**) **and** dwell/timeout behavior continues to respect shortened timing where already implemented via **`matchMedia`** ([Source: `apps/web/src/features/match/components/MatchChatPanel.tsx`; `MatchChatPanel.test.tsx`]).
3. **Given** **`PhaseCountdownChip`** in the critical tier **when** reduced motion is active **then** **`animate-pulse` is not applied** (existing JS **`matchMedia`** path) ([Source: `apps/web/src/features/match/components/PhaseCountdownChip.tsx`]).
4. **Given** E2E/smoke consumers **when** they query stable hooks **then** these **`data-testid`** values exist on the **production** match UI path (host + join guest) without colliding duplicates:
   - **Phase bar:** root container of match **`PhaseBar`** — recommend **`phase-bar`** on the outermost rendered element for every non-`null` return (including **`matchEnded`** card and active bar). Inner timer keeps **`phase-bar-timer`** ([Source: UX-DR15; `_bmad-output/planning-artifacts/ux-design-specification.md` — Test hooks; **gap:** `PhaseBar.tsx` currently has no root test id — `GamePage.tsx` dev scaffold uses **`phase-bar`** on a placeholder `<header>` only]).
   - **Canvas:** a single stable hook on the drawable surface or its immediate wrapper — e.g. **`drawing-canvas`** on **`DrawingCanvas`** root or the bordered wrapper in **`MatchDrawingColumn`** (**gap:** neither `DrawingCanvas` nor inner wrapper exposes a test id today; column only has **`match-drawing-column`**).
   - **Chat composer:** **`chat-composer-input`** on the message input (**present** on **`MatchChatPanel`**) ([Source: `apps/web/src/features/match/components/MatchChatPanel.tsx`]).
5. **Given** **`GamePage`** (`/game` dev scaffold) **when** automation runs against it **then** **`phase-bar`**, **`canvas-region`**, **`chat-region`** remain coherent **or** scaffold is explicitly aligned to the same canonical ids as production (avoid two different meanings for **`phase-bar`** — prefer real **`PhaseBar`** carrying **`phase-bar`** and scaffold importing it or mirroring ids) ([Source: `apps/web/src/features/game/components/GamePage.tsx`]).
6. **Given** responsive UX-DR17 **when** a reviewer follows the checklist **then** documented steps cover at minimum: Tailwind breakpoints **`sm` / `md` / `lg`** around the match grid (e.g. **`lg:grid-cols`**, chat column width), viewport widths to spot-check, and **canvas stroke mapping** sanity (resize while drawer — no duplicate testids required for this AC, but checklist must name the manual pass) ([Source: `_bmad-output/planning-artifacts/epics.md` UX-DR17; `project-context.md` — desktop-first, DPR-aware canvas]).
7. **Given** contributor verification **when** finishing **then** **`pnpm --filter @skribbl/web test`** passes; add/adjust Vitest coverage for **`prefers-reduced-motion`** fixtures (pattern already in **`MatchChatPanel.test.tsx`**) and any new testid assertions; run **`pnpm --filter @skribbl/web typecheck`** ([Source: `_bmad-output/project-context.md` §Testing Rules]).

## Tasks / Subtasks

- [x] **Motion audit (AC: #1–3)** — Grep **`apps/web`** for **`animate-`**, **`@keyframes`**, DaisyUI **`loading-spinner`**, and strong transitions on match/lobby surfaces; for each non-essential motion, apply **`motion-safe:` / `motion-reduce:`** variants **or** the same **`matchMedia`** approach as **`PhaseCountdownChip`** where class strings are dynamic. Explicitly classify spinners (loading): if kept, note “essential pending state” per AC #1 or offer reduced alternative (text only).
- [x] **Canonical testids — PhaseBar (AC: #4–5)** — Add **`data-testid="phase-bar"`** to **`PhaseBar`** root for all rendered branches; ensure host (**`LobbyHostPage`**) and guest (**`JoinRoomClient`**) pick it up automatically. Align **`GamePage`** placeholder header with **`PhaseBar`** or shared ids so Playwright selectors stay stable across dev and lobby wiring.
- [x] **Canonical testids — canvas (AC: #4)** — Add **`data-testid="drawing-canvas"`** (or **`canvas-region`** — pick **one** and document in Tasks) on **`DrawingCanvas`** forwarded props or **`MatchDrawingColumn`** wrapper; update any existing tests referencing only **`match-drawing-column`** if E2E should target the drawable region specifically.
- [x] **Chat composer (AC: #4)** — Confirm **`chat-composer-input`** in both host and join flows; add if join uses a divergent composer (should not — same **`MatchChatPanel`**).
- [x] **Responsive QA checklist (AC: #6)** — Add **`apps/web/docs/responsive-match-qa.md`** (short) **or** a subsection under root **`README.md`** — bullets only: breakpoints, example widths, resize order, canvas smoke, chat column scroll/focus; link from story Dev Notes.
- [x] **Tests & verification (AC: #7)** — Extend component tests for reduced-motion classes on any newly touched celebratory UI; add a minimal test that **`PhaseBar`** exposes **`phase-bar`** when rendered with match phase props; run typecheck + web test script.

## Dev Notes

### Brownfield reality (read first)

- **Partially done:** **`MatchChatPanel`** banner + tests; **`PhaseCountdownChip`** pulse gating; **`WordChoicePanel`**, **`ScoreboardSummary`**, **`DrawingToolbar`** already carry various **`data-testid`**s — this story **tightens UX-DR15’s minimum set** (phase bar + canvas + composer) and **fills gaps** on real **`PhaseBar`** / **`DrawingCanvas`**.
- **Related epic work:** Story **6.4** (landmarks, keyboard) may land in parallel; avoid conflicting **`data-testid`** or landmark refactors — coordinate if both touch the same shell files.
- **Dev scaffold:** **`GamePage`** is not the live lobby but is used for layout tests — keep ids consistent to reduce flake ([Source: `GamePage.test.tsx`]).

### Architecture compliance

- **Stack:** Next.js App Router, Tailwind + DaisyUI, Vitest in **`@skribbl/web`** ([Source: `_bmad-output/game-architecture.md` §Engine; `_bmad-output/project-context.md`]).
- **Canvas:** Coordinate mapping and DPR caps stay in **`DrawingCanvas`** — responsive QA validates **visual/UX**, not protocol ([Source: `_bmad-output/game-architecture.md` §Canvas sync]).
- **No protocol changes** — UI-only story; do **not** edit **`@skribbl/shared`** wire types for this scope.

### Developer guardrails / file map

| Concern | Location |
| -------- | --------- |
| Phase bar (production) | `apps/web/src/features/match/components/PhaseBar.tsx` |
| Match grid + wiring | `apps/web/src/features/lobby/components/LobbyHostPage.tsx`, `apps/web/src/app/join/JoinRoomClient.tsx` |
| Canvas + column | `apps/web/src/features/game/canvas/DrawingCanvas.tsx`, `apps/web/src/features/game/components/MatchDrawingColumn.tsx` |
| Chat | `apps/web/src/features/match/components/MatchChatPanel.tsx` |
| Dev shell | `apps/web/src/features/game/components/GamePage.tsx` |
| Motion / tests | `apps/web/src/features/match/components/MatchChatPanel.test.tsx`, `PhaseCountdownChip.tsx`, new/updated `PhaseBar` tests |

### UX specification hooks

- **UX-DR14:** Honor **`prefers-reduced-motion`** for celebrations ([Source: `_bmad-output/planning-artifacts/epics.md` mapping table]).
- **UX-DR15:** Stable **`data-testid`** on phase bar, canvas, composer ([Source: `ux-design-specification.md` — Test hooks]).
- **UX-DR17:** Responsive breakpoints + resize smoke ([Source: epics mapping table]).

### Previous story intelligence (6.3)

- Global **`SiteFooter`** / header are env-driven; do not break portfolio links when editing layout docs.
- Prefer **client-safe** patterns for anything reading **`window`** (matchMedia) — already established in **`PhaseCountdownChip`** and **`MatchChatPanel`**.

### Git intelligence

- Recent epic-6 commits: **6.3** landing/footer + healthz, **6.2** error boundary + WS-down UX, **6.1** DaisyUI theme — this story is **QA/determinism + motion polish**; expect concentrated edits under **`features/match`**, **`features/game`**, small doc under **`apps/web`** or **`README`**.

### Latest technical specifics

- **Tailwind v4-style variants:** Project already uses **`motion-safe:`** / **`motion-reduce:`** on the correct-guess banner ([Source: `MatchChatPanel.tsx`]) — extend consistently rather than introducing a new animation library.
- **Playwright (future):** Stable ids are for **`getByTestId`**; keep ids **kebab-case** and **lower** to match existing attributes.

### Project Context Rules

- **Monorepo:** `pnpm --filter @skribbl/web` for test/typecheck ([Source: `_bmad-output/project-context.md`]).
- **Naming:** `kebab-case` dirs, `PascalCase` components, imports at top ([Source: same]).
- **Context7:** When tuning Tailwind motion variants or Next metadata, pull current docs via Context7 MCP if behavior is ambiguous.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor)

### Debug Log References

_None._

### Completion Notes List

_Notes:_

1. Audit: match-only **`animate-*`** usages are **`MatchChatPanel`** (already motion-safe/reduced split), **`PhaseCountdownChip`** (matchMedia gated), Daisy **`loading-spinner`** on **`join/page` Suspense fallback, **`WordChoicePanel`**, **`LobbyHostPage`**. Banner + countdown meet AC **#2–3** unchanged. Spinners labelled **essential pending state** per AC **#1**; **`motion-reduce:!animate-none`** freezes decorative spinner rotation under reduced-motion (content still appears).
2. **`PhaseBar`** root exposes **`data-testid="phase-bar"`** on **match-ended** and **active** branches. **`GamePage`** mounts real **`PhaseBar`** with fixture roster/deadline so **`phase-bar`** matches production semantics; **`canvas-region`** / **`chat-region`** unchanged.
3. **`DrawingCanvas`** wrapper exposes **`drawing-canvas`**; **`DrawingCanvas.test`** asserts it; **`GamePage.test`** targets drawable region via **`drawing-canvas`**.
4. Host + guest both use **`MatchChatPanel`**; **`chat-composer-input`** already present — verified, no divergence.
5. Responsive checklist: **`apps/web/docs/responsive-match-qa.md`** (referenced here for contributors).
6. Vitest **`PhaseCountdownChip`** tests prove critical-tier pulse off under reduced-motion and on when motion allowed; global **`vitest.setup.ts`** adds **`window.matchMedia`** stub for JSdom (`PhaseBar`/`GamePage` trees).
7. **Verification:** `pnpm typecheck` (repo) and `pnpm test` (workspace) succeeded after changes.

### File List

_Below files were added or substantially modified._

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/6-5-reduced-motion-variants-testids-responsive-qa.md`
- `apps/web/docs/responsive-match-qa.md`
- `apps/web/vitest.setup.ts`
- `apps/web/src/app/join/page.tsx`
- `apps/web/src/features/game/canvas/DrawingCanvas.tsx`
- `apps/web/src/features/game/canvas/DrawingCanvas.test.tsx`
- `apps/web/src/features/game/components/GamePage.tsx`
- `apps/web/src/features/game/components/GamePage.test.tsx`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/features/match/components/PhaseBar.tsx`
- `apps/web/src/features/match/components/PhaseBar.test.tsx`
- `apps/web/src/features/match/components/PhaseCountdownChip.test.tsx`
- `apps/web/src/features/match/components/WordChoicePanel.tsx`

## Change Log

- 2026-05-04 — Story created (`gds-create-story`) for Epic 6.5: reduced-motion variants, E2E testids, responsive QA documentation.
- 2026-05-04 — Impl: phase-bar / drawing-canvas testids; GamePage aligns with **`PhaseBar`**; spinner **`motion-reduce`**; **`PhaseCountdownChip`** + **`PhaseBar`** Vitest coverage; **`matchMedia`** Vitest shim; **`apps/web/docs/responsive-match-qa.md`** UX-DR17 checklist.
- 2026-05-04 — Code review (**`06.5-REVIEW.md`**), ESLint/`react-hooks` + a11y follow-ups (**`PhaseCountdownChip`**, **`use-host-create-room`** send-chat snapshot, **`MatchChatPanel`** / **`DrawingCanvas`** lint), **`pnpm`** typecheck + web tests green; **`sprint-status`** set to done.
