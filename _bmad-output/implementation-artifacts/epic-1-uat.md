---
title: UAT Checklist — Epic 1
version: '1.0'
epic: Epic 1 — Session bootstrap (lobby, join, identity, roster, connection trust)
status: ready-for-test
owner: ''
reviewers:
  - QA
  - Dev
environment: local — two processes (Next `@skribbl/web` + `@skribbl/server`)
last_updated: '2026-04-29'
signoff_required_by: ''
---

## Scope

Manual user acceptance for **Epic 1** (stories **1.1–1.7**): monorepo/protocol foundation, authoritative rooms, host create + invite UX, guest join, nickname/avatar, live roster + host-only **Start**, and lobby connection trust surfaces. This checklist does **not** cover Epic 2+ match gameplay.

## How to use

- Mark **Pass / fail** per row. Block Epic 1 sign-off on any **P0** failure (critical path or security/authority break).
- Prefer **two browsers** (e.g. Chrome + Safari) for clipboard, WebSocket, and a11y spot checks.
- Attach **Notes** with PR link, screenshot, or bug ID on failure.
- **Traceability** at the end maps each story artifact to UAT row IDs.

---

## Prerequisites

| Item | Requirement |
|------|--------------|
| Node / pnpm | As in repo root `package.json`; `pnpm install` completed. |
| Web | `pnpm --filter @skribbl/web dev` (or repo root script). |
| Game server | `pnpm --filter @skribbl/server dev` (or equivalent) **before** relying on WS. |
| `NEXT_PUBLIC_WS_URL` | Set to your local WS origin (e.g. `ws://127.0.0.1:3001`). Wrong/missing URL must show **clear misconfiguration** messaging (story **1.4** / **1.7**) — not silent failure. |
| Build gate (1.1) | `pnpm -r exec tsc --noEmit` passes; `@skribbl/web` `build` succeeds when you need a release-like check. |

---

## Critical path — single spine (SMOKE-1)

Run **once** per session. Later story rows **add delta checks** on top of this path; do not repeat “create room” seven times.

| Step | Actor | Action | Expected |
|------|--------|--------|----------|
| 1 | Tester | Start game server + web app; open app in **Browser A** (host). | Home loads; no console errors from missing env if `NEXT_PUBLIC_WS_URL` is set. |
| 2 | Host | Enter nickname + avatar; **Create room** (or equivalent). | WS connects; transition to host lobby; **room code** + **invite URL** visible and readable ( monospace / contrast ) — **1.3**. |
| 3 | Host | **Copy link** and **Copy code**; observe feedback. | Clipboard contains correct strings; **short non-blocking success** (toast or equivalent); no stack traces (**1.3**). |
| 4 | Guest | Open **Copied link** in **Browser B** (or paste code on `/join`). | Code field normalized; **Join** reaches post-join lobby; **player count** and identity echo — **1.4**, **1.5**. |
| 5 | Both | Confirm **live roster** updates; host row shows **host badge**; guest sees no misleading primary **Start**. | Roster lists `playerId`, names, avatars, `isHost`; deterministic order — **1.6**. |
| 6 | Host | With **≥2** players, click **Start**. | Server accepts; phase / event indicates match handoff (per implementation); join-after-start blocked with stable **`JOIN_NOT_ALLOWED`** if retested — **1.6**. |
| 7 | Either | Observe **connection banner** through connect → live; optionally trigger disconnect (kill server briefly or go offline). | States are **labeled** (connecting / live / reconnecting / disconnected); post-join disconnect is **not** silent; **Retry** or guidance where applicable — **1.7**. |

---

## Test matrix

Use columns: **Precondition** · **Steps** · **Expected** · **Pass/Fail** · **Notes**.

### Story 1.1 — Scaffold, shared protocol, healthz

| ID | Precondition | Steps | Expected | Pass/Fail | Notes |
|----|---------------|-------|----------|-----------|-------|
| E1-UAT-001 | Server running | `GET` game server **`/healthz`** (browser or curl). | **200** with probe-friendly body (OK). | |
| E1-UAT-002 | Dev machine | Run root TypeScript gate: `pnpm -r exec tsc --noEmit`. | No emit errors across workspaces (**1.1** AC2). | |
| E1-UAT-003 | Optional | Bad WS payload / unknown command (devtools or test client). | Structured **`error`** with stable **`code`**, server stays up (**1.1**). | |

### Story 1.2 — Authoritative rooms, secure codes

| ID | Precondition | Steps | Expected | Pass/Fail | Notes |
|----|---------------|-------|----------|-----------|-------|
| E1-UAT-010 | WS up | Guest sends **joinRoom** with **nonsense code** after connect. | **`error`** with stable code (e.g. `UNKNOWN_ROOM`); **no stack trace** on wire. | |
| E1-UAT-011 | Room near capacity | Fill room to **`MAX_PLAYERS`** (default 8); another client joins. | **`ROOM_FULL`** (or documented equivalent); recoverable messaging. | |
| E1-UAT-012 | After **SMOKE-1** | Inspect emitted **room codes** across several creates (devtools / logs / UI). | Codes are **non-sequential**, alphanumeric; not guessable (**crypto-grade** policy). | |

### Story 1.3 — Shareable link & copy feedback

| ID | Precondition | Steps | Expected | Pass/Fail | Notes |
|----|---------------|-------|----------|-----------|-------|
| E1-UAT-020 | Host in lobby (**SMOKE-1** step 2–3) | Read invite URL + code on screen; compare to `buildRoomInviteUrl` behavior. | Full URL includes origin; code matches server; readable styling (**1.3** AC1). | |
| E1-UAT-021 | Same | Copy link + copy code success path. | Success toast/non-blocking indicator; **`aria-live`** polite or toast region (**1.3** AC2, UX-DR11). | |
| E1-UAT-022 | Browser without clipboard permission OR simulate denial | Trigger copy where `writeText` fails. | Inline recoverable message; neutral copy (**1.3** AC3). | |
| E1-UAT-023 | Break WS before `roomCreated` | Simulate create failure / transport error. | Inline/stable messaging near CTA; maps server **`error.code`** — not raw exceptions (**1.3** AC4). | |

### Story 1.4 — Paste-friendly join

| ID | Precondition | Steps | Expected | Pass/Fail | Notes |
|----|---------------|-------|----------|-----------|-------|
| E1-UAT-030 | Fresh guest | Paste code with **spaces/separators/mixed case**; submit. | Normalized consistently; **`roomJoined`** or clear preflight (**1.4** AC1). | |
| E1-UAT-031 | Invalid code | Submit malformed code (wrong length after normalize). | Inline error; **`BAD_CODE`** copy explains format **without blaming** user (**1.4** AC3). | |
| E1-UAT-032 | `UNKNOWN_ROOM` / `ROOM_FULL` | Force those server responses (wrong code / full room). | Inline next to field; **`aria-describedby`** / `role="alert"` on error region (**1.4** AC2). | |
| E1-UAT-033 | `NEXT_PUBLIC_WS_URL` unset | Open join (or host) with missing URL per team procedure. | **Clear configuration error**, consistent with host flow (**1.4** AC6). | |

### Story 1.5 — Lobby identity

| ID | Precondition | Steps | Expected | Pass/Fail | Notes |
|----|---------------|-------|----------|-----------|-------|
| E1-UAT-040 | Host/guest forms | Submit **empty** nickname / overlong / suspicious string (`<script>`). | Server sanitization; **`error`** with stable codes; UI maps codes; field **`aria-invalid`** (**1.5** AC2–3). | |
| E1-UAT-041 | Avatar presets | Pick from allow-list only. | Unknown preset rejected server-side; UI uses **buttons**/`aria-pressed` as implemented (**1.5** AC4). | |
| E1-UAT-042 | **SMOKE-1** | After join/create ack | `roomCreated` / `roomJoined` includes **`playerId`**, sanitized name, **`avatarPresetId`** (**1.5** AC6). | |

### Story 1.6 — Roster, host badge, start gate

| ID | Precondition | Steps | Expected | Pass/Fail | Notes |
|----|---------------|-------|----------|-----------|-------|
| E1-UAT-050 | **≥2** clients in lobby | Third client joins; one leaves. | Everyone sees **roster update** without full refresh (**1.6** AC4,6). | |
| E1-UAT-051 | Host | **Start** with **one** player only. | Error (e.g. `NOT_ENOUGH_PLAYERS`); phase unchanged (**1.6** AC2). | |
| E1-UAT-052 | Guest | Guest sends **startMatch** (if exercisable via devtools or future UI). | **`NOT_HOST`** or equivalent (**1.6** AC3). | |
| E1-UAT-053 | Host vs guest UI | Compare **Start** CTA visibility. | Host sees primary Start when rules pass; guests **no deceptive** primary Start (**1.6** AC5). | |
| E1-UAT-054 | After successful start | New client tries **`joinRoom`**. | **`JOIN_NOT_ALLOWED`** (or doc’d code); inline mapping in `protocol-error-message` (**1.6** AC8). | |

### Story 1.7 — Connection trust banner

| ID | Precondition | Steps | Expected | Pass/Fail | Notes |
|----|---------------|-------|----------|-----------|-------|
| E1-UAT-060 | Lobby | During connect / live / reconnect, read banner copy. | **Honest labels** — not unnamed infinite spinner (**1.7** AC1). | |
| E1-UAT-061 | Pre-join failure | Wrong URL / server down / generic network fault. | Distinguishable copy; **`role="alert"`** only for **blocking** states (**1.7** AC2). | |
| E1-UAT-062 | Post-join (**SMOKE-1** done) | Drop WS (kill server). | Lobby shows **disconnected / reconnect** mode + affordances — **not** silent stale roster (**1.7** AC3). | |
| E1-UAT-063 | Retry | Use **Retry** after disconnect. | **Reconnecting** copy differs from first-time **connecting** (**1.7** AC4). | |

### Cross-cutting — two-browser & a11y (Epic 1)

| ID | Precondition | Steps | Expected | Pass/Fail | Notes |
|----|---------------|-------|----------|-----------|-------|
| E1-UAT-070 | Browsers A + B | Copy invite in A → open in B; complete join | Correct room; errors if stale/wrong (**Sally**: highest-risk clipboard path). | |
| E1-UAT-071 | Keyboard only | Tab through lobby forms and actions | Visible focus; logical order; **Enter** submits; no trap (**Sally**). | |
| E1-UAT-072 | Screen reader spot-check | Announce connection banner + form errors | Live regions / alerts match severity; banner states named in text (**Sally**). | |

---

## Sign-off

| Role | Name | Date | Approved (Y/N) |
|------|------|------|----------------|
| Tester | | | |
| Product / PM | | | |

---

## Traceability — Epic 1 stories

| Story | Artifact | Covered by (minimum) |
|-------|----------|---------------------|
| 1-1 | [`1-1-scaffold-monorepo-shared-protocol-package.md`](1-1-scaffold-monorepo-shared-protocol-package.md) | E1-UAT-001 — E1-UAT-003 |
| 1-2 | [`1-2-authoritative-rooms-secure-codes-on-the-server.md`](1-2-authoritative-rooms-secure-codes-on-the-server.md) | E1-UAT-010 — E1-UAT-012 |
| 1-3 | [`1-3-create-flow-ux-shareable-link-copy-feedback.md`](1-3-create-flow-ux-shareable-link-copy-feedback.md) | SMOKE-1 + E1-UAT-020 — E1-UAT-023 |
| 1-4 | [`1-4-join-flow-ux-paste-friendly-code-entry.md`](1-4-join-flow-ux-paste-friendly-code-entry.md) | SMOKE-1 + E1-UAT-030 — E1-UAT-033 |
| 1-5 | [`1-5-lobby-identity-nickname-avatar-presets.md`](1-5-lobby-identity-nickname-avatar-presets.md) | E1-UAT-040 — E1-UAT-042 |
| 1-6 | [`1-6-live-roster-host-badge-start-gate.md`](1-6-live-roster-host-badge-start-gate.md) | SMOKE-1 + E1-UAT-050 — E1-UAT-054 |
| 1-7 | [`1-7-connection-trust-banner-during-lobby-states.md`](1-7-connection-trust-banner-during-lobby-states.md) | E1-UAT-060 — E1-UAT-063 |

### Repo pointers

| Area | Path |
|------|------|
| Web | `apps/web/` |
| Server | `apps/server/` |
| Shared protocol | `packages/shared/` |

---

**Orchestrator note:** 📋 John’s **single spine + deltas** is reflected in **SMOKE-1** plus story-specific rows. 🎨 Sally’s clipboard, banner live-region, and two-browser scenarios are folded into **1.3**, **1.7**, and **E1-UAT-070 — E1-UAT-072**. 📚 Paige’s **ID prefix** (`E1-UAT-###`) and traceability footer are included for auditability.
