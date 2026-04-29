# Story 1.7: Connection trust banner during lobby states

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As any participant,
I want clear realtime connection status while waiting in the lobby,
so that I know whether to retry networking fixes (UX-DR9 partial, NFR-O1).

## Acceptance Criteria

1. **Given** the lobby WebSocket lifecycle (connecting → open → messaging) **when** the client is waiting in the **host** or **guest** lobby **then** the UI surfaces a **connection trust** surface (banner or equivalent strip) that reflects at least: **connecting**, **connected/live**, and **recovering** (reconnect in progress) where applicable — not an infinite unnamed spinner (UX: “honest labels,” [Source: `ux-design-specification.md` — Journey / Feedback patterns]).
2. **Given** a transport-level failure before the room is joined (no `roomCreated` / `roomJoined` yet) **when** **`error`** / **`close`** / missing **`NEXT_PUBLIC_WS_URL`** occurs **then** copy is specific enough to distinguish **misconfiguration** (no WS URL), **blocked/unreachable server**, and **generic network** failure without blaming the player; **`role="alert"`** for **blocking** states that prevent play (UX-DR9 partial, Feedback patterns **`alert`** for errors).
3. **Given** the player **has** reached lobby (`roomCreated` / `roomJoined` acknowledged) **when** the WebSocket **`close`**s or **`error`**s **then** the UI **does not** silently stay on a live roster — it transitions to a **disconnected/waiting to reconnect** mode with visible copy + **recovery affordances** (e.g. Retry / reload guidance) consistent with ConnectionBanner semantics [Source: `ux-design-specification.md` — **ConnectionBanner**].
4. **Given** intentional **reconnect** (user retries or automated retry) **when** a new socket is attempted **then** users see **differentiated** “reconnecting” vs **first-time** connecting copy (may reuse the same component with a `variant` or `reason` prop).
5. **NFR-O1:** No stack traces or internal exception text in user-facing strings; messages stay neutral and actionable.
6. **Scope boundary:** Implement for **lobby surfaces** only in this story — **`LobbyHostPage`** and **guest join** (`JoinRoomClient` / `use-guest-join-room`). **Do not** implement the full match-shell ConnectionBanner for drawing/chat here (that remains aligned with Epic **3** / UX Phase 1 roadmap); avoid duplicating future **Epic 6.2** global error-boundary work — lobby banner can be a **feature-local** component reusable later.

## Tasks / Subtasks

- [x] **Connection state model** (AC: 1–4)
  - [x] Extend **`use-host-create-room`** / **`use-guest-join-room`** (or extract a tiny shared helper) so connection phases are explicit: e.g. `transport: "idle" | "connecting" | "live" | "reconnecting" | "disconnected" | "blocked" | "fatal"` — exact enum is your choice but must cover AC1–4 and **post-join disconnect** (currently **`close`** handlers **ignore** disconnect after lobby — see Dev Notes).
  - [x] Ensure **one** user-visible banner region per lobby view driven by that model (avoid duplicate messages from page + hook).
- [x] **`ConnectionBanner` UI** (AC: 1–3, 5)
  - [x] New component under `apps/web/src/features/lobby/components/` (e.g. **`LobbyConnectionBanner.tsx`**) implementing UX **ConnectionBanner** anatomy: sticky strip, variants for **reconnecting**, **blocked/misconfiguration**, **offline**, **non-blocking info** if needed [Source: `ux-design-specification.md` — ConnectionBanner].
  - [x] **Tailwind + DaisyUI** only; semantic tokens (warning/error) — **color + text**, not color-only (align with roster a11y from 1.6).
  - [x] **`role="alert"`** only when the failure is **blocking** (cannot proceed / must act); connecting/reconnecting may use **`role="status"`** or live region **polite** — match UX “blocking errors” table.
  - [x] Primary **Retry** only where it is the single decisive action (Button Hierarchy); secondary actions for “Copy diagnostic” / “Check network” stay tertiary.
- [x] **Wire into pages** (AC: 1–4)
  - [x] **`LobbyHostPage`**: render banner for all relevant `HostLobbyState` branches including **`connecting`**, **`error`**, and **lobby + disconnected** substate.
  - [x] **`JoinRoomClient`**: same for guest states; preserve existing form validation and protocol error mapping.
- [x] **Tests**
  - [x] **Vitest/React Testing Library** (or existing web test stack): unit tests for **`LobbyConnectionBanner`** — variants + a11y roles.
  - [x] If feasible without flakiness: exercise hook state transitions with a **mock WebSocket** (or extract pure **reducers** for testability).
  - [x] Run: `pnpm --filter @skribbl/web test`, `pnpm -r exec tsc --noEmit`, `pnpm --filter @skribbl/web build`.

## Dev Notes

### Architecture compliance

- **Wire:** Host lobby reconnect uses **`reconnectHost`** in **`@skribbl/shared`** (with server handler); other transport UX stays in **`apps/web`**. If you add ping/pong visibility or connection metadata later, keep types in **`@skribbl/shared`** only.
- **Single WebSocket** per lobby flow remains; banner reflects **browser `WebSocket`** `readyState` + lifecycle, not duplicate polls.
- **Align** with [Source: `game-architecture.md` — Client connection states] `connecting | live | reconnecting` vocabulary in naming/docs.

### File structure (create / touch)

| Area | Path |
|------|------|
| Banner | `apps/web/src/features/lobby/components/LobbyConnectionBanner.tsx` (name may vary; keep **PascalCase**) |
| Hooks | `apps/web/src/features/lobby/hooks/use-host-create-room.ts`, `use-guest-join-room.ts` |
| Pages | `apps/web/src/features/lobby/components/LobbyHostPage.tsx`, `apps/web/src/app/join/JoinRoomClient.tsx` |
| URL helper | `apps/web/src/lib/game-ws-url.ts` (only if centralizing “missing URL” / dev default messaging) |

### Technical requirements (guardrails)

- **Gap to fix:** In both hooks, **`close`** currently **returns early** when `reachedLobbyRef.current` is true — so **disconnect after join** is **silent**. Story **1.7** must surface this (AC3).
- **Differentiation:** Browsers rarely expose “WebSocket blocked by extension” directly; use **practical buckets**: (a) missing **`NEXT_PUBLIC_WS_URL`** in production, (b) **`open` never fires** + `error` → likely **server down / mixed content / blocked**, (c) **close** after connect with **optional** `event.code` / `event.reason` for copy tuning **without** leaking internals.
- **Exhaustive** handling remains for **`ServerEvent`** / **`ClientCommand`** — do not weaken shared parsers.
- **Reconnect policy:** Start with **manual Retry** (increment **`attemptId`** / **`connectionAttemptId`**) to match existing patterns; optional limited auto-retry is acceptable if copy shows **attempt count** (UX: no silent spinners).

### Testing requirements

- Prefer **fast unit** tests for banner + state mapping; **E2E** optional for this story.
- Assert **a11y:** blocking failure → **`role="alert"`** present; reconnecting → not incorrectly **`alert`** if non-blocking.

### UX / product

- [Source: `ux-design-specification.md` — **ConnectionBanner** — Purpose, Usage, States, Accessibility.]
- [Source: `ux-design-specification.md` — **Feedback Patterns** — Realtime failures never silent-spin forever.]
- [Source: `ux-design-specification.md` — **Button Hierarchy** — Retry reconnect as primary when it is the decisive action.]

### Cross-story context (Epic 1)

- **Builds on:** **1.6** — lobby roster + `matchStarting`; hooks already hold **`WebSocket`** refs — extend lifecycle, don’t second socket.
- **Unlocks:** clearer lobby → match handoff when Epic **2.1** adds phases; **6.2** may wrap a **global** game error surface — keep this story **lobby-scoped** but **component API** easy to lift.

### Previous story intelligence

From [`1-6-live-roster-host-badge-start-gate.md`](1-6-live-roster-host-badge-start-gate.md):

- Rebuild **`@skribbl/shared`** after schema changes; for **1.7** mostly web-only — still run full **`pnpm -r build`** when touching shared.
- **`protocol-error-message.ts`** maps **protocol** `error.code`s — transport failures are **separate**; don’t overload protocol messages for TCP errors.
- Guest **`matchStarting`** UI parity was a review fix — preserve **phase** visibility when adding banners.

### Git intelligence

- Recent epic: **`0cdabf1`** — roster, `startMatch`, `lobbyRoster`, `matchStarting`; touch the same hooks/pages for connection UX.

### Latest technical specifics

- **WebSocket** in browser: `close` event provides **`code`** / **`reason`** (best-effort); **`error`** event has **no** standard payload — combine with `close` ordering for messaging.
- Stack: Next **~16.2**, React **~19**, see [`project-context.md`](../project-context.md).

### Project Context Rules

From `_bmad-output/project-context.md`:

- **Tailwind** + **DaisyUI**; **`kebab-case`** dirs, **`PascalCase.tsx`** components.
- **No Socket.io**; **no** duplicate protocol types outside **`@skribbl/shared`**.
- **NEXT_PUBLIC_WS_URL** / local dev default documented in [`game-ws-url.ts`](../../apps/web/src/lib/game-ws-url.ts).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.7]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — ConnectionBanner, Feedback Patterns, Button Hierarchy]
- [Source: `_bmad-output/game-architecture.md` — WS client demux, connection UX, error boundary note]

## Dev Agent Record

### Agent Model Used

Composer (gds-dev-story execution)

### Debug Log References

- Vitest required `@` path alias in `vitest.config.ts` for component tests.
- ESLint `react-hooks/set-state-in-effect` for WebSocket subscription effects — scoped disable with comment on host/guest hooks.

### Completion Notes List

- Added `LobbyTransportPhase`, pure `lobbyConnectionBannerModel`, and sticky `LobbyConnectionBanner` (DaisyUI alerts, `role="alert"` vs `role="status"`).
- Host and guest hooks now expose `transport`, `connectionReason`, `transportErrorMessage`, `awaitingRoomHandshake`; post-lobby/post-join `close` sets `disconnected` and preserves lobby/joined UI with retry via `attemptId` / `joinGeneration`.
- Pre-join failures distinguish misconfiguration (`blocked` + `missingGameWebSocketUrlUserMessage`), mixed-content/network hints (`fatal`), and post-join drop (`disconnected`).
- Vitest jsdom + RTL tests for banner and `lobby-transport` mapping; full web test suite, lint, and production build verified.
- **Code review follow-up:** Wire protocol **`reconnectHost`** + server **`Room.hostPlayerId`** so host retry reattaches to an existing lobby when possible; dedicated errors **`HOST_SESSION_LOST`**, **`HOST_RECLAIM_DENIED`**, **`ALREADY_CONNECTED`**. Shared **`transport-user-messages.ts`** splits pre-handshake **`error`** vs **`close`** copy (AC2). Terminal protocol errors after lobby/join surface **`fatal`** UI on host and guest.

### File List

- `apps/web/src/features/lobby/lib/lobby-transport.ts`
- `apps/web/src/features/lobby/lib/lobby-transport.test.ts`
- `apps/web/src/features/lobby/components/LobbyConnectionBanner.tsx`
- `apps/web/src/features/lobby/components/LobbyConnectionBanner.test.tsx`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `apps/web/src/features/lobby/lib/transport-user-messages.ts`
- `apps/web/src/features/lobby/lib/protocol-error-message.ts`
- `apps/web/src/lib/ws-client.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/schemas.test.ts`
- `apps/server/src/room/room.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/room/room-manager.test.ts`
- `apps/server/src/protocol/handlers/handle-client-command.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/vitest.config.ts`
- `apps/web/package.json`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-7-connection-trust-banner-during-lobby-states.md`

## Change Log

- 2026-04-29: Story created — ready for dev (`gds-create-story`).
- 2026-04-29: Implemented lobby connection banner, hook transport model, tests; status → review.

## Open questions _(non-blocking)_

- Whether to add **automated reconnect** with backoff in lobby only, or **manual Retry** only for MVP (AC4 allows either if labeled).
