# Story 6.4: Accessibility sweep — landmarks, keyboard loops, contrast

Status: done

<!-- gds-create-story (2026-05-04). Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As keyboard and VoiceOver users,

I want WCAG-aligned chrome interactions (with canvas drawing remaining pointer-primary as documented),

So the MVP meets the inclusivity baseline in UX-DR13 and UX-DR16.

## Acceptance Criteria

1. **Given** lobby → match flows (host **`LobbyHostPage`**, guest **`JoinRoomClient`**, marketing **`/`**, dev **`GamePage`**) **when** a user navigates with the keyboard **then** focus order reaches **primary forms**, **word choice**, **chat composer**, and **modal actions** in a **logical** sequence **without** unintended **focus traps** — **documented exception:** **Canvas 2D drawing** stays **pointer-primary** for MVP (no requirement for full keyboard painting); ensure non-drawers and read-only states are not blocked from reaching chat ([Source: `_bmad-output/planning-artifacts/epics.md` §Epic 6 Story 6.4; `_bmad-output/planning-artifacts/ux-design-specification.md` §Accessibility Strategy — Keyboard].
2. **Given** the clear-canvas confirm UI in **`DrawingToolbar`** **when** the modal is open **then** keyboard users can **complete or dismiss** it safely — **initial focus** lands in the dialog, **Tab** / **Shift+Tab** do not escape focus to the rest of the page in a confusing way, and **Escape** closes the dialog **if** that matches existing product behavior (align with UX table: destructive confirm) ([Source: `apps/web/src/features/game/toolbar/DrawingToolbar.tsx`; UX spec §Drawing tools / modals].
3. **Given** page structure **when** assistive tech lists landmarks **then** reviewers can map **site chrome** vs **match/chat** — today **`RootLayout`** already exposes one **`<main>`** wrapping all routes; **do not** introduce a **nested `<main>`**. Prefer **`role="region"`** with a clear **`aria-label`** (or **`aside`** / **`complementary`** for chat) for match sub-areas so UX-DR16 “header, main, complementary aside” intent is approximated **without** invalid nesting — e.g. **`MatchChatPanel`** may move from **`<section>`** to **`<aside aria-labelledby="match-chat-heading">`** when it acts as the chat column, and **`PhaseBar`** may be wrapped in a **labeled region** (avoid a redundant unnamed banner next to **`SiteHeader`**) ([Source: `apps/web/src/app/layout.tsx`; `MatchChatPanel.tsx`; `PhaseBar.tsx`; UX spec §Landmarks).
4. **Given** muted helper copy (**`text-base-content/70`**, **`/60`**, opacity utilities) **when** checked against backgrounds **then** **WCAG 2.2 AA–oriented** contrast issues on **body/UI text** are **treated** — fix **clear regressions** in chrome; where a fix would **break visual hierarchy**, **document** the tradeoff in **Dev Notes** (portfolio honesty) ([Source: epics §6.4; UX-DR13).
5. **Given** completion **when** validating **then** run an **automated accessibility smoke** (e.g. **Lighthouse** accessibility category on **`/`**, **`/join`**, and a **loaded host lobby** / match shell in dev, or **`npx @axe-core/cli`** on built/static HTML if you wire it) and **triage** results — **fix** straightforward issues; **list** remainder under **Dev Agent Record → Completion Notes** with severity ([Source: UX spec §Verification — axe / Lighthouse; epics §6.4 “axe/Lighthouse smoke issues triaged”]).
6. **Given** contributor workflow **when** finishing **then** **`pnpm --filter @skribbl/web typecheck`** and **`pnpm --filter @skribbl/web test`** pass; add **focused tests** where cheap (e.g. **keyboard** **`user-event`** tab order smoke for **`DrawingToolbar`** modal, or landmark **role**/`aria-*` assertions mirroring **`GamePage.test.tsx`** patterns) ([Source: `_bmad-output/project-context.md` §Testing).

## Tasks / Subtasks

- [x] **Landmarks & regions (AC: #3)** — Audit **`layout.tsx`**, **`SiteHeader`**, **`SiteFooter`**, **`LobbyHostPage`**, **`JoinRoomClient`**, **`GamePage`**, **`MatchChatPanel`**, **`PhaseBar`**. Ensure **one** document **`main`**; add **labeled regions** / **`aside`** for chat column; resolve duplicate **header** semantics (**`SiteHeader`** vs match status strip) without confusing SR users.
- [x] **Keyboard / focus — clear dialog (AC: #2, #1)** — Implement **focus management** for **`DrawingToolbar`** clear confirmation (consider **`HTMLDialogElement.showModal()`** / **`<dialog>`** for native focus behavior vs. minimal **ref** + **`focus()`** + **tabbable guard**). Verify **backdrop** button and **Cancel** / **confirm** order.
- [x] **Keyboard path — lobby → word pick → chat (AC: #1)** — Manual pass: host create flow, **`WordChoicePanel`**, **`MatchChatPanel`** composer; guest **join** flow. Fix **tab loops** (e.g. **`join`**, rosters, **Start** gating). Document **canvas pointer-only** in **Dev Notes** / code comment near **`DrawingCanvas`** if not already obvious.
- [x] **Optional skip link (AC: #3)** — UX-DR16: **“optional skip link to composer”** — if quick, add **visually hidden until focus** “Skip to chat” link **before** main content on match routes only (avoid duplicating targets); otherwise **defer** with rationale in **Completion Notes** (not a blocker if landmarks + order are solid).
- [x] **Contrast pass (AC: #4)** — Spot-check **`text-base-content/70`** on **`base-200`**, **`card`**, **`alert`**, **`footer`**; **`PhaseBar`**, **`LobbyConnectionBanner`**; fix **obvious** failures; document **known** low-contrast decorative lines.
- [x] **axe / Lighthouse triage (AC: #5)** — Run smoke; attach summary to **Completion Notes**; fix **quick wins** (labels, contrast, duplicate IDs if any).
- [x] **Tests & typecheck (AC: #6)** — Extend **`DrawingToolbar.test.tsx`** or add **`a11y`**.**`test.tsx`** for modal focus/esc; keep tests **jsdom**-friendly.

## Dev Notes

### Brownfield reality (read first)

- **Global shell:** **`RootLayout`** wraps **`SiteHeader`** + **`<main className="flex flex-1 flex-col">`** + **`SiteFooter`** ([Source: `apps/web/src/app/layout.tsx`]). All route content lives **inside** that single **`main`** — inner components must **not** add another **`<main>`**.
- **Production match UI** uses **CSS grid** in **`LobbyHostPage`** / **`JoinRoomClient`**: **`MatchDrawingColumn`** + **`MatchChatPanel`** — **not** the **`GamePage`** flex **`header`/`main`/`aside`** layout. **`GamePage`** is a **dev scaffold** that already **tests** landmarks ([Source: `apps/web/src/features/game/components/GamePage.test.tsx`]) — use it as a **reference**, but **ship** fixes in **lobby/join** paths.
- **`MatchChatPanel`** is a **`<section aria-labelledby="match-chat-heading">`** with **`h2.sr-only` “Room chat”** — good labeling; consider **`aside`** for complementary chat when beside canvas ([Source: `apps/web/src/features/match/components/MatchChatPanel.tsx`]).
- **`PhaseBar`** is a **plain `<div>`** with **`role="status"`** regions inside — no landmark; may need **`role="region"`** + **`aria-label`** (e.g. “Match status”) for discoverability ([Source: `apps/web/src/features/match/components/PhaseBar.tsx`]).
- **Clear canvas modal:** DaisyUI **`.modal`** markup with **manual state** — likely **no** built-in **focus trap**; **ATS** users may tab **behind** the overlay **unless** you fix ([Source: `DrawingToolbar.tsx`]).
- **Story 6.5** will own **expanded `data-testid`**, **`prefers-reduced-motion`** polish on celebrations — **`MatchChatPanel`** already shortens banner time when **reduced-motion**; **do not** expand **testid** scope here unless required for **your** new tests ([Source: `6-3`/`6-5` epic ordering]).

### Architecture compliance

- **Stack:** Next **App Router**, Tailwind + **DaisyUI**, React **client** components in gameplay — keep **`use client`** only where needed ([Source: `_bmad-output/game-architecture.md` §Engine; `project-context.md`]).
- **No protocol changes** — this story is **web UI / a11y** only ([Source: `project-context.md` §Shared package rules).

### Developer guardrails / file map

| Area | Primary files |
|------|----------------|
| Global chrome | `apps/web/src/app/layout.tsx`, `SiteHeader.tsx`, `SiteFooter.tsx` |
| Host flow | `apps/web/src/features/lobby/components/LobbyHostPage.tsx` |
| Guest flow | `apps/web/src/app/join/JoinRoomClient.tsx` |
| Phase / timer / scores | `apps/web/src/features/match/components/PhaseBar.tsx` |
| Chat | `apps/web/src/features/match/components/MatchChatPanel.tsx` |
| Word choice | `apps/web/src/features/match/components/WordChoicePanel.tsx` |
| Toolbar + modal | `apps/web/src/features/game/toolbar/DrawingToolbar.tsx` |
| Canvas | `apps/web/src/features/game/canvas/DrawingCanvas.tsx` |
| Dev landmark reference | `apps/web/src/features/game/components/GamePage.tsx`, `GamePage.test.tsx` |
| Global styles | `apps/web/src/app/globals.css` (only if adding **`focus-visible`** utilities — prefer DaisyUI / Tailwind defaults per UX “never `outline: none` without replacement”) |

### UX specification hooks

- **WCAG 2.2 AA** target for **UI chrome**; **canvas** drawing **not** keyboard-required ([Source: `ux-design-specification.md` §Accessibility Strategy]).
- **Landmarks:** **`header`**, **`main`**, **complementary** chat **`aside`**; **optional skip** to composer ([Source: UX spec §Layers / Global, §Responsive & Accessibility]).
- **Focus:** Visible **`:focus-visible`** rings on interactive chrome ([Source: UX spec §Component tables — Accessibility rows]).

### Previous story intelligence (6.3)

- **Footer/header** are **client** where env + WS resolution require hydration — **avoid** `fetch` to **`/healthz`** from browser without CORS ([Source: `6-3-landing-footer-portfolio-cues-healthz-pairing.md`]).
- **Structured logging** on server is **done** — **out of scope** for 6.4 unless an a11y fix touches server (unlikely).

### Git intelligence

- Recent commits: **6.3** landed global chrome + **`/healthz`** pairing; **6.2** error boundaries; **6.1** DaisyUI theme — expect **`apps/web/src/components/*`**, **`features/*`**, and **`app/*`** edits; keep changes **localized** to a11y.

### Latest technical specifics

- **React 19** **+** **Next 16.2.4**: Prefer **native **`<dialog>`** where it simplifies **focus** and **Esc** handling; verify against **`apps/web/AGENTS.md`** / local Next docs if APIs differ from older Next ([Source: `project-context.md` pins]).
- **No **Playwright** / **axe** in **repo `package.json` today — use **CLI** or **browser** Lighthouse for AC #5 unless you add a devDependency **with team approval**.

### Project Context Rules

- **pnpm** filters: **`pnpm --filter @skribbl/web`** ([Source: `project-context.md`]).
- **Imports** at top of file; **`kebab-case`** dirs; **`PascalCase`** components ([Source: `project-context.md` §Organization).
- **Context7** MCP: use for **Next.js / React** a11y patterns if you adopt **new** APIs ([Source: `project-context.md` §MCP).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- **Landmarks:** `MatchChatPanel` is now a labelled `aside` (complementary); `PhaseBar` and `MatchDrawingColumn` use `role="region"` with clear names; `WordChoicePanel` uses `aria-labelledby` on its title. Single document `main` unchanged in `layout.tsx`. `SiteHeader` remains the only `header` landmark.
- **Clear canvas:** `DrawingToolbar` uses native `<dialog>` + `showModal()`/close for focus trapping and Escape-to-dismiss (aligned with destructive confirm UX). Intent state `userRequestedClearConfirm` is combined with phase/drawer so the dialog cannot reopen incorrectly when authority changes.
- **Skip link:** `MatchSkipToChatLink` targets `#match-chat-composer` on host/guest match and match-ended shells (`LobbyHostPage`, `JoinRoomClient`); renders before `LobbyConnectionBanner` so it is first in-page focusable on match shells.
- **Keyboard order (guest):** Player roster moved above PhaseBar/match content so tab order reaches roster before the drawing column and chat (closer to host ordering).
- **Contrast:** Slightly stronger helper/footer copy (`SiteFooter`, `WordChoicePanel`, `MatchChatPanel` system lines, non-drawer hint in `MatchDrawingColumn`). **Known tradeoff:** very light borders (e.g. `border-base-300`, `border-success/30`) remain decorative; tightening would flatten hierarchy.
- **Canvas:** Documented pointer-primary MVP on `DrawingCanvas` module.
- **Lighthouse (2026-05-04):** Production build on `localhost:3010` — accessibility category **100** for `/` and `/join`. **Not run** on a live host lobby/match (needs game server + room); recommend repeating Lighthouse or axe when exercising match shell.
- **Tests:** `DrawingToolbar` dialog/escape + initial-focus tests; `match-shell-a11y.test.tsx` for regions/complementary; Vitest dialog polyfill (stacked Escape, first-focus on `showModal`). **`pnpm --filter @skribbl/web test:a11y`** runs landmark + toolbar suites.

### File List

- `apps/web/src/features/match/components/MatchChatPanel.tsx`
- `apps/web/src/features/match/components/MatchSkipToChatLink.tsx`
- `apps/web/src/features/match/components/PhaseBar.tsx`
- `apps/web/src/features/match/components/WordChoicePanel.tsx`
- `apps/web/src/features/match/components/match-shell-a11y.test.tsx`
- `apps/web/src/features/game/components/MatchDrawingColumn.tsx`
- `apps/web/src/features/game/toolbar/DrawingToolbar.tsx`
- `apps/web/src/features/game/toolbar/DrawingToolbar.test.tsx`
- `apps/web/src/features/game/canvas/DrawingCanvas.tsx`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `apps/web/src/components/SiteFooter.tsx`
- `apps/web/vitest.setup.ts`
- `apps/web/package.json` (`test:a11y`)
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/match/components/PhaseCountdownChip.tsx`
- `_bmad-output/implementation-artifacts/6-4-REVIEW.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/6-4-accessibility-sweep-landmarks-keyboard-loops-contrast.md`

## Change Log

- 2026-05-04 — Story generated (`gds-create-story`) for Epic 6 Story 6.4 (accessibility sweep).
- 2026-05-04 — Implemented landmarks, `<dialog>` clear confirm, skip link, contrast tweaks, guest roster focus order, Vitest + Lighthouse smoke notes; status → review.
- 2026-05-04 — Post-review: skip-link DOM order, dialog polyfill stack + initial focus, `test:a11y`, lint/typecheck fixes (`useHostCreateRoom` ref reset effect, `PhaseCountdownChip` timer aria, etc.); code review remediated (`6-4-REVIEW.md`); status → done.

---

### Open questions (non-blocking)

- Whether **`PhaseBar`** should be **`role="region"`** vs a **section** **`header`** inside **`main`** — choose the option that minimizes **duplicate “banner”** confusion with **`SiteHeader`** in SR rotor.
- Whether to adopt **`<dialog>`** vs **focus-trap** helper — pick the smallest dependency-free solution that passes **manual keyboard** + **axe** smoke.
