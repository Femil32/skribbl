# Skribbl (monorepo)

Real-time draw-and-guess: **Next.js** (`@skribbl/web`) + **Node WebSocket** game server (`@skribbl/server`), shared wire contracts in **`@skribbl/shared`** (Zod).

## Prereqs

- **Node 24+**
- **pnpm** 9+

## Install

```bash
pnpm install
pnpm --filter @skribbl/shared build
```

(`@skribbl/web` **prebuild** also rebuilds shared; root `pnpm typecheck` / `pnpm test` run a shared build first.)

## Dev (two processes)

Terminal A — game server (WebSocket + `/healthz`):

```bash
pnpm dev:server
# or: pnpm --filter @skribbl/server dev
```

Terminal B — web:

```bash
pnpm dev:web
# or: pnpm --filter @skribbl/web dev
```

**Split hosting:** set **`NEXT_PUBLIC_WS_URL`** in `apps/web` to the public WebSocket URL (e.g. `wss://ws.example.com`) when the WS host differs from the Next origin.

Optional demo ping from the browser: set `NEXT_PUBLIC_ENABLE_WS_DEMO=1` and `NEXT_PUBLIC_WS_URL` (dev only).

## Checks

```bash
pnpm typecheck   # all workspaces
pnpm test        # Vitest in shared + server
pnpm build       # shared build + Next production build
```

## Workspace filters

Use **`pnpm --filter @skribbl/<pkg> <cmd>`** for any package script, e.g. `pnpm --filter @skribbl/web lint`.

## Word list

Canonical file: **`data/words.json`** at repo root. Server loading via **`WORDS_PATH`** comes in later stories.
