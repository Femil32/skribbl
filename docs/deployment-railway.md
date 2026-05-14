# Deploying skribbl on [Railway](https://railway.com)

Railway fits this repo as **three pieces** in one Railway **project**:

1. **`skribbl-server`** — `@skribbl/server` (HTTP + **`/api/session`**, **`/healthz`**, WebSocket gameplay). **Always-on**.
2. **`skribbl-web`** — `@skribbl/web` (Next.js). **Always-on** for `next start`.
3. **Redis** — managed Redis that Railway can inject into the server as **`REDIS_URL`**. The server **starts only if Redis connects** (`ioredis` by default; see `apps/server/src/lib/redis/client.ts`).

The browser resolves the game backend from **`NEXT_PUBLIC_WS_URL`** and maps it to HTTPS for **`/api/session`** (see `apps/web/src/features/lobby/lib/player-token.ts` (`wsUrlToHttpUrl`). So **`NEXT_PUBLIC_WS_URL` must be the public WebSocket URL of the game-server service.**

---

## 1. Prerequisites

- GitHub repo connected to Railway (or Railway CLI deployed from git).
- **Node 24+** aligns with root `engines`. On each service set **`NODE_VERSION=24`** (or your platform’s equivalent) so install/build match local dev.

---

## 2. Create Redis

1. In the project, **New** → **Database** → **Redis**.
2. On the **`skribbl-server`** service (next section), add a **variable reference** (or Railway “connect” flow) so **`REDIS_URL`** is available at runtime.  
   - Default server code uses **`REDIS_PROVIDER=ioredis`** (or omit; default is `ioredis`) and **`REDIS_URL`**.

The web app **does not** need Redis variables.

---

## 3. Service: `skribbl-server` (game + WebSocket)

| Setting | Suggested value |
| ------- | ---------------- |
| **Root directory** | *(empty / repository root)* — stay at monorepo root so `data/words.json` and workspaces resolve. |
| **Build command** | `pnpm install --frozen-lockfile && pnpm --filter @skribbl/shared build` |
| **Start command** | `pnpm --filter @skribbl/server start` |
| **`PORT`** | Leave unset unless you need a fixed port; Railway sets **`PORT`** automatically—`resolvePort()` in the server reads it. |
| **`HOST`** | Omit (defaults to `0.0.0.0`; required for Railway’s router). |

**Variables**

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `REDIS_URL` | Yes | Injected when Redis is linked to this service. |
| `NODE_ENV` | Recommended | `production` |
| `LOG_LEVEL` | Optional | `info` |
| `CORS_ORIGIN` | Optional | Default is `*`; tighten to your web URL, e.g. `https://skribbl-web-production-xxxx.up.railway.app`. |
| `WORDS_PATH` | Optional | Defaults via package script relative path to `../../data/words.json` when started from `apps/server`. |

**Deploy first** so Railway assigns a stable **public URL**. You need that host for **`NEXT_PUBLIC_WS_URL`**.

**Smoke checks**

- `GET https://<server-host>/healthz` → `{"ok":true}`
- Confirm Redis: if Redis is missing/wrong URL, logs show startup failure (“Failed to start server — check Redis availability”).

Optional: configure Railway **health check path** → `/healthz` on this service.

---

## 4. Service: `skribbl-web` (Next.js)

| Setting | Suggested value |
| ------- | ---------------- |
| **Root directory** | *(repository root)* |
| **Build command** | `pnpm install --frozen-lockfile && pnpm run build` |
| **Start command** | `pnpm --filter @skribbl/web start` |

**Variables (build + runtime)**

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `NEXT_PUBLIC_WS_URL` | **Yes** | Must be present at **`next build`** time. Format: **`wss://<server-public-host>`** (no trailing path). Example: `wss://skribbl-server-production-xxxx.up.railway.app`. |
| `NODE_ENV` | Recommended | `production` |

Railway sets **`PORT`** for Node; **`next start`** listens on **`PORT`** by default—no change needed.

**Important:** Next.js embeds **`NEXT_PUBLIC_*`** at **build** time. If the game-server public URL changes, **redeploy the web service** after updating the variable.

---

## 5. Deploy order

1. Provision **Redis**.
2. Deploy **`skribbl-server`** and wait until it **serves `/healthz`**. Copy its **HTTPS** hostname.
3. Set **`NEXT_PUBLIC_WS_URL=wss://<that-hostname>`** on **`skribbl-web`** (same hostname as HTTPS, scheme **`wss`**).
4. Deploy **`skribbl-web`**.
5. (Optional) Set **`CORS_ORIGIN`** on the server to the web’s **`https://...`** URL.

---

## 6. Watch paths (optional)

Reduce noise from unrelated commits:

| Service | Watch paths idea |
| ------- | ---------------- |
| `skribbl-server` | `apps/server/**`, `packages/shared/**`, `data/words.json`, `pnpm-lock.yaml` |
| `skribbl-web` | `apps/web/**`, `packages/shared/**`, `pnpm-lock.yaml` |

Railway UI: Service → Settings → Watch Paths (if enabled for your workspace).

---

## 7. Common failures

| Symptom | Likely cause |
| ------- | ------------- |
| Web shows “real-time … not configured” | **`NEXT_PUBLIC_WS_URL`** missing at **build**, or typo. **Redeploy** web after fixing. |
| Mixed content errors | Page is **`https`** but **`NEXT_PUBLIC_WS_URL`** uses **`ws://`**. Use **`wss://`**. |
| `Session API returned 404/5xx` | **`/api/session`** is on the **game server**. `NEXT_PUBLIC_WS_URL` must match that same host (`wsUrlToHttpUrl`). |
| Server exits on boot | **`REDIS_URL`** missing/incorrect or Redis down. Fix link and redeploy. |
| WebSocket disconnects idle | Tune Railway/proxy timeouts or add **`ws` ping/pong** on the server (future hardening). |

---

## 8. Cost and scaling note

Treat **`skribbl-server`** as **one replica** unless you implement room affinity or shared room state (**see** [`docs/deployment.md`](deployment.md)); scaling replicas blindly breaks in-memory rooms. Redis here backs **sessions** (`/api/session`), not full room-sync across replicas.

---

## Related

- General topology and checklist: [`docs/deployment.md`](deployment.md).
- Prod stack rules: `_bmad-output/project-context.md`.

Last updated: 2026-05-14.
