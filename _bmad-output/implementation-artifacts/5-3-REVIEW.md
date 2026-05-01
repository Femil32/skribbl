---
status: resolved
phase_ref: "5-3 / Story 5.3"
depth: standard
files_reviewed: 11
critical: 0
warning: 0
info: 0
total: 0
gsd_phase_found: false
resolved_at: "2026-05-01"
note: "Follow-up fixes landed in app: WR-1 aria hint for hosts; IN-1 bg-linear-to-br on join/host chips; IN-2 leader (away) in PhaseBar."
---

# Code review: Story 5.3 — Presence decay UI (muted roster rows)

## Summary

Server roster construction correctly merges `awaitingReconnect` with live sockets, preserves deterministic sort, fixes host truth via `hostPlayerId`, and adds authoritative `connectionStatus`. Client UI adds non–color-only cues (icon + label), muted styling, and integration tests cover guest/host disconnect and reconnect. **All targeted tests pass** (`@skribbl/shared`, `@skribbl/server` including new integration cases, `@skribbl/web` relevant suites).

## Resolution (2026-05-01)

All findings addressed: connected-host `aria-label` deduped (`LobbyPlayerRoster`), avatar chips use `bg-linear-to-br` on join/host pages, leader chip mirrors drawer `(away)` when the leader is disconnected (`PhaseBar`).

## Scope

| File |
|------|
| `packages/shared/src/schemas.ts` |
| `packages/shared/src/schemas.test.ts` |
| `packages/shared/src/index.ts` |
| `apps/server/src/room/room-manager.ts` |
| `apps/server/src/room-ws.integration.test.ts` |
| `apps/web/src/features/lobby/components/LobbyPlayerRoster.tsx` |
| `apps/web/src/features/lobby/lib/lobby-transport.ts` |
| `apps/web/src/features/lobby/lib/lobby-transport.test.ts` |
| `apps/web/src/features/match/components/PhaseBar.tsx` |
| `apps/web/src/features/match/components/ScoreboardSummary.tsx` |
| `apps/web/src/features/match/lib/sort-players-by-final-score.test.ts` |

---

### WR-1 — Redundant “host” in `aria-label` for connected host rows

**Where:** `apps/web/src/features/lobby/components/LobbyPlayerRoster.tsx` — `rowAria` combines `p.isHost ? ", host" : ""` with `ariaHint` where `ariaHint` for connected hosts is already `"present, host"`.

**Problem:** Screen readers hear duplicated host semantics, e.g. `{name}, host, present, host`.

**Fix:** Drop either the `, host` segment from `rowAria` or shorten `ariaHint` for the connected case (e.g. only `"present"` when `isHost` is already reflected in the first part of the label).

---

### IN-1 — `bg-linear-to-br` vs `bg-gradient-to-br` elsewhere

**Where:** `LobbyPlayerRoster.tsx` and `ScoreboardSummary.tsx` use `bg-linear-to-br` (Tailwind v4). `LobbyHostPage.tsx` / `JoinRoomClient.tsx` still use `bg-gradient-to-br`.

**Note:** Not incorrect for v4, but visually inconsistent avatar chips across flows. Optional follow-up for design consistency only.

---

### IN-2 — Leader chip does not reflect “away” presence

**Where:** `apps/web/src/features/match/components/PhaseBar.tsx` — `resolveLeaderChip` uses `sortPlayersByFinalScore` and display name only.

**Note:** If the score leader is disconnected, the strip still shows their plain name. Story asked for minimal change; this is an optional enhancement for parity with drawer `(away)` labeling.

---

## What went well

- Dedupe order (stash then sockets) ensures live connection always wins over stash.
- Zod default on `connectionStatus` preserves backward-compatible parsing.
- Integration tests assert both guest and host disconnect semantics and reconnect clearing the flag.
- Phase bar and scoreboard handle disconnected drawer / rows without breaking layout.

## Verification run

- `pnpm --filter @skribbl/shared test` — pass  
- `pnpm --filter @skribbl/server test` — pass (includes `room-ws.integration.test.ts`)  
- `pnpm --filter @skribbl/web test` — pass (includes `lobby-transport` and `sort-players-by-final-score` tests)
