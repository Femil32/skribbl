---
project_name: 'skribbl'
user_name: 'Femil'
date: '2026-04-29'
sections_completed:
  - technology_stack
  - engine_rules
  - performance_rules
  - organization_rules
  - testing_rules
  - platform_rules
  - anti_patterns
status: complete
rule_count: 36
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing game code in this project. Focus on unobvious details that agents might otherwise miss._

_Full detail: `_bmad-output/game-architecture.md`. This is a **browser + Node** realtime game—not Unity/Unreal/Godot._

---

## Technology Stack & Versions

| Layer | Choice | Notes |
| ----- | ------ | ----- |
| **Client** | **Next.js ~16.x** (App Router), **React ~19.x**, **TypeScript** | Features under `apps/web/src/features/*` |
| **UI** | **Tailwind** + **DaisyUI** | Align with UX spec |
| **Drawing** | **Canvas 2D** | Not WebGL for MVP |
| **Server** | **Node 24.x** LTS, **`ws`**, **pino** (logging) | Dedicated process for game WS |
| **Contracts** | **Zod 4.x** in **`@skribbl/shared`** | Only place for wire message shapes + inferred types |
| **Repo** | **pnpm** workspaces | `@skribbl/web`, `@skribbl/server`, `@skribbl/shared` |
| **Words** | `data/words.json` at **repo root** | **`WORDS_PATH`** overrides on server |

**Pin before CI lock:** Next **16.2.4**, React **19.2.5**, **ws 8.20.0**, **Zod 4.3.6** (re-verify on bootstrap).

**Deploy:** Two processes (Next + Node WS) behind a proxy, or split cloud + **`NEXT_PUBLIC_WS_URL`**. MVP: **no** DB/ORM.

---

## Critical Implementation Rules

### Engine-Specific Rules

_“Engine” here = Next.js + React + Canvas 2D + Node `ws`—not a 3D runtime._

- Run the **authoritative game WebSocket** in **`@skribbl/server`** (long-lived Node). Do **not** treat the primary room/match socket as a serverless/edge afterthought—keep it a **dedicated process** (see architecture deploy section).
- **All** JSON on the wire: **parse/stringify through Zod schemas** exported from **`@skribbl/shared`**. Invalid payloads → **`error`** event with a stable **`code`**; never trust unchecked shapes.
- **Server-authoritative:** phase, timers, scores, drawer word choice, **monotonic canvas `seq`**, chat verdicts. Client sends **intent** (`joinRoom`, stroke batches, `sendChat`, etc.); server emits **facts** (`strokeBatch`, `canvasOp`, `statePatch`, …).
- Command handlers should return **`Result`-style unions** (`{ ok: true, value } | { ok: false, code, …}`) internally; **do not** let exceptions propagate over WS without also emitting a structured server **`error`**.
- **Single** `ws.onmessage` (or equivalent) on the client → demux by `type` to small handlers—avoid scattered `JSON.parse` without schema.
- **Canvas pipeline:** pointer → local immediate draw → **~50 ms** batch (or flush on stroke end / visibility hide) → `submitStrokeBatch` with types from shared. **`seq`** assignment is **server-only**.
- **`clearCanvas` / fill-style ops:** same op-log + **`seq`** rules as strokes—no client-only clears that desync multiplayer state.
- Reconnect / late join: **`snapshot` + replay ops since `seq`**; if **`seq`** gap → **resync** path—never silently skip.
- **`packages/shared`:** depend only on **Zod** + **TS**. **No** React, **`ws`**, Node-only APIs, or Next imports.

### Performance Rules

- **Latency:** Batch strokes ~**50 ms**; aim **&lt;100 ms** perceived replication. Flush on stroke end.
- **Client:** Target **~60 FPS** for local drawing + applying remote ops in the Canvas loop (**rAF**-friendly).
- **NFR:** **TTI &lt;1.5 s** on typical broadband—keep client bundles and hydration disciplined.
- Server hot paths: avoid per-message heap churn where possible; use **structured JSON logs** (**pino**), appropriate log levels—not `console.log` spam in prod.

### Code Organization Rules

- **Monorepo:** **`pnpm --filter @skribbl/<pkg> <cmd>`**; workspace names are fixed: **`@skribbl/web`**, **`@skribbl/server`**, **`@skribbl/shared`**.
- **Web:** **`src/features/{lobby,game,room}/`** plus **`src/app/`**, **`src/components/`**, **`src/lib/`** as in architecture tree.
- **Server:** **`room/`** (manager, **`match-state-machine`**, **`canvas-log`**), **`protocol/handlers/`**, **`config/game.ts`** for gameplay constants env reads.
- **Naming:** `kebab-case` folders; **`PascalCase.tsx`** components; **`camelCase`** functions/vars; **`UPPER_SNAKE`** for true constants only.
- Wire **JSON field naming** may be **`snake_case`**—normalize **once** at boundaries into TS types from **`@skribbl/shared`**, don't fork names in apps.
- Breaking cycles via **`apps/web/src/lib`** or shared types—not duplicate protocol blobs.

### Testing Rules

- **Vitest** in **`@skribbl/server`** (and **`@skribbl/shared`** for pure parsers/helpers). Keep **match state transitions** testable **pure functions** where possible.
- **Playwright** E2E (root or **`@skribbl/web`**): smoke two clients, one room, WS path—prioritize **real browser** sockets over mocked WS for regression value.
- **Invalid Zod payloads:** unit-test that they map to **`error`** events/codes—not silent ignores.

### Platform & Build Rules

- **Target:** Modern **desktop browsers** (Chrome, Firefox, Safari, Edge)—**desktop-first** layout; Canvas must map coordinates with **CSS size + DPR** (and eventual touch—deferred per GDD, but use pointer abstraction where it reduces duplication).
- Client env: **`NEXT_PUBLIC_*`** only for truly client-visible config (e.g. WS URL). **Secrets and limits** stay in **`@skribbl/server`** env.
- Expose **`/healthz`** on the game server for probes; WS may live on alternate host/port in split deploy (**`NEXT_PUBLIC_WS_URL`**).
- **Root scripts:** `pnpm install`, `pnpm -r build`, `pnpm -r exec tsc --noEmit` or per-package **`typecheck`** as packages define.

### Critical Don't-Miss Rules

- **Don't** introduce **Socket.io** unless an ADR revokes **`ws`** (ADR-001).
- **Don't** duplicate message types/schemas in **`apps/web`** or **`apps/server`**—**one** edits **`@skribbl/shared`**.
- **Don't** add **Mongo/ORM/session DB** for MVP match state without explicit scope change—in-memory rooms are intentional.
- **Don't** collapse Next + authoritative WS into **one OS process** as the default MVP story—**two processes** + proxy (or documented split) is the baseline.
- **Word list:** only **`data/words.json`** at repo root as canonical; server resolves **`WORDS_PATH`** when not default.
- **Debug:** **`?debug=1`**, verbose client logging, dev-only overlays—**no-op** or gated when **`NODE_ENV === 'production'`**.
- **Anti-spoiler / chat:** guessing and reveal rules follow GDD (exact match, hints)—don't leak the word in client-only state ahead of server.
- **Reconnect:** **`session token` / `player id`** validated server-side before resuming; handle duplicate-tab / race on **`startMatch`** per architecture risks list.

---

## Usage Guidelines

**For AI Agents**

- Read this file (and **`game-architecture.md`** for deeper rationale) before implementing features.
- Follow rules here **and** existing code patterns once the repo exists; **`@skribbl/shared`** is the authority for protocols.
- When unsure, prefer **stricter** authority, validation, and explicit error **`code`**s over clever client shortcuts.

**For Humans**

- Keep this file **short and specific**—remove rules that became obvious once the codebase stabilized.
- Update when stack versions, deploy topology, or protocol assumptions change.

Last Updated: 2026-04-29
