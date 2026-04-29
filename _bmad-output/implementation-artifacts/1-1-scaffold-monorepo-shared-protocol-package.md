# Story 1.1: Scaffold monorepo & shared protocol package

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a developer building Skribbl,
I want the pnpm workspace, `@skribbl/shared` Zod wire schemas, `@skribbl/web` Next shell, and `@skribbl/server` WS entry wired per architecture,
so that every later story shares one canonical protocol and build pipeline.

## Acceptance Criteria

1. **Given** a fresh repo root **when** the bootstrap sequence from game-architecture is applied (`pnpm-workspace.yaml`, root `package.json` with `private: true`, workspace deps `workspace:*` on `@skribbl/shared`) **then** `pnpm install` succeeds.
2. Each workspace (`@skribbl/web`, `@skribbl/server`, `@skribbl/shared`) exposes **TypeScript** so `pnpm -r exec tsc --noEmit` (or per-package `typecheck` scripts) passes with **no emit errors**.
3. Folder layout matches the **target directory tree** in `game-architecture.md` (adjusted only if an ADR exists; default is as documented): `apps/web`, `apps/server`, `packages/shared`, optional `data/words.json` at repo root.
4. **`@skribbl/shared`** is the **only** package defining wire message shapes: Zod schemas **and** inferred TS types exported from a stable entry (e.g. `src/index.ts`); **no** duplicate protocol types in `apps/*`.
5. **Initial schemas** cover at least: a **discriminated client→server command root** (or explicit union) including placeholders for future handlers; a **server→client `error`** event with stable **`code`** string (and optional `message` / correlation fields per architecture error strategy); **ping** (and matching **pong** or server echo) for connectivity checks. Shapes must be **parseable** with Zod on both sides—Story 1.2 will extend `joinRoom` / room commands without renaming the package API pattern.
6. **`@skribbl/web`**: Next.js App Router + Tailwind; **DaisyUI** added per architecture. Minimal app shell (e.g. home route) that builds.
7. **`@skribbl/server`**: Node entry (`src/index.ts`) that starts an HTTP server exposing **`/healthz`** and attaches a **`ws`** WebSocket server (may no-op on messages until 1.2—must **import** shared parsers to prove linkage). Use **`pino`** for structured logging on startup.
8. Root scripts document **`pnpm --filter @skribbl/<pkg> <cmd>`** usage; `README` or root comment block references two-process deploy and **`NEXT_PUBLIC_WS_URL`** for split hosting.

## Tasks / Subtasks

- [x] **Monorepo bootstrap** (AC: 1–3, 8)
  - [x] Add `pnpm-workspace.yaml` (`apps/*`, `packages/*`), root `package.json` (`private: true`).
  - [x] Create `packages/shared` with `name: @skribbl/shared`, `zod`, `typescript`, `tsconfig`, `src/index.ts` re-exports.
  - [x] Scaffold `apps/web` with `create next-app` (TypeScript, Tailwind, ESLint, App Router, `src/`), set `name: @skribbl/web`, add `workspace:*` dep on shared; add DaisyUI per Tailwind/Daisy docs.
  - [x] Scaffold `apps/server` with `name: @skribbl/server`, deps: `ws`, `pino`, `tsx` (or node runner), `typescript`, `workspace:*` on shared; `src/index.ts` + stub `room/`, `protocol/handlers/`, `config/game.ts` folders/files as empty or minimal placeholders.
  - [x] Add `data/words.json` (empty array or tiny sample) if missing—canonical path for later stories.
- [x] **Shared protocol** (AC: 4–5)
  - [x] Implement `schemas.ts` (or split modules) with discriminated unions; export `z.infer` types; unit-test **one invalid payload** maps to Zod failure (optional tiny Vitest in shared, or defer to server package if you keep shared test-free for now—prefer at least one test in shared or server importing `parse`).
  - [x] Document in code comment: full command/event list from architecture will accrete here—**do not** define duplicate enums in apps.
- [x] **Web shell** (AC: 6)
  - [x] Ensure `features/lobby`, `features/game`, `features/room` dirs exist under `src/` (can contain `.gitkeep` until UI stories).
  - [x] Add minimal client WS helper under `src/lib/` that uses **only** shared types for outbound **ping** (optional behind dev flag)—enough to validate types compile.
- [x] **Game server** (AC: 7)
  - [x] `GET /healthz` returns 200 plain OK JSON or body suitable for probes.
  - [x] WebSocket server: on message, **safe parse** with shared Zod; unknown → structured `error` schema path (don't crash process).
- [x] **Verification** (AC: 2)
  - [x] Run `pnpm install`, `pnpm -r exec tsc --noEmit` (or documented equivalent), `pnpm --filter @skribbl/web build` smoke if CI not yet added.

## Dev Notes

### Architecture compliance

- **Single source of truth:** All JSON on the wire is validated with Zod schemas from `@skribbl/shared`. Apps must not redefine message types.
- **Two processes (MVP):** Do not merge Next and authoritative WS into one process as the default; standalone `apps/server` process.
- **Stack versions (pin before CI lock):** Next **16.2.4**, React **19.2.5**, **ws 8.20.0**, **Zod 4.3.6** — re-verify with registry if bumping. Node **24.x** LTS on server.
- **Boundaries:** `packages/shared` → only Zod + TS. No React, `ws`, or Node-only APIs in shared.
- **Naming:** `kebab-case` folders; `PascalCase.tsx` components; `camelCase` functions; package names exactly `@skribbl/web`, `@skribbl/server`, `@skribbl/shared`.

### File structure (must create or align)

See full tree in [Source: `_bmad-output/game-architecture.md` — Project Structure → Directory tree].

Key paths:

- `packages/shared/src/schemas.ts`, `index.ts`
- `apps/server/src/index.ts`, `room/`, `protocol/handlers/`, `config/game.ts`
- `apps/web/src/app/`, `components/`, `features/{lobby,game,room}/`, `lib/`

### Technical requirements (guardrails)

- Prefer **`Result`-style** handling in server handlers when adding logic; for scaffold, at least avoid uncaught exceptions on bad JSON.
- Server **`error` event** must use codes suitable for later client UX (e.g. `BAD_PAYLOAD`, `UNKNOWN_TYPE`)—align with epic 1.2 recoverable error expectations.
- **WORDS_PATH** / `data/words.json`: not required to load in 1.1 beyond file existence if you add the file; Story 2.x will depend on it.

### Testing requirements

- **Vitest:** Add to `@skribbl/server` (and/or `@skribbl/shared`) with at least one test: invalid wire payload rejected by shared schema.
- **Playwright:** Not required for 1.1 unless trivial — epic is infrastructure; optional stub `tests/e2e` folder with README note for later.
- **Manual:** Start server + `next dev`; hit `/healthz`; optional WS client ping.

### UX / product

- No lobby UX in this story; Next home can be a minimal placeholder. UX spec [Session bootstrap — Create or join → lobby](`_bmad-output/planning-artifacts/ux-design-specification.md`) applies from Story 1.3 onward.

### Cross-epic context (Epic 1)

- **1.2** will implement authoritative `createRoom` / `joinRoom` with secure codes—extend the shared union **in place**; do not fork types into `apps/server` only.
- Stories **1.3–1.7** assume this monorepo and protocol package exist.

### Previous story intelligence

- *N/A* — first story in Epic 1; no prior implementation artifact in `implementation-artifacts/`.

### Git intelligence

- Recent commits are documentation-only (`game-architecture`, VS Code settings). **Greenfield code** — expect no existing `apps/` or `packages/`; scaffold from zero.

### Latest technical specifics

- WebSocket library: **`ws`** only — do **not** add Socket.io (ADR-001). [Source: `game-architecture.md` — Architectural Decisions]
- **Context7** MCP: use for current Next.js App Router, DaisyUI + Tailwind integration, and `ws` patterns when generating config or boilerplate.

### Project Context Rules

Extracted from `_bmad-output/project-context.md` — **must follow**:

- **`@skribbl/shared`** is the **only** place for wire message shapes + inferred types; invalid payloads → **`error`** with stable **`code`**.
- **Monorepo commands:** `pnpm --filter @skribbl/<pkg> <cmd>`.
- **Do not** use Socket.io, duplicate schemas in apps, or add Mongo/ORM for MVP room state.
- **Deploy:** Two processes; **`NEXT_PUBLIC_WS_URL`** for client when WS host differs; **`/healthz`** on game server.
- **Testing:** Vitest (server/shared); Playwright later for two-client smoke.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.1]
- [Source: `_bmad-output/game-architecture.md` — Engine & Framework, Bootstrap sequence, Project Structure, API / realtime pattern, ADRs]
- [Source: `_bmad-output/project-context.md` — full stack rules]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- Root `pnpm create next-app@16.2.4` required pre-created `apps/` (CLI path writability).
- Turbopack could not resolve `./schemas.js` from shared **source**; fixed by compiling `@skribbl/shared` to `dist/` (NodeNext emit) and pointing package `exports` at `dist`.
- Removed stray `apps/web/pnpm-workspace.yaml` that confused Next.js workspace-root detection.

### Completion Notes List

- Monorepo: root `package.json`, `pnpm-workspace.yaml`, `README.md` (two-process + `NEXT_PUBLIC_WS_URL`), `.gitignore`, `data/words.json`.
- `@skribbl/shared`: Zod 4.3.6 discriminated unions (`type`: `ping` | `noop`, `pong` | `error`); `dist` build + Vitest invalid-payload test.
- `@skribbl/web`: Next 16.2.4, React 19.2.5, Tailwind v4 + DaisyUI (`@plugin` in `globals.css`), feature dirs, `ComponentWsPingDemo` + `lib/ws-client.ts` (env-gated demo).
- `@skribbl/server`: `ws` 8.20.0, `pino`, `/healthz`, JSON + Zod `safeParseClientCommand`, structured `error` responses, exhaustive `switch` on commands; Vitest import test from shared.

### File List

- `package.json`
- `pnpm-workspace.yaml`
- `.gitignore`
- `README.md`
- `data/words.json`
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/tsconfig.build.json`
- `packages/shared/vitest.config.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/schemas.test.ts`
- `apps/server/package.json`
- `apps/server/tsconfig.json`
- `apps/server/vitest.config.ts`
- `apps/server/src/create-game-server.ts`
- `apps/server/src/index.ts`
- `apps/server/src/config/game.ts`
- `apps/server/src/protocol-parse.test.ts`
- `apps/server/src/room/.gitkeep`
- `apps/server/src/protocol/handlers/.gitkeep`
- `apps/web/` (Next.js scaffold from `create-next-app@16.2.4`, plus updates: `package.json`, `next.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/ComponentWsPingDemo.tsx`, `src/lib/ws-client.ts`, `src/features/*/.gitkeep`)

### Review Findings

- [x] [Review][Patch] Separate server bootstrap from reusable `createGameServer` export — Today `apps/server/src/index.ts` calls `createGameServer()`, then `server.listen()`, at module load while also exporting `createGameServer`. Any future `import { createGameServer } from …/index.ts` cannot be used without the listen side effect, which blocks isolated tests or alternate entrypoints. Prefer `createGameServer.ts` (or similar) exporting only factory + handlers, and a thin `index.ts` / `main.ts` that calls listen only when executed as the process entry.

- [x] [Review][Patch] Align `@types/node` with engine Node 24 — `apps/server` and `apps/web` use `@types/node` `^20` while root `engines.node` is `>=24`. Bump dev types to match the documented LTS to avoid subtle API mismatches during implementation.

- [x] [Review][Defer] No WebSocket max message size or per-connection limits — MVP scaffold; revisit before public beta or load testing. [`apps/server/src/create-game-server.ts`]

- [x] [Review][Defer] Dev-only `maybeDemoPingWs` opens a socket in `useEffect` without teardown on route unmount — low impact; add `close()` in effect cleanup when the demo evolves.

## Saved questions / clarifications (optional follow-up)

- Whether to add **Turborepo** in 1.1 or defer (architecture marks it optional); default **defer** unless you want caching from day one.
- Exact **discriminant field** name on wire (`type` vs `msgType`)—pick one, document in `schemas.ts`, and keep consistent for all future messages.

## Change Log

- 2026-04-29 — Code review: applied patches (server `create-game-server` split, `@types/node` ^24); story marked done.
- 2026-04-29 — Implemented Story 1.1 monorepo scaffold, shared Zod protocol, Next + DaisyUI shell, Node `ws` server with `/healthz`, Vitest coverage, root README.
