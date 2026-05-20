# Full deployment on [Render](https://render.com) — step-by-step plan

This guide deploys **skribbl** as **three Render resources**:

1. **Key Value** (managed **Redis**) — required by **`@skribbl/server`** via **`REDIS_URL`** (`ioredis`; see `apps/server/src/lib/redis/client.ts`).
2. **Web Service — game server** — **`@skribbl/server`** (HTTP **`/api/session`**, **`/healthz`**, **WebSockets**).
3. **Web Service — web app** — **`@skribbl/web`** (**Next.js** `next start`).

The frontend learns the game backend from **`NEXT_PUBLIC_WS_URL`**. **`/api/session`** is called over **HTTPS on the same host** as **`wss://`** (`wsUrlToHttpUrl` in `apps/web/src/features/lobby/lib/player-token.ts`).

**Before you start:** Render’s **free** Web Services **spin down after idle**. That breaks **always-on WebSockets** and **in-memory rooms**. For real multiplayer, use **paid** instances for at least **skribbl-server** (and usually **skribbl-web**). Steps below apply to either tier; caveats called out where it matters.

---

## Phase A — Repo and accounts

### Step A1 — Confirm the repo is ready

- Monorepo root has **`pnpm-lock.yaml`** so Render detects **pnpm** on install.
- Root **`package.json`** `engines.node` is **`>=24`**; match that on Render (see Step C1 / D1).

### Step A2 — Sign in and connect Git

- Log in to Render.
- **Account settings** → connect **GitHub** (or GitLab/Bitbucket) and authorize the **skribbl** repository.

### Step A3 — Create a Render **Project** (recommended)

- **+ New** → **Project** → name it (e.g. `skribbl`).
- You will attach all services and Redis to this project for one place to manage them.

---

## Phase B — Redis (Key Value)

### Step B1 — Create Key Value

- In the project: **+ New** → **Key Value** (managed Redis).
- Choose **region** (note it; keep **game server** in the **same region** later to cut latency).
- Finish creation and wait until **Available**.

### Step B2 — Connect Redis to the game server (you are here after B1)

On the Key Value dashboard (e.g. **skribbl-redis**):

1. Copy the **Internal Key Value URL** (Connections section), e.g. `redis://red-xxxxx:6379`.  
   - **Use this for `REDIS_URL`** when your **game Web Service** runs on Render in the **same account/region** — traffic stays on Render’s private network.  
   - **External Key Value URL** is often blocked until you add IPs under **Networking**; you do **not** need external access for **`skribbl-server`** on Render.
2. Optional: click **Connect** (top right) if Render offers a guided flow to attach this instance to a service.
3. You will **paste** this value in **Phase C → Step C4** as environment variable **`REDIS_URL`** once **`skribbl-server`** exists—or add it now if you create env before first deploy.

Do **not** put **`REDIS_URL`** on the Next.js service (see B3).

### Step B3 — Do **not** attach Redis env vars to the Next service

Only **`skribbl-server`** needs **`REDIS_URL`**.

**Next:** open **Phase C** — create the **`skribbl-server`** Web Service in the **same region** (e.g. Singapore), set **`REDIS_URL`** to your **Internal Key Value URL**, deploy, then verify **`/healthz`**. After that, continue with **Phase D** for Next.js.

---

## Phase C — Web Service: game server (`skribbl-server`)

### Step C1 — New Web Service from the repo

- **+ New** → **Web Service** → select repository and branch (**`main`** or your prod branch).

### Step C2 — Basic settings

| Field | Value |
| ----- | ----- |
| **Name** | `skribbl-server` (or similar) |
| **Region** | Same as Key Value |
| **Root directory** | *(leave empty)* — monorepo **repository root** so `data/words.json` and workspaces resolve |
| **Runtime** | Node |
| **Instance type** | **Paid recommended** for WebSockets; free is OK only for demos (sleep / cold starts) |
| **Build command** | `pnpm install --frozen-lockfile && pnpm --filter @skribbl/shared build` |
| **Start command** | `pnpm --filter @skribbl/server start` |

### Step C3 — Node version

- In **Environment**, set **`NODE_VERSION`** (or use Render’s Node version picker, if shown) to **`24`** or higher to satisfy root `engines`.

### Step C4 — Environment variables (game server)

Add at minimum:

| Key | Notes |
| --- | ----- |
| `REDIS_URL` | From Step B2 (linked or pasted). **Required** — boot fails without Redis. |
| `NODE_ENV` | `production` |
| `LOG_LEVEL` | Optional: `info` |

Optional:

| Key | Notes |
| --- | ----- |
| `CORS_ORIGIN` | Defaults to `*` in code; set to your **web** URL after you know it, e.g. `https://skribbl-web.onrender.com`. |
| `WORDS_PATH` | Only if not using default **`../../data/words.json`** relative to **`apps/server`**. |

**Do not override `PORT`** unless you know Render’s routing; **`PORT`** is set by Render — the server reads it in `resolvePort()`.

Leave **`HOST`** unset so `0.0.0.0` is used (`apps/server/src/index.ts`).

### Step C5 — Health check

- **Health check path:** `/healthz`
- Expected: HTTP **200** with JSON **`{"ok":true}`**.

### Step C6 — Deploy and verify

1. Click **Deploy** / save and trigger first deploy.
2. Wait for **Live**.
3. Open **`https://<skribbl-server-hostname>/healthz`** in the browser → must return **`{"ok":true}`**.
4. Copy the **HTTPS hostname** (e.g. `skribbl-server-xxxx.onrender.com`) — **no path**. You need it for **`NEXT_PUBLIC_WS_URL`**.

---

## Phase D — Web Service: Next app (`skribbl-web`)

**Run this phase only after** `skribbl-server` is live and **`/healthz`** works.

### Step D1 — New Web Service from the same repo

- **+ New** → **Web Service** → same repo/branch.

### Step D2 — Basic settings

| Field | Value |
| ----- | ----- |
| **Name** | `skribbl-web` |
| **Region** | Any; often same as server for ops simplicity |
| **Root directory** | *(empty)* |
| **Runtime** | Node |
| **Instance type** | Free tier acceptable for static-ish traffic; **sleep** still affects “always open site” |
| **Build command** | `pnpm install --frozen-lockfile && pnpm run build` |
| **Start command** | `pnpm --filter @skribbl/web start` |

### Step D3 — Node version

- Set **`NODE_VERSION`** to **`24`** (or match Step C3).

### Step D4 — Environment variables (critical for build)

**`NEXT_PUBLIC_WS_URL` must exist before `next build`.**

| Key | Example value |
| --- | ------------- |
| `NEXT_PUBLIC_WS_URL` | `wss://skribbl-server-xxxx.onrender.com` |

Rules:

- Use **`wss://`**, not **`ws://`**, because the web app is served over **HTTPS**.
- **No trailing slash or path** unless you intentionally path-prefix the socket (this app does not).
- Hostname must match the **game server** public URL from Step C6.

Also set:

| Key | Value |
| --- | ----- |
| `NODE_ENV` | `production` |

### Step D5 — Deploy and verify

1. Deploy the service.
2. Open the **web** URL Render shows (e.g. `https://skribbl-web-xxxx.onrender.com`).
3. Confirm the lobby does **not** show “real-time … not configured” (that means **`NEXT_PUBLIC_WS_URL`** was missing at build).
4. Start a room and confirm WebSocket connects (browser devtools → Network → WS).

### Step D6 — Tighten CORS (optional)

- On **`skribbl-server`**, set **`CORS_ORIGIN`** to your **`https://skribbl-web-….onrender.com`** URL.
- **Redeploy** the game server.

---

## Phase E — After first success

### Step E1 — Custom domains (optional)

- Render **Settings** → **Custom Domain** for **web** and/or **server** as needed.
- If the **game server hostname changes**, update **`NEXT_PUBLIC_WS_URL`** and **clear-cache redeploy** the **web** service (Next embeds **`NEXT_PUBLIC_*`** at **build** time).

### Step E2 — Scaling

- Keep **exactly one** game-server instance until you implement **room affinity** or shared room state (**see** [`deployment.md`](deployment.md)).
- Do **not** scale **`skribbl-server`** horizontally on free/paid blindly.

### Step E3 — Blueprint / IaC (optional)

- **+ New** → **Blueprint** to manage multiple services from **`render.yaml`** in the repo.
- When you adopt this, copy settings from Steps C–D into the blueprint and store secrets outside git. Verify current Render blueprint schema in [Render blueprint docs](https://render.com/docs/infrastructure-as-code).

---

## Quick reference — commands

```text
Game server — build:  pnpm install --frozen-lockfile && pnpm --filter @skribbl/shared build
Game server — start:   pnpm --filter @skribbl/server start

Web app — build:       pnpm install --frozen-lockfile && pnpm run build
Web app — start:       pnpm --filter @skribbl/web start
```

---

## Troubleshooting

| Problem | What to check |
| ------- | -------------- |
| Server crashes on startup | **`REDIS_URL`** wrong or unreachable; Redis in same usage tier / firewall as docs say. |
| “Real-time … not configured” on web | **`NEXT_PUBLIC_WS_URL`** unset during **build** → set and **Redeploy** Clear build cache optional. |
| Mixed content errors | **`NEXT_PUBLIC_WS_URL`** must be **`wss://`**, page is **`https`**. |
| Session fetch fails | **`/api/session`** is on **game server** host; **`wsUrlToHttpUrl`** must match (**same hostname** as `wss`). |
| Webs drop after silence | Idle spin-down (**free**) or LB timeout → upgrade instance or add **WS ping/pong** later on server. |
| Wrong words file | **`WORDS_PATH`** or confirm repo **`data/words.json`** present at deploy. |

---

## Related docs

- General architecture and scaling rules: [`docs/deployment.md`](deployment.md).
- Same stack on Railway: [`docs/deployment-railway.md`](deployment-railway.md).

Last updated: 2026-05-14.
