---
title: 'Game Architecture'
project: 'skribbl'
date: '2026-04-29'
author: 'Femil'
version: '1.2'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
status: 'complete'
engine: 'Next.js 16 + Node 24 (Web)'
platform: 'Web (desktop browsers)'
repo_layout: 'pnpm monorepo (apps/web, apps/server, packages/shared)'
package_scope: '@skribbl/*'

# Source Documents
gdd: '_bmad-output/planning-artifacts/gdd.md'
epics: null
brief: '_bmad-output/planning-artifacts/game-brief.md'
---

## Executive Summary

Skribbl uses a **Next.js 16** SPA shell for UI and a **Node 24** **WebSocket** service for **authoritative, in-memory** rooms and match state (no durable DB for MVP). The codebase is a **pnpm workspaces monorepo** with three workspace packages **`@skribbl/web`**, **`@skribbl/server`**, and **`@skribbl/shared`** (Zod + protocol types — single source of truth for wire messages). **Canvas 2D** sync uses **server-sequenced drawing ops** with **~50 ms** batching toward **\<100 ms** replication. **ws** + **Zod**, a server **match state machine**, and **feature-based** folders under **`apps/web`** keep implementation consistent for portfolio review.

# Game Architecture

## Document Status

Architecture workflow **complete** (9 of 9).

**Revision 1.2:** **Alignment pass** — one workspace toolchain (**pnpm**), one package naming scheme (**`@skribbl/*`**), one word-list location (**repo root**), canonical `pnpm-workspace.yaml` + bootstrap, filters/scripts use **`--filter @skribbl/<pkg>`** everywhere.

**Revision 1.1:** Monorepo + shared package; deployment for single-host (two processes) and split cloud.

---

## Project Context

### Game Overview

**Skribbl** — Real-time browser party game: one player draws a secret word on a shared canvas while others guess in live chat; turns rotate; scoring rewards fast guesses and successful drawing. Target use: portfolio-quality full-stack demo (WebSocket + Canvas + clear structure) with frictionless join via link/code and no accounts for MVP.

### Technical Scope

**Platform:** Web — modern desktop browsers (Chrome, Firefox, Safari, Edge); SPA with WebSocket; responsive layout with desktop-first assumptions and canvas coordinate mapping for varying viewports.

**Genre / mode:** Online party / social — single core draw-and-guess mode (not a minigame anthology).

**Project level:** High technical complexity relative to scope — real-time sync, canvas tooling, and reconnect hydration dominate engineering risk; mechanic is genre-standard.

### Core Systems

| System | Role | Complexity |
|--------|------|------------|
| Real-time transport & rooms | WebSocket connections, room lifecycle, message fanout, capacity limits | High |
| Drawing & canvas sync | Stroke capture, batching, broadcast, playback; tools (color, sizes, eraser, fill, clear); late-join canvas hydrate | High |
| Match / round orchestration | Lobby, start rules, word choice (1 of 3), 80s draw phase, hints, rotation, end-game scoreboard | Medium–high |
| Chat & guessing | Chat pipeline, exact word match, anti-spoiler behavior, progressive letter hints | Medium |
| Scoring | Speed-based points for guessers; drawer rewards when others guess | Medium |
| Resilience | Reconnect preserving identity and score; chat + canvas hydrate | Medium |
| Portfolio shell | Error UX (e.g. WebSocket blocked), basic SEO, source/demo links | Low–medium |

### Technical Requirements

- **Latency:** Typical stroke replication **<100ms**; suggested **~50ms** batching cadence to bound bandwidth.
- **Rendering:** **~60 FPS** for local drawing and applying remote strokes.
- **Loading:** **TTI <1.5s** on typical broadband.
- **Scale (stated targets):** **≤8** players per room; **~100** concurrent rooms on a modest single-instance deployment.
- **MVP persistence:** **Ephemeral in-memory** session state on the game server — aligns with GDD/brief; MongoDB/ORM is **out of scope for MVP** unless requirements change.

### Complexity Drivers

- **Realtime correctness:** Ordering, batching, and recovery without visible desync or lost canvas state.
- **Rich canvas operations:** Fill and clear need explicit server-owned semantics alongside vector strokes.
- **Operational constraints:** Solo dev, $0/free-tier hosting — favors simple processes and clear service boundaries.
- **Explicit NFRs:** Latency, FPS, and TTI targets put pressure on protocol and client render loops.

### Technical Risks

- WebSocket + room edge cases (disconnect mid-round, duplicate tabs, races on match start).
- Free-tier / cold-start behavior vs. reliable demos.
- Cross-browser Canvas differences affecting stroke smoothness or tool behavior.
- Scope expansion (mobile touch, audio, accounts) vs. MVP stability — GDD defers these explicitly.

---

## Engine & Framework

### Selected stack (browser game — not a 3D engine)

**Client (`apps/web`, `@skribbl/web`):** **Next.js** **16.2.4** (App Router) + **React** **19.2.5** + **TypeScript**, **Tailwind CSS** + **DaisyUI**, **HTML5 Canvas 2D** for drawing.

**Server (`apps/server`, `@skribbl/server`):** **Node.js** **24.x** LTS for the **WebSocket** game server and authoritative room/match logic.

**Shared (`packages/shared`, `@skribbl/shared`):** **Zod** schemas + exported **TypeScript types** for **all** client ↔ server messages — the **only** canonical definition of the wire protocol.

**Versions verified:** `npm view next` / `react` / `ws` / `zod` on **2026-04-29** — **Next 16.2.4**, **React 19.2.5**, **ws 8.20.0**, **Zod 4.3.6**. Re-verify before locking CI.

**Rationale:** Matches GDD/brief (web, Canvas, WebSocket, reviewable code). Long-lived sockets run in a **dedicated Node process** (`apps/server`); avoid coupling them to serverless/edge.

### Workspace packages (canonical)

| Path | `package.json` `name` |
|------|------------------------|
| `apps/web` | `@skribbl/web` |
| `apps/server` | `@skribbl/server` |
| `packages/shared` | `@skribbl/shared` |

**Tooling:** **pnpm** workspaces (required for this doc). **`pnpm-workspace.yaml`** at repo root:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**Root `package.json`:** set **`"private": true`**. In **`apps/web`** and **`apps/server`**, depend on **`"@skribbl/shared": "workspace:*"`** (zod is a dependency of **`@skribbl/shared`**; apps add their own `ws`, `next`, etc.).

**Root scripts (reference):** use **`pnpm --filter @skribbl/web <script>`** and **`pnpm --filter @skribbl/server <script>`**, or **`pnpm run -r --parallel dev`** if each package exposes **`dev`**.

### Bootstrap sequence (greenfield)

```bash
mkdir skribbl && cd skribbl
pnpm init
# Add pnpm-workspace.yaml (packages: apps/*, packages/*) and "private": true in root package.json

# 1) @skribbl/shared first
mkdir -p packages/shared/src
cd packages/shared && pnpm init
# Set "name": "@skribbl/shared". Add zod, typescript, build exports.

cd ../..
pnpm create next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
# In apps/web/package.json set "name": "@skribbl/web" and "@skribbl/shared": "workspace:*"

mkdir -p apps/server/src && cd apps/server && pnpm init
# Set "name": "@skribbl/server". Add "@skribbl/shared": "workspace:*", ws, pino, tsx, typescript. Entry: src/index.ts

cd ../..
pnpm install
```

Add **DaisyUI** in **`apps/web`**.

**Word list:** **`data/words.json`** at **repository root** only; **`@skribbl/server`** loads it via **`WORDS_PATH`** (absolute or relative to cwd) — document the default in **`apps/server`** README.

### What this stack decides for you

| Area | Provided by stack | Notes |
|------|-------------------|--------|
| **Rendering** | Browser + React DOM; drawing via Canvas 2D | You own the canvas loop and tool pipeline |
| **Physics** | N/A | Not a physics-driven game |
| **Audio** | Web Audio API (optional) | MVP: none/deferred per GDD |
| **Input** | Pointer/touch + keyboard via DOM/React | Map to canvas coordinates with DPR / layout |
| **“Scenes”** | Next routes + React tree | Lobby vs play via route segments or route + client phase state |
| **Build / dev** | `next dev` / `next build` in `apps/web`; Node in `apps/server` | See **Deployment** — one or two processes per host |

### AI / MCP tooling

| MCP | Repo | Purpose |
|-----|------|---------|
| **Context7** | [upstash/context7](https://github.com/upstash/context7) | Current Next/React/library docs |

Engine-specific Unity/Godot MCPs are **N/A**. Optional: Cursor **Next.js DevTools** MCP.

---

## Architectural Decisions

### Decision summary

| Category | Decision | Version / detail | Rationale |
| -------- | -------- | ---------------- | --------- |
| **Repository layout** | **pnpm workspaces** | `apps/web` → `@skribbl/web`, `apps/server` → `@skribbl/server`, `packages/shared` → `@skribbl/shared` | Atomic protocol + UI + WS changes; no npm publish |
| Realtime transport | **`ws`** (no Socket.io) | **ws 8.20.0** | Minimal abstraction; backpressure and close codes under your control |
| Message contracts | **Zod** in **`@skribbl/shared`** | **zod 4.3.6** | Both apps import identical schemas and inferred types |
| Authority | **Server-authoritative** match, chat adjudication, canvas op ordering | — | Prevents desync and cheating; client is view + intent |
| Canvas sync | **Ordered op log** (stroke batches, clear, fill) with **monotonic seq** | — | Reconnect / late join = snapshot + replay |
| Client batching | **~50ms** flush timer + “stroke end” flush | — | GDD bandwidth / latency tradeoff |
| Rooms & identity | **Room code** URL; **server-issued session token** on join | — | Reconnect without accounts |
| **Deployment (primary)** | **Single host**, **two processes**: reverse proxy → **`@skribbl/web`** + **`@skribbl/server`**; optional **Docker Compose** | — | One clone, one build (`pnpm -r build`), two runtimes |
| **Deployment (alternate)** | **Split cloud:** Next (e.g. Vercel) + WS (Railway/Render/Fly) | — | Same monorepo CI, two deploy targets |
| Persistence | **None (MVP)** — in-memory rooms | — | GDD/brief |
| Match logic | **Explicit state machine** | — | Auditable; easy to test |
| Word list | **`data/words.json`** at **repo root** | — | **`WORDS_PATH`** in **`@skribbl/server`** |
| Build orchestration | Root `pnpm` scripts + optional **Turborepo** | — | Optional caching only |
| Testing | **Vitest** in **`@skribbl/server`** (+ shared pure tests in **`@skribbl/shared`** if needed) + **Playwright** (e.g. from root or **`@skribbl/web`**) | — | Protocol + E2E |

### State management

- **Server:** One `Room` aggregate per code; nested `MatchState` with a **finite state machine** (plain TS `switch` or small library — avoid heavy ECS).
- **Client:** **React state** + thin hooks (`useGameConnection`, `useCanvasController`); **no global Redux** unless a later complexity spike demands it.

### Data persistence

- **MVP:** No saves, no cloud — scores exist for session length only.
- **Config:** Environment variables per app; **`@skribbl/web`** uses `NEXT_PUBLIC_*` only where unavoidable. **`@skribbl/server`** holds secrets and game limits.

### API / realtime pattern

- **Commands** (client → server): `joinRoom`, `startMatch`, `chooseWord`, `submitStrokeBatch`, `clearCanvas`, `fillCanvas?`, `sendChat`, `ping`.
- **Events** (server → client): `statePatch`, `strokeBatch`, `canvasOp`, `chatMessage`, `roundTick`, `hintTick`, `playerJoined`, `error`, etc.
- **REST** optional for health checks only; game loop is **WS-only**. Schemas live in **`@skribbl/shared`** only.

### Authentication / authorization

- **No accounts (MVP).** **Nickname + avatar** are session fields. **Trust model:** host controls start; anti-abuse deferred.
- **Reconnect:** Present **session token** or **player id** issued at join; server validates before resuming.

### Deployment patterns (from one monorepo)

**A — Single VPS / Compose**

- Build: **`pnpm -r build`** (or **turbo** if added).  
- Run **`@skribbl/server`** (Node, public **WSS**).  
- Run **`@skribbl/web`** production server (**`pnpm --filter @skribbl/web start`** after **`next build`**).  
- **Caddy / Nginx:** `/` → Next HTTP; WebSocket path or **`ws.`** subdomain → game port.  
- One machine; env for **`NEXT_PUBLIC_WS_URL`** and **`WORDS_PATH`**.

**B — Split cloud**

- CI builds both packages from one commit.  
- **`NEXT_PUBLIC_WS_URL`** points at hosted WS.

**Not in scope for MVP:** one OS process merging Next + WS (custom server) — prefer **two processes** behind one proxy.

### Architecture Decision Records (compact)

1. **ADR-001 — `ws` over Socket.io:** Fewer moving parts; you own the protocol.  
2. **ADR-002 — Op log + seq:** Ordering beats CRDT complexity for this scope.  
3. **ADR-003 — Deploy flexibility:** Single host (two processes) or split cloud from one monorepo build.  
4. **ADR-004 — `@skribbl/shared`:** All Zod + message types in one package; **`@skribbl/web`** and **`@skribbl/server`** do not duplicate protocol definitions.

---

## Cross-cutting Concerns

These patterns apply to **all** systems; agents must not diverge.

### Error handling

**Strategy:** **`Result`** / discriminated unions on the server; **never throw across WS boundaries** without also sending a structured `error` event.

**Levels:**

- **Fatal (room):** Misconfiguration or invariant violation — log `error`, close connection with **specific code** where useful.
- **Recoverable:** Bad command — respond with `{ type: 'error', code: 'BAD_COMMAND', messageId }`, keep session.
- **Client UI:** React **error boundary** around game shell in **`apps/web`**; user-facing copy for **WS blocked** / **server down**.

**Example (server sketch):**

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; code: string; message?: string };

function handleCommand(room: Room, cmd: Command): Result<void> {
  if (room.phase !== 'drawing') return { ok: false, code: 'WRONG_PHASE' };
  return { ok: true, value: undefined };
}
```

### Logging

**Format:** **Structured JSON** on **`@skribbl/server`** (**`pino`** recommended). Client logging gated as before.

**Destination:** `stdout`. Client: `console` **gated** — `debug` only when `localStorage.DEBUG=1` or env-driven dev build.

**Levels:** `error` invariant / external failures; `warn` rate-limit, backpressure; `info` room lifecycle; `debug` message types (off in prod by default).

**Example:**

```typescript
logger.info({ roomId, playerId, msg: 'join' }, 'player_joined');
```

### Configuration

**Approach:** **Per-package environment variables** for URLs, limits (`MAX_PLAYERS=8`), timers (`ROUND_MS=80000`). **Gameplay constants** in **`apps/server/src/config/game.ts`** — **read-only imports**.

**Word data:** **`data/words.json`** at repo root; **`WORDS_PATH`** overrides path when set.

### Event system

**Server:** **Typed dispatcher** — `emitToRoom(roomId, event)`; types and parsers from **`@skribbl/shared`**.

**Client (`apps/web`):** **Single WebSocket listener** demuxes into a small **event reducer** or callbacks per screen.

**Naming:** `PascalCase` type names; **verb past tense** for events (`PlayerJoined`, `StrokeBatchApplied`). Use **`@skribbl/shared`** exports; do not redefine duplicates in app code.

**Example:**

```typescript
type ServerToClient = { type: 'strokeBatch'; seq: number; playerId: string; points: Point[] } | { type: 'error'; code: string };
```

### Debug tools

- **`?debug=1`**: Verbose client logging + optional **seq** / latency overlay (dev only).
- **`/healthz`** on **`@skribbl/server`** for probes.
- **Replay last N ops** stub in dev (optional).

**Activation:** Debug features **no-op** in production via `process.env.NODE_ENV`.

---

## Project Structure

### Organization pattern

**pnpm monorepo:** **`@skribbl/web`** = Next App Router + **`src/features/*`**. **`@skribbl/server`** = Node WS host. **`@skribbl/shared`** = **Zod** + **TypeScript** only.

### Directory tree (target)

```text
skribbl/
├── pnpm-workspace.yaml
├── package.json                      # private: true; scripts orchestrate filters
├── turbo.json                        # optional
├── apps/
│   ├── web/                          # @skribbl/web
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   │   ├── lobby/
│   │   │   │   ├── game/
│   │   │   │   └── room/
│   │   │   └── lib/
│   │   ├── public/
│   │   ├── package.json              # name: @skribbl/web
│   │   └── next.config.ts
│   └── server/                       # @skribbl/server
│       ├── src/
│       │   ├── index.ts
│       │   ├── room/
│       │   │   ├── room-manager.ts
│       │   │   ├── match-state-machine.ts
│       │   │   └── canvas-log.ts
│       │   ├── protocol/
│       │   │   └── handlers/
│       │   └── config/
│       │       └── game.ts
│       └── package.json              # name: @skribbl/server
├── packages/
│   └── shared/                       # @skribbl/shared
│       ├── src/
│       │   ├── index.ts
│       │   ├── schemas.ts
│       │   └── types.ts
│       ├── package.json
│       └── tsconfig.json
├── data/
│   └── words.json
├── tests/
│   └── e2e/
└── docker-compose.yml                # optional
```

### System location mapping

| System | Location | Responsibility |
| ------ | -------- | -------------- |
| Transport & fanout | `apps/server/src/index.ts`, `apps/server/src/room/*` | WS server, broadcast, caps |
| Match / rounds | `apps/server/src/room/match-state-machine.ts` | Phases, timer, rotation |
| Canvas op ordering | `apps/server/src/room/canvas-log.ts` | Seq, snapshot, replay |
| Wire schemas | `packages/shared/src/schemas.ts` | Zod + exported types |
| Client canvas | `apps/web/src/features/game/canvas/*` | Input → batches → render |
| Chat / guesses | `apps/server/src/protocol/handlers/chat.ts`, `apps/web/src/features/game/chat/*` | Normalize, match word, hints |
| Lobby / join | `apps/web/src/features/lobby/*`, `joinRoom` handler | URL/code UX |
| Word lists | `data/words.json`, loaded by `@skribbl/server` | Drawer choices |

### Naming conventions

**Files:** `kebab-case` folders; **components** `PascalCase.tsx`; hooks `useThing.ts`.

**Code:** `camelCase` functions/vars; `PascalCase` types/components; `UPPER_SNAKE` true constants.

**Packages:** Always **`@skribbl/web`**, **`@skribbl/server`**, **`@skribbl/shared`** as in the table above.

**Events:** **`snake_case` in JSON wire** optional; **map once** at boundary to TS types from **`@skribbl/shared`**.

### Architectural boundaries

- **`packages/shared`** depends only on **Zod** + **TypeScript** — no React, no `ws`, no Node-only APIs.
- **`apps/server`** does not import **`apps/web`** — only **`@skribbl/shared`** + Node deps.
- **`apps/web`** imports **`@skribbl/shared`** and **must not** duplicate protocol types.
- **Canvas rendering** stays out of state machines — **intent** up, **ops** down.

### CI / tasks

- **Install:** `pnpm install` at root.  
- **Typecheck:** `pnpm -r exec tsc --noEmit` or per-package `typecheck`.  
- **Lint:** `pnpm -r lint` when each package defines `lint`.  
- **Test:** `pnpm -r test`; Playwright against **`@skribbl/web`** dev or preview URL.  
- **Docker:** Multi-stage **`pnpm -r build`**; copy artifacts per app.

---

## Implementation Patterns

### Novel patterns (Skribbl-specific)

#### 1. Batched stroke pipeline

**Purpose:** **~50 ms** batching and **\<100 ms** perceived sync.

**Flow:**

1. Pointer events → local **immediate** draw.  
2. Buffer points; **rAF** or **50 ms** flush.  
3. Send `strokeBatch` (types from **`@skribbl/shared`**).  
4. Server assigns **`seq`**, validates drawer + phase, appends to log, broadcasts.

**Edge cases:** **stroke end** and **tab hide** flush; server rejects when **not drawer**.

#### 2. Canvas op log + snapshot

**Purpose:** Late join / reconnect = **`snapshot` + ops since **`seq`**.

**Consistency:** No **seq** gaps — resync on gap.

### Communication patterns

- **Intent upstream, facts downstream.**
- Break cycles via **`apps/web/src/lib`** or **`@skribbl/shared`**.

**Example:**

```typescript
ws.onmessage = (ev) => {
  const msg = ServerToClientSchema.parse(JSON.parse(ev.data));
  bus.emit(msg.type, msg);
};
```

### Entity patterns

- **Plain objects** `Player`, `Room`, `Match`; factories colocated with server domain or DTOs in shared.

### State patterns

- **Server:** One state machine module; **pure** transitions, **Vitest** in **`@skribbl/server`**.
- **Client:** Per-feature UI state; connection **`connecting | live | reconnecting`**.

### Data patterns

- **Words:** load at **`@skribbl/server`** startup from **`WORDS_PATH`** or default **`data/words.json`** relative to repo root.  
- **No ORM (MVP).**

### Consistency rules (enforcement)

| Topic | Convention | Enforcement |
| ----- | ---------- | ----------- |
| Wire JSON | Parse with **`@skribbl/shared`** Zod | Invalid → `error` event |
| Seq | Monotonic per room | Dev assert; prod resync |
| Timers | Server-owned round timer | No client phase authority |
| UI | DaisyUI + Tailwind | Review |
| Protocol | Edits only in **`@skribbl/shared`** | PR gate |

---

## Architecture Validation

### Validation summary

| Check | Result | Notes |
| ----- | ------ | ----- |
| Decision compatibility | **Pass** | pnpm + `@skribbl/*` + WS + in-memory authority align |
| GDD coverage | **Pass** | Systems and NFRs mapped |
| Pattern completeness | **Pass** | Cross-cutting + patterns + CI |
| Epic mapping | **Pass** | E1–E6 → `apps/server` + `apps/web/src/features/*` |
| Document completeness | **Pass** | Single package naming; single word path; no forked alternatives |

### Coverage report

- **Systems covered:** 7 / 7  
- **Patterns:** 2 novel + standard set  
- **Decision rows:** 13  

### Revisions

- **v1.2:** Alignment pass (`@skribbl/*`, pnpm-only workspace doc, canonical tree, scripts/filters).  
- **v1.1:** Monorepo + deploy modes.

### Validation date

**2026-04-29**

**Overall status:** **PASS**

---

## Development Environment

### Prerequisites

- **Node.js 24.x** LTS  
- **pnpm** (workspaces)  
- **Chrome/Firefox** (devtools)  

### AI tooling (MCP)

| MCP | Purpose | Install |
| --- | ------- | ------- |
| **Context7** | Next/React/**ws** docs | [Context7](https://github.com/upstash/context7) |

### Setup commands

```bash
cd skribbl
pnpm install
pnpm --filter @skribbl/web dev
pnpm --filter @skribbl/server dev
```

Run both in parallel from root, for example:

```bash
pnpm exec concurrently "pnpm --filter @skribbl/web dev" "pnpm --filter @skribbl/server dev"
```

Or define a root script:

```json
"dev": "concurrently \"pnpm --filter @skribbl/web dev\" \"pnpm --filter @skribbl/server dev\""
```

Set **`NEXT_PUBLIC_WS_URL`** in **`@skribbl/web`**. Set **`WORDS_PATH`** in **`@skribbl/server`** if not using default repo-root **`data/words.json`**.

### First steps

1. Implement **`@skribbl/shared`** schemas and exports.  
2. **`@skribbl/server`**: room manager + join; two-tab broadcast smoke.  
3. Canvas batching + seq + reconnect replay.  
4. Match state machine, chat, hints, scoreboard.  
5. Playwright: two browsers, one room, one round.

---

## Epic / GDD traceability (quick map)

| GDD epic | Architectural home |
| -------- | ------------------- |
| E1 Real-time foundation | `apps/server/src`, deploy / Compose |
| E2 Lobby & match flow | `apps/server/src/room/*`, `apps/web/src/features/lobby` |
| E3 Drawing & sync | `apps/server/src/room/canvas-log.ts`, `apps/web/src/features/game/canvas` |
| E4 Chat & guessing | `apps/server/src/protocol/handlers/chat.ts`, `apps/web/src/features/game/chat` |
| E5 Scoring & rounds | `apps/server/src/room/match-state-machine.ts` |
| E6 Portfolio shell | `apps/web/src/app`, error boundaries, root README |

---

## Next steps

1. Scaffold **`pnpm-workspace.yaml`**, three packages with names above, **`pnpm install`**.  
2. Optional **`docker-compose.yml`** for **`@skribbl/web`** + **`@skribbl/server`** + proxy.  
3. **`gds-create-epics-and-stories`** (or equivalent) with GDD + this doc.  
4. Optional **`gds-generate-project-context`**.

---

_Workflow: GDS Game Architecture — complete. Revision 1.2: alignment pass._
