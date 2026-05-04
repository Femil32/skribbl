# Story 6.3: Landing/footer portfolio cues & /healthz pairing

Status: done

<!-- gds-create-story (2026-05-04). Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a reviewer,

I want repo/source pointers plus observable server readiness,

So demos feel production-grade (architecture `/healthz`, portfolio narrative).

## Acceptance Criteria

1. **Given** the public marketing shell (home route and global chrome) **when** a reviewer scans the page **then** they can reach **at least one** authoritative **source/repo** destination via a clear footer (and optional compact header affordance) — use **real URLs** at deploy time via **`NEXT_PUBLIC_*`** env vars (documented in **`apps/web/.env.example`**) so production builds are not hard-coded to fake links ([Source: `_bmad-output/planning-artifacts/epics.md` §Epic 6 Story 6.3; `ux-design-specification.md` — Global chrome / repo link].
2. **Given** optional demo/showcase URLs **when** configured **then** footer (or adjacent “portfolio” strip) surfaces them distinctly from gameplay actions (**Create room** / **Join**) — if env vars are unset, omit those rows cleanly (no broken `href="#"`) ([Source: epics §6.3 narrative]).
3. **Given** the game WebSocket base is known (**`NEXT_PUBLIC_WS_URL`** or dev fallback from **`resolveGameWebSocketUrl`**) **when** the footer renders **then** reviewers see a plain **`<a>`** (“Probe **`/healthz`**”, “Game server probe”, or similar) pointing at **`http(s)://<host>:<port>/healthz`** derived from the **ws/wss** URL — **navigation link only** (do not **`fetch`** cross-origin from the browser unless you also add server **CORS** for GET, which is out of scope) ([Source: `apps/web/src/lib/game-ws-url.ts`; `project-context.md` §Platform — `/healthz`]).
4. **Given** a running **`@skribbl/server`** **when** **`GET /healthz`** is handled **then** the response remains **200** **`application/json`** with a small stable body (existing **`{ ok: true }`** is fine) **and** the handler emits a **structured **`pino`** log line** on each probe (e.g. **`log.debug({ probe: true, path: '/healthz' }, 'healthz')`**) so operators can enable visibility via **`LOG_LEVEL`** without breaking prod noise defaults — align with examples in **`_bmad-output/game-architecture.md` §Logging** ([Source: `apps/server/src/create-game-server.ts`]).
5. **Given** contributor verification **when** finishing **then** **`pnpm --filter @skribbl/web typecheck`** and **`pnpm --filter @skribbl/server typecheck`** pass; add or extend **tests** where cheap — e.g. pure helper tests for **WS → HTTP health URL** in **`@skribbl/web`**, and/or a minimal **`@skribbl/server`** test that issues an HTTP **GET** against the game server and asserts **200** + JSON body (follow patterns in existing server tests) ([Source: `project-context.md` §Testing Rules]).

## Tasks / Subtasks

- [x] **Env + docs (AC: #1–2)** — Add **`NEXT_PUBLIC_REPO_URL`** (required for the repo link to render; optional behavior: hide repo link row if unset) and optional **`NEXT_PUBLIC_DEMO_URL`** / **`NEXT_PUBLIC_DOCS_URL`** only if you want multiple destinations; document in **`apps/web/.env.example`** and a one-line note in root **`README.md`** under dev/split hosting.
- [x] **WS → healthz URL helper (AC: #3)** — Add a small pure function (e.g. **`gameWsUrlToHttpHealthzUrl(wsUrl: string): string`**) in **`apps/web/src/lib/`** next to **`game-ws-url.ts`** (or colocated file) mapping **`ws:`→`http:`**, **`wss:`→`https:`**, preserving **host and port**; **`GET /healthz`** lives on the HTTP listener root, so **WS URL path segments are ignored** (see tests); **unit-test** edge cases (`ws://localhost:3001`, trailing slash, basic `wss://` host).
- [x] **Portfolio chrome (AC: #1–3)** — Implement **`SiteFooter`** (and optional **`SiteHeader`** mini bar) using **DaisyUI** + tokens from Story **6.1** — **`footer`**, **`link`**, **`text-base-content/70`** for secondary line; include **Skribbl** home **`Link`** to **`/`**, external repo link with **`rel="noopener noreferrer"`** **`target="_blank"`**, and healthz **`<a>`** using resolved WS URL on the **client** (footer likely **`use client`** or pass resolved URL from a tiny client wrapper — avoid hydration mismatch: either read **`NEXT_PUBLIC_WS_URL`** in a client component only, or pass **`undefined`** on server and fill on mount).
- [x] **Layout wiring (AC: #1–3)** — Mount footer in **`apps/web/src/app/layout.tsx`** with **`mt-auto`** so **`body` `flex flex-col min-h-full`** pushes it to the bottom; keep landing **`page.tsx`** content readable (hero card + actions) — adjust vertical spacing if footer crowds small viewports.
- [x] **Landing copy polish (AC: #1)** — Light pass on **`app/page.tsx`** hero text so it reads **portfolio-forward** (still honest about MVP scope) without duplicating long manifesto copy — one short secondary line is enough.
- [x] **Server healthz logging (AC: #4)** — Update **`createGameServer`** HTTP handler: reuse existing **`log`** (`pino`); add structured debug (or trace) line on **`/healthz`**; confirm **`LOG_LEVEL`** semantics in server **`README`** or root README if non-obvious.
- [x] **Tests & verification (AC: #5)** — Run **`pnpm --filter @skribbl/web test`** / server tests as applicable; manual: start server, open footer healthz link, **`curl -s`** healthz and watch logs with **`LOG_LEVEL=debug`**.

## Dev Notes

### Brownfield reality (read first)

- **`GET /healthz`** already returns **200** **`{ ok: true }`** in **`create-game-server.ts`** — this story **extends** it with **structured logging** and **pairs** it with **visible web chrome** ([Source: `apps/server/src/create-game-server.ts`]).
- **Home** is **`apps/web/src/app/page.tsx`** with **`ComponentWsPingDemo`** — keep demo ping behavior unchanged; portfolio strip is separate.
- **No `SiteFooter` today** — **`layout.tsx`** only sets fonts + **`body`** shell.
- **Epic 6 boundaries:** **6.4–6.5** own WCAG sweep, **`data-testid`**, reduced-motion — do **not** block this story on full axe parity; still use semantic **`footer`**, headings hierarchy, and focus-visible-friendly links ([Source: `6-2-react-error-boundary-ws-down-ux.md`] sibling note).

### Architecture compliance

- **Two-process deploy:** reviewers mentally map **Next** ↔ **game server**; footer healthz link reinforces **`NEXT_PUBLIC_WS_URL`** pairing ([Source: `_bmad-output/game-architecture.md` §Deploy / Debug tools]).
- **Observability:** **`/healthz`** + **structured logs** (**`pino`**) ([Source: `_bmad-output/game-architecture.md` §Debug tools, §Logging`).
- **UI stack:** Next **App Router**, Tailwind + **DaisyUI** ([Source: `_bmad-output/project-context.md`]).

### Developer guardrails / file map

| Concern | Location |
| -------- | --------- |
| Home / landing | `apps/web/src/app/page.tsx` |
| Global chrome | `apps/web/src/app/layout.tsx` |
| WS URL resolution | `apps/web/src/lib/game-ws-url.ts` |
| New: healthz URL helper + tests | `apps/web/src/lib/*` |
| Game server HTTP + WS | `apps/server/src/create-game-server.ts` |
| Env templates | `apps/web/.env.example`, root `README.md` |

### UX specification hooks

- **Global chrome:** Logo/home **or** repo link in header/footer ([Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Layers / Global]).
- **Portfolio positioning:** Restrained marketing-adjacent copy; shell uses same theme tokens as game chrome ([Source: same — Direction 5 cyan accent]).

### Previous story intelligence (6.2)

- **Error boundaries** and **`LobbyConnectionBanner`** are done — do not re-scope WS failure UX here.
- **`RouteErrorFallback`**, **`client-debug`** gates — footer should not add noisy **`console.*`** in prod ([Source: `6-2` file list]).
- **Theme semantics (6.1):** reuse **`btn` / `link` / `text-base-content`** patterns established for alerts and primary actions.

### Git intelligence

- Recent work: **6.2** error boundaries, **6.1** DaisyUI theme, **5.3** presence — this story is **marketing shell + observability polish**; expect edits mainly under **`apps/web/src/app`** and **`apps/web/src/components`**, small **`apps/server`** touch.

### Latest technical specifics

- **`pino`:** Structured logging objects as first argument, string message second — consistent with **`log.error({ err }, 'handler error')`** in **`create-game-server.ts`** ([Source: `apps/server/src/create-game-server.ts`]).
- **Next.js 16:** **`Link`** for internal routes; ordinary **`<a>`** for external and cross-origin probe URLs ([Source: `_bmad-output/project-context.md` — Next pins]).

### Project Context Rules

- **Monorepo:** verify with **`pnpm --filter @skribbl/web`** / **`@skribbl/server`** ([Source: `_bmad-output/project-context.md`]).
- **Do not** add DB/Auth for MVP links — static/env-driven only.
- **Imports** at top of file; **`kebab-case`** dirs, **`PascalCase`** components ([Source: `_bmad-output/project-context.md`] §Organization).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Server healthz test: set `WORDS_PATH` to monorepo `data/words.json` so `createGameServer` loads the word bank under Vitest cwd.

### Completion Notes List

- Added `gameWsUrlToHttpHealthzUrl` + Vitest coverage; `SiteHeader` / `SiteFooter` (DaisyUI, env-driven repo/demo/docs, client-resolved healthz `<a>` after rAF to satisfy lint + avoid sync setState in effect).
- Extended `GET /healthz` with `log.debug({ probe: true, path: '/healthz' }, 'healthz')`; documented `LOG_LEVEL=debug` in root README.
- Wired global chrome in `layout.tsx` (`main` flex-1 + footer `mt-auto`); tightened home hero copy.
- Integration test: HTTP GET `/healthz` → 200 JSON on ephemeral port.

### File List

- apps/web/src/lib/game-ws-url-to-healthz.ts
- apps/web/src/lib/game-ws-url-to-healthz.test.ts
- apps/web/src/components/SiteFooter.tsx
- apps/web/src/components/SiteHeader.tsx
- apps/web/src/app/layout.tsx
- apps/web/src/app/page.tsx
- apps/web/.env.example
- apps/server/src/create-game-server.ts
- apps/server/src/create-game-server.healthz.test.ts
- README.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-05-04 — Story drafted (`gds-create-story`): landing/footer portfolio cues + `/healthz` logging/pairing for Epic 6.
- 2026-05-04 — Implemented: portfolio chrome, WS→healthz helper + tests, `/healthz` pino debug probe, README/env docs, server healthz HTTP test.
- 2026-05-04 — Code review (`06.3-REVIEW.md`) + remediation: restore `WORDS_PATH` in server test, footer try/catch + reserved probe row, README/story task wording, invalid-WS URL unit test.

---

### Open questions (non-blocking)

- Exact production **repository** URL — supply via **`NEXT_PUBLIC_REPO_URL`** at deploy time if the monorepo has no **`repository`** field in **`package.json`** yet.
- If product wants a **live “status: OK”** badge without opening a new tab, that implies **`fetch`** + **CORS** on **`GET /healthz`** or a **Next.js route handler** proxy — explicitly **deferred** unless PM expands scope.
