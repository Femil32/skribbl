---
status: issues_found
scope_story: "2.7 Match-end ScoreboardSummary"
depth: standard
files_reviewed: 15
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
reviewed_at: "2026-04-29"
---

# Code review: Story 2.7 (match end, ScoreboardSummary, returnToLobby)

Scoped from [`2-7-match-end-scoreboardsummary.md`](./2-7-match-end-scoreboardsummary.md) file list (implementation artifacts + sprint YAML excluded from code pass). Depth: **standard** (per-file logic, protocol + UI wiring).

## Summary

Server transition to `matchEnded` after the inter-round gap, `returnToLobby` host gate + score reset, shared schemas, client hooks, and Vitest integration coverage are **coherent and match the story intent**. During review, winner subtitle used match-level wording in the current tree (`wins the match`). Remaining notes are **info**-level polish.

---

### IN-001 — Duplicate “final ranking” sort logic

**Severity:** Info  
**Where:** `apps/web/src/features/match/components/PhaseBar.tsx` (`resolveLeaderChip`), vs `sortPlayersByFinalScore`

**Problem:** Same sort comparator (score desc, `playerId` tie-break) exists in two places. Drift risk if tie-break rules change.

**Fix:** Optional refactor: reuse `sortPlayersByFinalScore` or a tiny shared comparator from `features/match/lib/`.

---

### IN-002 — Rank indicator hidden from assistive tech

**Severity:** Info  
**Where:** `ScoreboardSummary.tsx` — rank `<span aria-hidden>`

**Problem:** Order is still inferable from list order, but explicit rank numbers are hidden from screen readers.

**Fix:** Optional: expose rank via visually hidden text or `aria-label` on each row.

---

### IN-003 — Guest shell copy still “lobby”-centric during `matchEnded`

**Severity:** Info  
**Where:** `apps/web/src/app/join/JoinRoomClient.tsx` — heading/description while `guestState.phase === "matchEnded"`

**Problem:** The page can still read as “joined the room … in the lobby” while showing the scoreboard. Not incorrect functionally; slightly inconsistent framing.

**Fix:** Optional phase-aware headline/description for `matchEnded`.

---

## What looked solid

- **`enterMatchEnded`**: Clears round secrets and word-choice timer; broadcasts `matchPhase` without `phaseDeadlineMs`; follows with `lobbyRoster` (`room-manager.ts`).
- **`returnToLobby`**: Host-only + `matchEnded` gate; `clearMatchTimers`; roster-derived score map reset to zeros; broadcasts match phase + roster.
- **Hooks**: `matchPhase` handler clears `drawerPlayerId` for `matchEnded` / `lobby` and avoids carrying a bogus deadline when the server omits it.
- **PhaseBar**: Early return for `matchEnded` avoids round timer / drawer chrome (Story 2.7 §6).
- **Tests**: Integration tests cover `matchEnded` after gap, roster scores, `returnToLobby` zero scores, and guest `NOT_HOST` on `returnToLobby`.
- **Shared**: `isMatchFlowPhase` excludes `matchEnded`; `isRosterScoreVisiblePhase` includes it — matches UI needs.

---

## Next steps

- Optional: address INFO items or track as follow-ups.
- If you use GSD fix automation: `/gsd-code-review-fix` with the phase/story context (this report is the input).
