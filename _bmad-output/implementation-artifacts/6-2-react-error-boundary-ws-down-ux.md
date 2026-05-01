# Story 6.2: React error boundary & WS-down UX

Status: done

<!-- gds-create-story (2026-05-01). Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As any visitor hitting failures,

I want calm messaging instead of blank screens,

So failures feel controlled (Additional reqs error UX, NFR-O1).

## Acceptance Criteria

1. **Given** an uncaught render/hydration error in a **`use client`** subtree under the App Router **when** Next.js activates the segment error boundary **then** the user sees a **full fallback shell** (not an empty canvas/route) with **Calm, neutral copy**, **icon + text**, and **primary recovery actions** (**Try again** wired to **`unstable_retry`** where applicable; **Reload page** via full navigation reload when retry alone is insufficient) — **no stack traces, no raw `Error.message`, no digest IDs** in production-facing UI ([Source: `_bmad-output/planning-artifacts/epics.md` §Epic 6 Story 6.2; `_bmad-output/planning-artifacts/ux-design-specification.md` — Errors / Confidence / UX-DR themes; `_bmad-output/game-architecture.md` §Error handling client UI]).
2. **Given** **`NEXT_PUBLIC_WS_URL`** missing in production **or** the browser blocks WebSockets **when** lobby/join hooks resolve transport **`blocked`** **then** **`LobbyConnectionBanner`** still communicates **`blocked`** with **`role="alert"`** and offers at least one **obvious recovery affordance** (e.g. **Reload page**) — today **`showRetry` is false** for **`blocked`**; closing that gap is in scope so “reload/retry paths remain obvious” ([Source: `apps/web/src/features/lobby/lib/lobby-transport.ts`; `LobbyConnectionBanner.tsx`]).
3. **Given** simulated transport failures (**offline** in DevTools, game server stopped, invalid WS URL) **when** Host **and** Guest flows run **then** states progress through **`connecting` → `fatal` / `disconnected` / `reconnecting` / `live`** without silent hangs; **`fatal`** paths expose **`LobbyConnectionBanner`** retry consistent with **`LobbyHostPage`** / **`JoinRoomClient`** — regression-check **`onRetry`** wiring for **`fatal`** + **`disconnected`** ([Source: `use-host-create-room.ts`, `use-guest-join-room.ts`, `LobbyHostPage.tsx`, `JoinRoomClient.tsx`]).
4. **Given** sanitized protocol/server failures **when** hooks set **`transportErrorMessage`** **then** strings remain **human-readable**, never **`JSON.stringify`** dumps or uncaught exception text — grep hook **`fail(...)`** call sites and **`error`** event handlers for accidental leakage ([Source: `_bmad-output/project-context.md` — structured errors on wire; banner contract in `lobby-transport.ts`]).
5. **Given** contributor verification **when** finishing **then** **`pnpm --filter @skribbl/web typecheck`** passes **and** affected tests (**`pnpm --filter @skribbl/web test`**) updated or added for **pure helpers / banner model** changes; optional lightweight RTL smoke only if you introduce a thin presentational **`ErrorFallback`** component ([Source: `_bmad-output/project-context.md` §Testing Rules]).

## Tasks / Subtasks

- [x] **App Router error UI (AC: #1)** — Add **`apps/web/src/app/error.tsx`** as a **`use client`** default export following Next.js **16.2.x** `error.tsx` convention (`error`, **`unstable_retry`**) ([Source: Context7 `/vercel/next.js/v16.2.2` — error handling / `error.js`]). Style with **DaisyUI** (`alert`, `card`, **`btn-primary`**) aligned with Story **6.1** tokens. Copy suggestion: title **Something went wrong**, body **You can try again or reload the page — your progress may resume if the connection is still alive.** Implement **`Try again`** → `unstable_retry()` and **`Reload page`** → `window.location.reload()` (guard `typeof window`).
- [x] **Isolate gameplay shell (AC: #1, architecture)** — Add **`apps/web/src/app/game/error.tsx`** (and **`lobby/error.tsx`** / **`join/error.tsx`** only if justified) so match-route crashes **don’t blank unrelated segments** — reuse one exported **`RouteErrorFallback`** component to avoid duplication ([Source: `_bmad-output/game-architecture.md` — error boundary around game shell]). Prefer **`apps/web/src/components/`** or **`features/*/components/`** for the shared fallback; keep imports at top of file per repo ESLint rules.
- [x] **Optional tighter subtree boundary (AC: #1)** — If file-level `error.tsx` is too coarse for a specific **`MatchShell`** wrapper, evaluate **`unstable_catchError`** from **`next/error`** around the realtime shell only — **still must not** leak raw `error.message` to users ([Source: Context7 `/vercel/next.js/v16.2.2` — `unstable_catchError`]).
- [x] **Blocked transport recovery (AC: #2)** — Extend **`lobbyConnectionBannerModel`** / **`LobbyConnectionBanner`** props so **`blocked`** can show **`Reload page`** (`btn-outline` secondary). Alternatively keep model pure and pass **`onReload`** from pages — choose one pattern and document in Dev Notes.
- [x] **WS-down QA matrix + grep audit (AC: #3, #4)** — Manual pass: Host create flow + Guest join with server **down**, tab **offline**, **`NEXT_PUBLIC_WS_URL`** unset in **`NODE_ENV=production`** build preview — confirm banners + retry behavior. Audit **`fail(`** / **`setTransportErrorMessage`** / server **`error`** parsing paths for unsafe interpolation.
- [x] **Logging hygiene (AC: #1)** — **`console.error(error)`** only behind **`NODE_ENV === 'development'`** **or** existing **`?debug=1` / localStorage** gates per project-context — avoid noisy prod consoles ([Source: `_bmad-output/project-context.md` §Logging / Debug]).

## Dev Notes

### Brownfield reality (read first)

- **No `error.tsx` today** — Next defaults surface developer-centric failures; this story introduces production-grade UX ([Source: glob `apps/web/src/app`]).
- **Realtime UX already centralized** — **`LobbyConnectionBanner`** + **`lobbyConnectionBannerModel`** own WS lifecycle copy; extend rather than fork ([Source: `lobby-transport.ts`]).
- **`missingGameWebSocketUrlUserMessage()`** intentionally mentions **`NEXT_PUBLIC_WS_URL`** for deployers — acceptable for **`blocked`**; **do not** copy that tone into generic React crash UI ([Source: `apps/web/src/lib/game-ws-url.ts`]).
- **Epic 6 siblings:** **6.3** owns **`/healthz`** + footer cues; **6.4–6.5** own **WCAG sweep**, **`data-testid`**, reduced-motion — stay inside **boundaries + WS/trust UX** here.

### Architecture compliance

- **Client UI guardrail:** React **error boundary** around game shell + user-facing copy for **WS blocked / server down** ([Source: `_bmad-output/game-architecture.md` §Error handling]).
- **Stack:** Next **~16**, React **~19**, DaisyUI — match **`project-context`** pins ([Source: `_bmad-output/project-context.md`]).
- **Security/privacy:** Never expose stack traces or internal exception strings to players ([Source: UX spec — Errors measured calm]).

### Developer guardrails / file map

| Concern | Location |
| -------- | --------- |
| Root segment error boundary | `apps/web/src/app/error.tsx` |
| Game segment boundary | `apps/web/src/app/game/error.tsx` |
| WS banner copy / phases | `apps/web/src/features/lobby/lib/lobby-transport.ts` |
| Banner UI | `apps/web/src/features/lobby/components/LobbyConnectionBanner.tsx` |
| Host transport | `apps/web/src/features/lobby/hooks/use-host-create-room.ts` |
| Guest transport | `apps/web/src/features/lobby/hooks/use-guest-join-room.ts` |
| WS URL resolution | `apps/web/src/lib/game-ws-url.ts` |

### UX specification hooks

- **Resilience without panic**, **confidence** states for WS blocked vs server down vs reconnecting ([Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Principles, Journey: Disconnect & reconnect, Component ¶ Feedback table]).
- Pair **color + icon + label** for critical alerts (**UX-DR** alignment).

### Previous story intelligence (6.1)

- Theme tokens + **`alert-*`** semantics finalized — reuse **`alert-error` / `alert-warning` / `alert-info`** for error boundaries consistent with banners ([Source: `6-1-daisyui-theme-tokens-cyan-accent-semantics.md`]).
- **`pnpm --filter @skribbl/web lint`** may still surface **pre-existing** issues — fix only what this story touches; note residue in Dev Agent Record ([Source: 6.1 completion notes]).

### Latest technical specifics (Next.js 16.2)

- **`error.tsx`** must be a **Client Component**; receives **`error`** + **`unstable_retry`** ([Source: Context7 `/vercel/next.js/v16.2.2` — error handling docs]).
- **`unstable_catchError`** available for reusable wrappers — prefer stable **`error.tsx`** files unless subtree isolation requires API boundary ([Source: Context7 `/vercel/next.js/v16.2.2` — `catchError.mdx`]).
- **Do not** ship examples that **`return <p>{error.message}</p>`** verbatim — sanitize for gamers ([Source: UX spec]; contrasts raw Next docs examples).

### Git intelligence

- Recent commits emphasize **hydration**, **presence**, **snapshot replay**, **guess UX** — this story is **web UX resilience**; avoid **`@skribbl/shared`** / **`apps/server`** unless audit proves necessity (`e5d37a2`, `caaec56`, `b9881da`).

### Project Context Rules

- **Monorepo verification:** `pnpm --filter @skribbl/web …` ([Source: `_bmad-output/project-context.md`]).
- **UI:** Tailwind + DaisyUI; desktop-first realtime MVP ([Source: `_bmad-output/project-context.md`]).
- **Two-process deploy:** WS URL via **`NEXT_PUBLIC_WS_URL`** when split ([Source: `_bmad-output/project-context.md`]).
- Client logging gated — no unconditional **`console.error`** in prod bundles ([Source: `_bmad-output/project-context.md`]).

## Dev Agent Record

### Agent Model Used

Cursor Composer (implementation agent)

### Debug Log References

### Completion Notes List

- Implemented **`RouteErrorFallback`** (`apps/web/src/components/RouteErrorFallback.tsx`) and wired **`apps/web/src/app/error.tsx`** + **`apps/web/src/app/game/error.tsx`** as client segment boundaries: calm copy only (no stack traces, raw messages, or digest in UI); **Try again** → **`unstable_retry()`**, **Reload page** → **`reloadPage`** default **`window.location.reload()`** (guarded). **`console.error(error)`** via **`shouldLogRouteErrors()`** (`client-debug.ts`: dev, **`?debug=1`**, **`localStorage.skribbl_debug`**).
- **`lobbyConnectionBannerModel`** now sets **`showReload: true`** for **`blocked`**; **`LobbyConnectionBanner`** accepts **`onReload`** / **`reloadLabel`** (outline button). **`LobbyHostPage`** and **`JoinRoomClient`** pass **`reloadFullPage`** when transport is **`blocked`**. **`fatal`** / **`disconnected`** retry wiring unchanged (**`onRetry`**).
- **`unstable_catchError`**: evaluated and **not adopted** — **`game/error.tsx`** segment boundary is sufficient to isolate **`/game`** without extra API surface.
- **Grep audit (AC #4):** lobby **`fail(...)`** paths use fixed strings or **`messageForProtocolErrorCode`**; no **`JSON.stringify`** of errors into **`transportErrorMessage`**.
- **Tests added/updated:** **`lobby-transport.test.ts`**, **`RouteErrorFallback.test.tsx`**, extended **`LobbyConnectionBanner.test.tsx`**. **`pnpm --filter @skribbl/web typecheck`** and **`pnpm --filter @skribbl/web test`** pass.
- **Contributor manual QA:** verify host/guest with server stopped (**fatal** + retry), DevTools offline (**disconnected** + retry), and production-style build without **`NEXT_PUBLIC_WS_URL`** (**blocked** + reload).

### File List

- `apps/web/src/app/error.tsx`
- `apps/web/src/app/game/error.tsx`
- `apps/web/src/lib/client-debug.ts`
- `apps/web/src/lib/client-debug.test.ts`
- `apps/web/src/components/RouteErrorFallback.tsx`
- `apps/web/src/components/RouteErrorFallback.test.tsx`
- `apps/web/src/features/lobby/lib/lobby-transport.ts`
- `apps/web/src/features/lobby/lib/lobby-transport.test.ts`
- `apps/web/src/features/lobby/components/LobbyConnectionBanner.tsx`
- `apps/web/src/features/lobby/components/LobbyConnectionBanner.test.tsx`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/6-2-react-error-boundary-ws-down-ux.md`

## Change Log

- 2026-05-01 — Story drafted (`gds-create-story`): error boundaries + WS-down/blocked recovery UX alignment.
- 2026-05-01 — Implemented segment **`error.tsx`**, shared **`RouteErrorFallback`**, **`blocked`** reload affordance on **`LobbyConnectionBanner`**, tests; status → **review**.
- 2026-05-01 — Code review follow-up: **`client-debug`**, reload wiring test via **`reloadPage`**; status → **done**.

---

### Open questions (non-blocking)

- Whether **`global-error.tsx`** is warranted for **`layout.tsx`** failures — rare; only add if product wants root-layout crash coverage ([Source: Next.js error conventions]).
