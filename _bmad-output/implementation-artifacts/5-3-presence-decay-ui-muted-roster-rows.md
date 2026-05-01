# Story 5.3: Presence decay UI — muted roster rows

Status: done

<!-- gds-create-story (2026-05-01). Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As active participants,

I want visible disconnected states,

So we know who might return (FR27, UX-DR8 status indicators).

## Acceptance Criteria

1. **Given** a peer’s socket drops mid-session while the server holds their seat in **`awaitingReconnect`** (see `leaveSocketRoom` in `apps/server/src/room/room-manager.ts`) **when** a **`lobbyRoster`** (or successor roster fan-out) is rendered on connected clients **then** that player **remains listed** with an explicit **disconnected / away** status — not removed from the roster — so “who might return” is truthful (FR27).
2. **Given** roster rows **when** rendering connection/presence feedback **then** each state pairs **visible iconography + short text label** (and optional muted styling); **critical states must not rely on color alone** — align with UX spec **color independence** (“color + icon + label”) and **UX-DR8** roster hints.
3. **Given** a player is **connected** **when** roster renders **then** their row reads as live/present (not muted) with an accessible subtitle consistent with today’s honest “Connected” line where applicable.
4. **Given** `LobbyConnectionBanner` / transport phases **`reconnecting` | `disconnected` | `fatal` | `blocked`** **when** the local client progresses through auto-retry vs fatal vs blocked **then** copy, DaisyUI **`alert`** variant, and **`role="alert"` vs `role="status"`** remain **distinct per `lobbyConnectionBannerModel`** — sharpen strings only where two phases still feel interchangeable to a sighted reader (preserve existing a11y rules in `LobbyConnectionBanner.tsx` comments).

## Tasks / Subtasks

- [x] **Shared wire model** (AC: #1–#3) — Extend `lobbyRosterPlayerSchema` in `packages/shared/src/schemas.ts` with a server-authoritative presence field, e.g. `connectionStatus: z.enum(["connected", "disconnected"]).default("connected")` (names are illustrative — pick one enum and use everywhere). Ensure **`roomJoined`** initial roster and every **`lobbyRoster`** fan-out includes the field. Add **`schemas.test.ts`** round-trip / default parsing cases (omit field → treated as connected for backward-compat tests if you preserve defaults client-side).
- [x] **Server roster construction** (AC: #1, #3) — Refactor `RoomManager.buildLobbyRosterPlayers` (`apps/server/src/room/room-manager.ts`) to **merge**:
  - all **currently connected** identities (today’s socket walk), **plus**
  - all **`awaitingReconnect`** stashes for the same room,
  deduped by **`playerId`**, deterministic sort **by `playerId`** (keep Story 1.6 contract). Mark `connectionStatus: "disconnected"` for stash-only IDs; **`"connected"`** for live sockets.
  - **`isHost`**: derive from **`room.hostPlayerId === playerId`**, **not** `hostSocket === ws`, so the **canonical host** still shows Host badge while disconnected mid-match (today’s socket-based host flag silently mislabels whoever inherited `hostSocket`).
  - Scores for disconnected rows: **`room.scoresByPlayerId[id] ?? 0`** (already authoritative).
  - **`broadcastLobbyRoster`** stays the broadcast mechanism; callers unchanged except they now emit richer payloads.
- [x] **Client roster UI** (AC: #2, #3) — Update `apps/web/src/features/lobby/components/LobbyPlayerRoster.tsx`:
  - Apply **muted row** styling for disconnected peers (opacity, border contrast — keep readable).
  - Add a **small inline icon + text** (e.g. “Disconnected · may reconnect”) via DaisyUI-neutral / semantic-safe patterns; provide **`aria-label`** on the row that includes presence.
  - Keep **tabular score** semantics for `showScores` when match phases show totals.
  - Exhaustive handling for the new discriminant (follow project exhaustive-switch rule).
- [x] **Downstream roster consumers** (AC: #1–#3) — Audit **`PhaseBar.tsx`** drawer name resolution and **`ScoreboardSummary.tsx`** (and any other `LobbyRosterPlayer[]` renders): they should ** tolerate** disconnected rows — especially **drawer still mid-match away** (`drawerPlayerId` pointing at a disconnected roster row once server lists them again). Prefer **minimal or no visual change** at match-end if everyone reconnected before `matchEnded`; if someone remains disconnected at scoreboard time, muted row treatment should still read clearly.
- [x] **Connection banner polish** (AC: #4) — In `apps/web/src/features/lobby/lib/lobby-transport.ts`, review `lobbyConnectionBannerModel` copy for **`reconnecting` vs `disconnected` vs `fatal` vs `blocked`**; adjust only if two states read as duplicates. Extend `lobby-transport.test.ts` if copy changes.
- [x] **Tests** (AC: #1–#4) — `apps/server/src/room-ws.integration.test.ts`: add a case where **guest socket closes during `drawing`**, host (or survivor) receives **`lobbyRoster`** listing the guest with **`disconnected`** and correct score / host flag semantics; reconnect clears the flag (existing reconnect paths already fan out roster — assert the transition). Run `pnpm --filter @skribbl/server test` and `pnpm --filter @skribbl/shared test`; `pnpm --filter @skribbl/web exec tsc --noEmit` as needed.

## Dev Notes

### Brownfield reality (read first)

- Today **`buildLobbyRosterPlayers` only iterates `room.sockets`**, so as soon as a peer hits **`awaitingReconnect`**, they **disappear** from everyone else’s roster (`broadcastLobbyRoster` after `leaveSocketRoom`). That contradicts FR27 / Story 5.3 (“who might return”).
- **`awaitingReconnect` is only populated when `room.phase !== "lobby"`** — lobby drops remove the player entirely; **no phantom row** needed in lobby.
- Hydration / recap is owned by Story **5.2** (`roomHydrate`, `hydrate-merge`) — **5.3** is **social/presence optics** only; extend roster shapes, don’t fork hydrate.

### Architecture compliance

- **Server-authoritative presence flags** — client renders facts from **`lobbyRoster`** / **`roomJoined`**, not guessed from transport alone for *remote* peers ([Source: `_bmad-output/project-context.md`]).
- **Zod-only wire** — one edit in **`@skribbl/shared`** for new roster fields ([Source: `_bmad-output/project-context.md`]).
- **Accessibility** — paired non-color cues for roster presence; **`ConnectionBanner`** already documents `alert` vs `status` roles ([Source: `apps/web/src/features/lobby/components/LobbyConnectionBanner.tsx`]).

### Developer guardrails / file map

| Concern | Location |
| -------- | -------- |
| Roster aggregation + broadcast | `apps/server/src/room/room-manager.ts` (`buildLobbyRosterPlayers`, `broadcastLobbyRoster`, `leaveSocketRoom`, reconnect paths) |
| Room stash | `apps/server/src/room/room.ts` — `awaitingReconnect` |
| Wire types | `packages/shared/src/schemas.ts` — `lobbyRosterPlayerSchema`, `lobbyRoster` event |
| Roster UI | `apps/web/src/features/lobby/components/LobbyPlayerRoster.tsx` |
| Banner copy | `apps/web/src/features/lobby/lib/lobby-transport.ts` (+ tests) |
| Match chrome using roster | `apps/web/src/features/match/components/PhaseBar.tsx`, `ScoreboardSummary.tsx` |
| Host / guest shells | `LobbyHostPage.tsx`, `JoinRoomClient.tsx` (pass-through; likely unchanged) |

### Epic 5 cross-story context

- **5.1** (**backlog**): tokens / handshake polish — **do not block** 5.3 on token UX; reconnect commands already flow for host/guest reclaim.
- **5.2** (**done**): hydrate + transcripts — roster presence is **orthogonal**; keep spoilers and canvas seq rules untouched ([Source: `_bmad-output/implementation-artifacts/5-2-snapshot-op-replay-hydration.md`]).

### Previous story intelligence (5.2)

- Reconnect emits **`sendRoomHydrate`** then normal roster paths; verify **post-reconnect** `lobbyRoster` marks the player **`connected`** again.
- **`isHost`** + stash behavior was tightened for mid-match reclaim — reuse **`hostPlayerId`** for badge truth when extending roster rows ([Source: `5-2` completion notes]).

### Optional “decay” (stretch)

- MVP **muted static row** satisfies “presence decay UI” wording. If you add **time-since-drop** Progressive enhancement, expose a **single server timestamp or monotonic ms** on disconnect fan-out — avoid client-only guesses.

### Git intelligence

- **`b9881da`** landed hydrate / `awaitingReconnect` / `canvas-log`; 5.3 should ride the same roster fan-out choke points with **additive** schema fields.

### Project Context Rules

- No **Socket.io**; no duplicate schemas outside **`@skribbl/shared`** ([Source: `_bmad-output/project-context.md`]).
- **Monorepo commands:** `pnpm --filter @skribbl/server test`, `pnpm --filter @skribbl/shared test` ([Source: `_bmad-output/project-context.md`]).

## Dev Agent Record

### Agent Model Used

Cursor agent (GPT-5.2)

### Debug Log References

### Implementation Plan

1. Add `rosterConnectionStatusSchema` + `connectionStatus` default on `lobbyRosterPlayerSchema`; tests for omit/explicit values.
2. Merge `awaitingReconnect` + live sockets in `buildLobbyRosterPlayers`; `isHost` from `hostPlayerId`; socket overlay wins dedupe.
3. Roster UI: muted rows, SVG+text disconnected line, exhaustive switch, row `aria-label`.
4. PhaseBar drawer `(away)` suffix when disconnected; ScoreboardSummary muted/dashed + subtitle for still-away at end.
5. Differentiate `reconnecting` vs `connecting` after-drop banner titles; update unit test.
6. Integration tests: guest drop + reconnect; host drop preserves Host badge.

### Completion Notes List

- Implemented `connectionStatus` on `LobbyRosterPlayer` with Zod default `"connected"`; server roster merges stash + sockets; `isHost` derived from `room.hostPlayerId`.
- `LobbyPlayerRoster` shows icon + “Disconnected · may reconnect”, muted styling, accessible row labels; PhaseBar/ScoreboardSummary tolerate disconnected rows.
- `lobbyConnectionBannerModel`: `reconnecting` title “Restoring your session…” vs `connecting`+`after-drop` “Reconnecting to the game server…”.
- Added integration coverage for drawing-phase disconnect/reconnect and host-disconnect Host badge.
- Full `pnpm test` passed (shared build required for server to pick up schema dist).
- Code review follow-up: host `aria-label` deduped; `bg-linear-to-br` aligned on join/host chips; PhaseBar leader chip shows `(away)` when leader disconnected.

### File List

- `packages/shared/src/schemas.ts`
- `packages/shared/src/schemas.test.ts`
- `packages/shared/src/index.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/src/features/lobby/components/LobbyPlayerRoster.tsx`
- `apps/web/src/features/match/components/PhaseBar.tsx`
- `apps/web/src/features/match/components/ScoreboardSummary.tsx`
- `apps/web/src/features/lobby/lib/lobby-transport.ts`
- `apps/web/src/features/lobby/lib/lobby-transport.test.ts`
- `apps/web/src/features/match/lib/sort-players-by-final-score.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-01 — Story 5.3: presence field on roster wire model, server merge with `awaitingReconnect`, muted roster UI + banner copy differentiation, tests (shared, server integration, web).
- 2026-05-01 — Marked done: sprint status + review fixes (a11y label, Tailwind gradient parity, leader `(away)`).

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5, Story 5.3, FR27]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — roster / disconnect / color independence §§77, 106, 255]
- [Source: `_bmad-output/project-context.md`]
- [Source: `_bmad-output/implementation-artifacts/5-2-snapshot-op-replay-hydration.md`]

---

Completion note: Ultimate context engine analysis completed — comprehensive developer guide created.
