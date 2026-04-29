# Story 1.3: Create-flow UX — shareable link & copy feedback

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a host,
I want a visible invite URL/code I can copy with confirmation,
so that friends join quickly (FR1, UX-DR11 partial).

## Acceptance Criteria

1. **Given** a WebSocket-connected client that has received **`roomCreated`** from the server **when** the host reaches the post-create **lobby** view **then** both a **full invite URL** (including origin) and the **room code** are visible and readable (e.g. monospace / sufficient contrast).
2. **Given** the lobby view **when** the host activates **Copy link** or **Copy code** **then** the correct string is written to the clipboard **and** a **short, non-blocking success** indicator appears (DaisyUI **`toast`** or equivalent — aligns with UX spec Feedback Patterns and UX-DR11).
3. **Given** clipboard write is denied or unavailable (`Permissions` / `NotAllowedError` / non-secure context) **when** copy is requested **then** a **recoverable inline** message explains the failure with neutral copy (**no** stack traces, **no** blaming the player — NFR-O1).
4. **Given** room creation or transport errors before the lobby **when** the UI surfaces them **then** messaging is **inline** (e.g. `alert` / banner adjacent to the action), stable wording, and consistent with structured **`error`** events from the wire (**`code`** / optional `message`) — not raw exception text.

## Tasks / Subtasks

- [x] **Routing & invite URL contract** (AC: 1, 4)
  - [x] Define a single helper (e.g. `buildRoomInviteUrl(roomCode: string): string`) that produces `{origin}/join?code={encodeURIComponent(code)}` (or team-chosen path that **must** stay stable for Story **1.4**). Prefer reading public base from `window.location.origin` on the client; if split deploy needs a fixed web origin, support optional **`NEXT_PUBLIC_APP_URL`** (trim trailing slash) — document in Dev Notes.
  - [x] Add **`app/join/page.tsx`** minimal shell: reads **`code`** from `searchParams`, normalizes display consistent with server (**uppercase alphanumeric** — same spirit as `normalizeRoomCode` in `@skribbl/server`) so invite links are not ugly-only. **Scope for 1.3:** show code + instructions; **do not** implement full **`joinRoom`** UX, nickname, or roster (Stories **1.4–1.6**).
- [x] **Feature structure** (AC: 1–4)
  - [x] Implement create → connect → `createRoom` → wait for **`roomCreated`** under **`apps/web/src/features/lobby/*`** per architecture; keep **`page.tsx`** routes thin (compose feature modules).
  - [x] Open **`NEXT_PUBLIC_WS_URL`** (required when exercising create flow locally); on `open`, send **`createRoom`** via **`clientCommandSchema`** / `serialize`-equivalent pattern — **parse inbound** with **`safeParseServerEvent`** (or `parseServerEvent` behind try/catch) and demux by **`type`** (exhaustive or clearly typed narrow casts after parse).
- [x] **Lobby UI** (AC: 1–3)
  - [x] DaisyUI: **`card`** for lobby panel; **primary** outline/ghost **Copy link** / **Copy code** per UX table (Secondary actions — `ux-design-specification.md` §Component Strategy).
  - [x] Success: **`toast`** (or `alert success` + auto-dismiss) for copy success; ensure **keyboard** operable buttons and **`aria-live="polite"`** (or toast region) for screen reader acknowledgement — UX-DR11.
  - [x] Failure: inline **`alert`** for copy failure; connection errors near **Create room** CTA.
- [x] **State & lifecycle** (AC: 4)
  - [x] Handle **`error`** events from server: map known **`code`**s to human strings where helpful; fallback generic recoverable message (NFR-O1).
  - [x] Clean up **WebSocket** on unmount / navigation (close socket, clear timers).
- [x] **Home / entry** (AC: 1–4)
  - [x] Replace disabled **Create room (soon)** on **`app/page.tsx`** with real navigation or embedded flow entry that reaches the create + lobby experience (keep **`ComponentWsPingDemo`** only if still useful for dev; avoid duplicate WS in production path).
- [x] **Tests / verification** (AC: 1–4)
  - [x] Pure helpers (invite URL, normalization) → **Vitest** in **`@skribbl/web`** if you add a test runner there, or colocate small unit tests per package convention; otherwise document manual **checklist** and run **`pnpm --filter @skribbl/web typecheck`** + **`pnpm --filter @skribbl/web build`**.
  - [x] **`pnpm -r exec tsc --noEmit`** passes; no new protocol duplicates outside **`@skribbl/shared`**.

## Dev Notes

### Architecture compliance

- **Wire protocol:** Only **`@skribbl/shared`** defines commands/events; use existing **`createRoom`** and **`roomCreated`** shapes (`roomId`, `roomCode`, `phase: 'lobby'`).
- **Client transport:** Single WS listener demuxed by **`type`**; align with **`game-architecture.md`** — API / realtime pattern and “Client event reducer” guidance.
- **Two processes:** Connect from the browser to **`NEXT_PUBLIC_WS_URL`**; do not embed game server in Next.
- **Lobby system location:** `apps/web/src/features/lobby/*` for lobby/create UX; **`join` route** under **`app/join/`** ([Source: `game-architecture.md` — Project Structure, System location mapping]).

### File structure (must create or align)

| Area | Path |
|------|------|
| Lobby feature | `apps/web/src/features/lobby/` — hooks, components (`PascalCase.tsx`), `kebab-case` for non-components |
| WS helpers | Extend `apps/web/src/lib/ws-client.ts` or add `apps/web/src/lib/game-socket.ts` if clearer |
| Invite URL | `apps/web/src/lib/invite-url.ts` (or under `features/lobby/`) |
| Routes | `apps/web/src/app/page.tsx` (entry), `apps/web/src/app/lobby/page.tsx` (if separate route) or equivalent |
| Join stub | `apps/web/src/app/join/page.tsx` |

Exact route split (`/` + client-only lobby vs `/lobby`) is **implementer choice** as long as ACs hold and **`buildRoomInviteUrl`** stays stable for Story **1.4**.

### Technical requirements (guardrails)

- **Discriminant:** JSON field **`type`** only — no parallel enums in app code.
- **Clipboard:** Prefer **`navigator.clipboard.writeText`**; guard with **feature detection** and **`catch`** for permission errors — inline recovery (NFR-O1).
- **Security:** Clipboard API requires **secure context** in most browsers — document local dev uses **`http://localhost`** or HTTPS.
- **Dependency budget:** No new UI libraries; **Tailwind + DaisyUI** only.

### Testing requirements

- **Typecheck / build:** `pnpm --filter @skribbl/web typecheck` and `build`.
- **Playwright:** Optional smoke for “create → see code” in a later hardening story; not mandatory for **1.3** if not yet scaffolded — note in Dev Agent Record if skipped.

### UX / product

- **DaisyUI:** `toast` for transient copy success; `alert` for errors — [Source: `ux-design-specification.md` — Component Strategy table].
- **Tone:** Neutral, actionable — never blame the player for infrastructure (UX principles §Global rules).
- **Defer:** Nickname/avatar (**1.5**), paste-friendly join + **`joinRoom`** (**1.4**), live roster (**1.6**).

### Cross-story context (Epic 1)

- **Depends on:** **1.2** — `createRoom` / `roomCreated` / error codes / normalized codes.
- **Unlocks:** **1.4** — join UX consumes **`/join?code=`** and **`joinRoom`**; **1.5** identity on top of lobby.
- **Do not** weaken server authority or add Mongo/ORM.

### Previous story intelligence

From [`1-2-authoritative-rooms-secure-codes-on-the-server.md`](1-2-authoritative-rooms-secure-codes-on-the-server.md):

- Server emits **`roomCreated`** with **`roomCode`** (canonical charset excludes ambiguous glyphs; client should display as returned).
- Errors use **`type: 'error'`** with stable **`code`** (`BAD_PAYLOAD`, `INTERNAL`, `UNKNOWN_ROOM`, `ROOM_FULL`, `BAD_CODE`, etc.).
- **Review follow-ups from 1.2:** payload size limits and safe `send` — client should not send huge messages; respect server expectations.
- Rebuild **`@skribbl/shared`** after schema changes (none expected for **1.3** unless a small helper export is added — prefer keeping schemas unchanged).

### Git intelligence

- Recent commits: monorepo bootstrap (**1.1**) and authoritative rooms (**1.2**). Web stack is **Next 16 App Router**, minimal **`features/`** tree — **1.3** establishes first real **`features/lobby`** usage.

### Latest technical specifics

- **Stack pins:** Next **16.2.4**, React **19.2.5**, **ws 8.20.0**, **Zod 4.3.6**, Node **24.x** ([Source: `_bmad-output/project-context.md`]). Re-verify before release.

### Project Context Rules

From `_bmad-output/project-context.md` — **must follow**:

- **Parse all wire JSON through `@skribbl/shared`**; invalid inbound → treat as connection/protocol error with user-safe messaging.
- **Naming:** `kebab-case` dirs, **`PascalCase.tsx`** components, **`camelCase`** functions.
- **Do not** add Socket.io; **do not** duplicate schemas in apps.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.3]
- [Source: `_bmad-output/planning-artifacts/epics.md` — FR1, NFR-O1, UX-DR11]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Session bootstrap, Component Strategy]
- [Source: `_bmad-output/game-architecture.md` — Client stack, Project structure, Error handling, System location mapping]
- [Source: `_bmad-output/project-context.md` — Rules and stack]
- [Source: `packages/shared/src/schemas.ts` — `createRoom`, `roomCreated`]
- [Source: `_bmad-output/implementation-artifacts/1-2-authoritative-rooms-secure-codes-on-the-server.md` — implemented server patterns]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes

- Implemented stable invite URLs via `buildRoomInviteUrl` + optional `NEXT_PUBLIC_APP_URL`; join stub at `/join?code=`.
- Host flow: `/lobby` opens WS to `NEXT_PUBLIC_WS_URL`, sends validated `createRoom` (`serializeClientCommand` / `serializeCreateRoomCommand` in `ws-client`), parses inbound with `safeParseServerEvent`, shows DaisyUI card + copy actions with toast success and inline clipboard recovery (NFR-O1).
- Added `serializeClientCommand` in `@skribbl/shared` with Vitest round-trip coverage; web Vitest for `invite-url` helpers.
- Playwright smoke deferred per story (not scaffolded yet).

### File List

- `packages/shared/src/schemas.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/schemas.test.ts`
- `apps/web/package.json`
- `apps/web/vitest.config.ts`
- `apps/web/src/lib/invite-url.ts`
- `apps/web/src/lib/invite-url.test.ts`
- `apps/web/src/lib/ws-client.ts`
- `apps/web/src/features/lobby/lib/protocol-error-message.ts`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/lobby/page.tsx`
- `apps/web/src/app/join/page.tsx`
- `apps/web/src/app/page.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Saved questions / clarifications (optional follow-up)

- Whether **`NEXT_PUBLIC_APP_URL`** is required for preview/staging where `window.location.origin` must differ from prod WS pairing — set in Story 1.3 only if needed.
- Exact canonical path: **`/join`** vs **`/r/`** — pick one and keep for **1.4**.

## Change Log

- 2026-04-29 — Story context generated (`gds-create-story`, user request: epic 1 story 1-3).
- 2026-04-29 — Implemented create-flow lobby UX, `/join` stub, shared `serializeClientCommand`, Vitest on web; status → review.
