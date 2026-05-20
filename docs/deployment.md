# Deployment guide — skribbl

This document summarizes **deployment conclusions** from architecture, implementation, product, and business perspectives, and captures **operational guidance** for the **pnpm** monorepo: **`@skribbl/web`** (Next.js), **`@skribbl/server`** (authoritative Node **`ws`**), **`@skribbl/shared`** (Zod wire contracts). See also `_bmad-output/project-context.md` and `_bmad-output/game-architecture.md` for authoritative implementation rules.

---

## Conclusion

**Ship MVP as two always-on deployables** (Next + game server), **colocated or split by host** only when you need isolation or scale. The **authoritative WebSocket process must not be treated as serverless**; **in-memory rooms** imply **one active game-server replica** until you add **room affinity** or **shared state** (for example Redis/DB). Put a **CDN in front of Next** for static assets; **do not** cache WebSocket upgrades. **Proxy/LB idle timeouts** must allow long-lived draws (or use **ping/pong**). Expose **`GET /healthz`** on the game server. **Product success** is defined by **perceived sync**, **predictable reconnect**, and **clear failure UX**—not by premature multi-region or microservices. **Business readiness** means documented **TCO envelope**, **honest uptime story**, **geo/regulatory assumptions**, and a **spike scenario** (concurrent rooms/sockets) before betting on vendor or topology.

---

## Target topology (MVP)

| Piece | Package | Role |
| ----- | ------- | ---- |
| Web UI | `@skribbl/web` | Next.js App Router; client uses `NEXT_PUBLIC_WS_URL` when WS origin ≠ page origin. |
| Game server | `@skribbl/server` | Long-lived Node **`ws`**; authoritative room/match state (MVP: in-memory). |
| Contracts | `@skribbl/shared` | Build-time dependency; **single** source for Zod schemas and types. |

**Baseline:** two processes behind a reverse proxy or load balancer, or **split hosts** with `wss://` on the socket service and **`NEXT_PUBLIC_WS_URL`** baked into the web build.

**Anti-pattern for MVP:** multiple game-server replicas **without** sticky routing / room sharding / shared state—players will see **split-brain** rooms.

---

## Environment variables

| Variable | Where | Purpose |
| -------- | ----- | ------- |
| `NEXT_PUBLIC_WS_URL` | Web **build** | Public WebSocket base (`wss://…` in production). Wrong value → silent client connection failures. |
| `NODE_ENV` | Both | `production` in prod. |
| `PORT` / `HOST` | Server | Listen address (per platform). |
| `WORDS_PATH` | Server | Optional override for word list; default expectation: `data/words.json` at repo root (see server `package.json` scripts). |
| `LOG_LEVEL` | Server | e.g. `info` prod, `debug` staging (**pino**). |
| `REDIS_URL` | Server | Required at runtime: **`ioredis`** TCP URL (omit `REDIS_PROVIDER` or set `ioredis`). See Upstash envs only if `REDIS_PROVIDER=upstash`. |

Secrets and rate limits belong on the **server** only—never in `NEXT_PUBLIC_*`.

**Redis:** The game server expects a working Redis (**`REDIS_URL`**, default provider `ioredis`). See [`docs/deployment-railway.md`](deployment-railway.md) or [`docs/deployment-render.md`](deployment-render.md) (Render Key Value).

---

## Platform guides

- **Railway:** step-by-step **two services + Redis** → [`docs/deployment-railway.md`](deployment-railway.md).
- **Render:** full **Key Value + two Web Services** walkthrough → [`docs/deployment-render.md`](deployment-render.md).

---

## Health and observability

- **Liveness:** `GET /healthz` on **`@skribbl/server`** for orchestrators and uptime checks.
- **Logs:** **`pino`** JSON to **stdout** in containers; correlate with `roomId` / connection id where useful; avoid PII by default.
- **Metrics:** connection/join/disconnect counters and error codes beat heavy tracing early on.

---

## Reverse proxy / PaaS (WebSockets)

Configure the edge or load balancer so that:

1. **`Connection`, `Upgrade`, `Sec-WebSocket-*`** headers are forwarded for `wss`.
2. **Idle / read timeouts** exceed worst-case silent draw periods, **or** the server sends **WS ping/pong**.
3. **TLS** terminates at the edge; the game server receives upgraded connections as expected.

If you run **more than one** WS instance: **sticky sessions** or **room-based routing** is required **before** horizontally scaling the game server.

---

## CI and release verification

Suggested gates before calling a release deployable:

1. **`pnpm`** install with **frozen lockfile** in CI.
2. **`pnpm run build`** at repo root (builds shared + web per root `package.json`; extend CI if **`@skribbl/server`** gains a compile/bundle step).
3. **`pnpm run typecheck`** and **`pnpm run test`** green on `main`/PR branches.
4. **Staging smoke:** web built with staging **`NEXT_PUBLIC_WS_URL`**; **browser E2E** opens lobby and completes a **real** WS handshake (prefer not mocking the socket).
5. **Post-deploy:** `curl` `/healthz` on the game service; manual or automated smoke URL.

Treat **`NEXT_PUBLIC_WS_URL`** documentation and correctness as acceptance criteria—not an afterthought.

---

## Scaling path (when to change shape)

1. **Phase 1:** Single Next + single game-server process (or two small containers on one LB); in-memory rooms; restarts may clear rooms—**communicate honestly** in product copy if needed.
2. **Phase 2:** Split processes/deploy units; tune **autoscaler for web** first (static/UI traffic).
3. **Phase 3:** Multiple game-server instances **only with** explicit **room routing**, **sticky affinity**, or **durable/shared** room state—not ad-hoc replicas.

Add **PostgreSQL / Redis / message bus** when **survival across restarts** or **multi-instance WS** becomes a requirement—not by default.

---

## Product checkpoints

- Define **what “good enough” means** for the first real sessions: e.g. reconnect success vs stroke latency vs round completion—then protect that in infra and UX.
- **Reconnect and resync** are MVP-grade promises; durable full history and multi-region defaults can wait until validated traction.
- **Degraded WS** behavior should be understandable to players (avoid silent hangs).

---

## Business and compliance checkpoints

- **TCO:** separate fixed monthly baseline from variable costs (connections, egress, scale events).
- **SLA narrative:** distinguish vendor SLA from **what players feel** during incidents.
- **Geo / regulation:** document data flows (logs, chat, IPs), audience (minors?), and jurisdictions—escalate legal review when scope grows.
- **Spike assumptions:** write down concurrent rooms, concurrent sockets, join bursts—engineering maps caps and graceful degradation (room caps, queues, messaging).

---

## Related paths in this repo

- `apps/web` — Next app (`next build` / `next start`).
- `apps/server` — game server (`node`/`tsx` entry; verify production start command matches your hosting).
- `packages/shared` — wire schemas (**edit here only** for protocol shapes).
- `data/words.json` — canonical word list (override with **`WORDS_PATH`**).

Last updated: 2026-05-14 (deployment guide + Railway addendum).
