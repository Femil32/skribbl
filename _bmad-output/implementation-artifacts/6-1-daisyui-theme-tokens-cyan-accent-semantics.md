# Story 6.1: DaisyUI theme tokens — cyan accent & semantics

Status: done

<!-- gds-create-story (2026-05-01). Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As any visitor,

I want consistent palette/timer semantics across shells,

So polish reads intentional (UX-DR1).

## Acceptance Criteria

1. **Given** the web app’s global styles **when** DaisyUI components and match chrome (PhaseBar, countdown chip, chat shell, connection alerts, primary/secondary actions) render **then** **accent and primary emphasis** read as a **cohesive cyan family** aligned with UX Direction 5 — not a mix of unrelated default Daisy hues and one-off hex ([Source: `_bmad-output/planning-artifacts/epics.md` §Epic 6 Story 6.1; `ux-design-specification.md` §Visual Foundation / Direction 5]).
2. **Given** Tailwind v4 + DaisyUI **5.0.50** **when** contributors inspect theme source **then** **semantic roles** are explicit: at minimum **primary**, **accent** (and **info** where used), **success / warning / error**, **base-\*** surfaces, and **timer-healthy / timer-urgent / timer-critical** map to documented tokens — no mystery magic numbers scattered in JSX for chrome ([Source: `apps/web/package.json` versions; `apps/web/src/app/globals.css`]).
3. **Given** countdown/timer UI **when** urgency tiers apply **then** **timer-\*** colors remain **perceptually distinct** and **hue-harmonized** with the cyan accent system (healthy → cyan-range, urgent → amber-range, critical → red-range), including dark-mode contrast adjustments if you consolidate `:root` / `prefers-color-scheme` with Daisy themes ([Source: Story 2.4 implementation in `globals.css`, `timer-display.ts`, `PhaseCountdownChip.tsx`]).
4. **Given** a pass over **shell / chrome** TSX **when** auditing for hard-coded colors **then** **no stray hex/rgb** remains on **critical surfaces** (layout chrome, phase/timer/copy, chat list frame, alerts, buttons/links that should use theme). **Explicit non-goal:** **drawing brush swatches** in `DrawingToolbar.tsx` and canvas stroke color literals may stay hex for fidelity unless you optionally add a separate “canvas palette token” doc in the same file comment — do not block the story on recoloring the raster brush palette ([Source: `grep` audit pattern; `DrawingToolbar.tsx`, `DrawingCanvas.tsx`]).
5. **Given** the repo **when** a new developer opens styling guidance **then** a **short contributor-facing map** exists (top of `globals.css` or a tight subsection in `apps/web/AGENTS.md` — pick **one** location to avoid duplication) listing **token name → role** (what to use for `btn-primary`, alerts, timer text, base panels) and pointing at DaisyUI’s `@plugin "daisyui/theme"` block as the source of truth.

## Tasks / Subtasks

- [x] **DaisyUI custom theme (AC: #1, #2, #5)** — In `apps/web/src/app/globals.css`, after `@plugin "daisyui";`, add **`@plugin "daisyui/theme"`** with a named theme (e.g. `skribbl`) and **`default: true`** (and **`prefersdark`** / paired light-dark themes **if** you replace the hand-rolled `@media (prefers-color-scheme: dark)` `:root` overrides). Set **`--color-primary`**, **`--color-primary-content`**, **`--color-accent`**, **`--color-accent-content`**, and tune **`--color-base-*`**, **`--color-neutral-*`**, **`info/success/warning/error`** so the **portfolio-forward cyan** reads consistently. Follow DaisyUI **v5.0.50** CSS-first theme shape ([Source: Context7 `/saadeghi/daisyui/v5_0_50` — `@plugin "daisyui/theme"` examples]).
- [x] **Consolidate global background/text (AC: #1–#3)** — Today `:root` uses `--background` / `--foreground` hex and `body` sets `font-family` / raw background. Prefer **`body` classes** (`min-h-full flex flex-col bg-base-100 text-base-content`) or equivalent so **Daisy base tokens** drive shell background; keep **Geist** font variables from `layout.tsx`. Remove or **bridge** redundant `--background`/`--foreground` **only if** nothing in the tree still references them (grep **`--background`**, **`--foreground`**, **`color-background`**, **`color-foreground`**).
- [x] **Timer token harmony (AC: #3)** — In `@theme inline`, adjust **`--color-timer-*` oklch** stops so hues/chroma align with the new primary accent story; keep **`tierToTimerTokenClass`** mapping to **`text-timer-*`** intact unless you rename tokens (if renamed, update `timer-display.ts` + any tests).
- [x] **Chrome audit + fixes (AC: #4)** — Grep `apps/web/src/features` and `apps/web/src/app` for `#`, `rgb(`, `hsl(` in TSX/CSS modules; fix **shell** offenders. **Known benign:** `#` in `MatchHintFeed` for `#1` hint label is **not** a color — skip. **Brush palette:** leave as-is per AC#4 unless trivial.
- [x] **Primary CTAs (AC: #1)** — Spot-check high-visibility actions (lobby **Start**, join **Enter**, word choice, chat send if using custom classes) use **`btn-primary`** / **`btn`** variants or **`text-primary`** where UX implies emphasis — adjust only where current classes fight the new theme.
- [x] **Verification (AC: #2–#5)** — `pnpm --filter @skribbl/web typecheck` and `pnpm --filter @skribbl/web lint`; run **`pnpm --filter @skribbl/web test`** if any unit tests touch class names or theme assumptions. Light **manual** pass: lobby + match route — PhaseBar, countdown chip tiers, `alert` banners (connection), chat panel frame.

## Dev Notes

### Brownfield reality (read first)

- **Tailwind 4** uses **`@import "tailwindcss"`** + **`@plugin "daisyui"`** — no classic `tailwind.config.js` in this package ([Source: `apps/web/postcss.config.mjs`, `globals.css`]).
- **Timer semantics** already use **`@theme inline`** custom properties **`--color-timer-*`** and utilities **`text-timer-healthy`** etc. ([Source: `globals.css`, `timer-display.ts`]). Story **6.1** is about **unifying** these with Daisy semantic colors and **cyan** accent — not rewriting timer math.
- **No `data-theme` on `<html>` today** — adding a Daisy theme may require **`data-theme="skribbl"`** on `<html>` **if** you use multi-theme registration; otherwise a single **`default: true`** custom theme may be enough ([Source: `layout.tsx`]).
- **Epic 6 siblings:** **6.2** owns error boundaries / WS-down copy; **6.4–6.5** own a11y sweeps and `data-testid` — **do not** expand this story into those scopes.

### Architecture compliance

- **Client stack:** Next.js **16.2.4**, React **19.2.5**, Tailwind **4.x**, DaisyUI **^5.0.50** ([Source: `_bmad-output/project-context.md`, `apps/web/package.json`]).
- **UX contract:** Tokens-first chrome, cyan accent system, semantic success/warning/error — **no ad-hoc hex on phase/connection/timer surfaces** where avoidable ([Source: `ux-design-specification.md` — Visual Foundation, Component Strategy, UX-DR1 mapping in epics table workflow]).

### Developer guardrails / file map

| Concern | Location |
| -------- | -------- |
| Global theme + Tailwind theme extension | `apps/web/src/app/globals.css` |
| Root layout (optional `data-theme`, body classes) | `apps/web/src/app/layout.tsx` |
| Timer urgency → class | `apps/web/src/features/match/lib/timer-display.ts` |
| Countdown chip | `apps/web/src/features/match/components/PhaseCountdownChip.tsx` |
| Phase chrome | `apps/web/src/features/match/components/PhaseBar.tsx` |
| Connection alerts | `apps/web/src/features/lobby/components/LobbyConnectionBanner.tsx` |
| Contributor note (if not only comments in globals) | `apps/web/AGENTS.md` |

### Epic 6 cross-story context

- **6.2–6.5** follow for failure UX, landing/footer, **WCAG** passes, reduced-motion — **6.1** delivers the **visual token foundation** they inherit.

### Previous epic intelligence (Epic 5 closure)

- **5.3** established **DaisyUI `alert` variants** and **non-color-only** presence cues — when retuning **semantic colors**, regression-test **`alert-info` / `alert-warning` / `alert-error` / `alert-success`** readability in both light and dark **if** both modes remain supported ([Source: `5-3-presence-decay-ui-muted-roster-rows.md`]).

### Latest technical specifics (DaisyUI 5 + Tailwind 4)

- Define colors inside **`@plugin "daisyui/theme" { ... }`** using **`--color-*`** variables (oklch recommended in docs); set **`default: true`** for the primary shipped theme. Optional second **`@plugin "daisyui/theme"`** block for dark if you use **`themes: light --default, dark --prefersdark`** on the daisyui plugin ([Source: Context7 query on `/saadeghi/daisyui/v5_0_50`]).
- **Adding arbitrary Tailwind colors** still uses **`@theme`**; **per-theme overrides** belong in the **`daisyui/theme`** block when values must differ by **`data-theme`**.

### Git intelligence

- Recent work emphasized **roster/hydration/wire models** (`caaec56`, `b9881da`) — this story is **web-only styling**; avoid touching **`@skribbl/shared`** or **`apps/server`** unless a grep proves a false-positive import of CSS vars (unlikely).

### Project Context Rules

- **UI:** Tailwind + **DaisyUI**, align with UX spec ([Source: `_bmad-output/project-context.md`]).
- **Monorepo:** use **`pnpm --filter @skribbl/web ...`** for web verification ([Source: `_bmad-output/project-context.md`]).
- **Do not** introduce parallel design systems or non-Daisy primitives for shell chrome without epic scope change.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Implemented DaisyUI **`themes: light --default, dark --prefersdark`** with two **`@plugin "daisyui/theme"`** blocks (`light` / `dark`) using oklch cyan-forward **primary**, **accent**, **base-***, and semantic **info/success/warning/error** stops; contributor token map lives in the block comment at the top of `globals.css` (AC #2, #5).
- Removed legacy **`--background` / `--foreground`** and hand-rolled `:root` hex; **body** shell uses **`bg-base-100 text-base-content font-sans`** from `layout.tsx`; **Geist** still via CSS variables + `body { font-family: … }` fallback in `globals.css`.
- **Timer** utilities: retuned **`--color-timer-*`** in **`@theme inline`** with **`@media (prefers-color-scheme: dark)`** nested `@theme inline` for darker-mode contrast; **`tierToTimerTokenClass`** unchanged; added unit coverage for token class mapping.
- Grep audit: only remaining `#` in TSX are **brush defaults / palette** (explicit non-goal) and **MatchHintFeed** `#1` label; no shell hex fixes required beyond globals.
- **CTAs:** lobby **Start** disabled state and avatar preset toggles use **`btn-outline btn-primary`** for cyan-outline consistency; join flow avatar toggles aligned.
- **`pnpm --filter @skribbl/web test`** and **`typecheck`** pass; **`next build`** succeeds. **`eslint`** still reports an existing **`react-hooks/immutability`** error in `use-host-create-room.ts` (unchanged by this story) plus prior warnings in other files — resolve separately if the project requires clean lint.

### File List

- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `apps/web/src/features/match/lib/timer-display.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-01 — Story 6.1: DaisyUI light/dark theme tokens (cyan primary/accent), timer harmony, shell token map in `globals.css`, layout base utilities, CTA outline alignment, timer-display tests.
