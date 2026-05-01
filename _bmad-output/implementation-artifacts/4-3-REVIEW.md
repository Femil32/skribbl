---
status: resolved
scope: story-4-3-score-awards-drawer-bonuses-wiring
depth: standard
files_reviewed: 3
critical: 0
warning: 0
info: 0
total: 0
---

# Code review: Story 4.3 (score awards & drawer bonuses wiring)

**Resolved (2026-05-01):** IN-01 — `effectiveElapsedMs` added to `correct_guess_award` using shared `clampGuessElapsedMs` (same path as `computeGuesserPoints`). IN-02 — integration test asserts full NFR-O2 log payload via mocked `pino`.

**Invocation note:** `/gsd-code-review` targets GSD phases under `.planning/`; this repository has **no resolved `phase_found` phase**. Scope followed the story **File List** plus authoritative implementation surfaces.

**Verification:** `pnpm --filter @skribbl/shared test && pnpm --filter @skribbl/shared build && pnpm --filter @skribbl/server test` — all passing (Vitest).

---

## Summary

Implementation matches Story 4.3 acceptance criteria end-to-end: `applyCorrectGuessAward` remains the sole `scoresByPlayerId` increment path during play (outside match bootstrap resets), `elapsed` derives from server `occurredAtMs` minus `drawingPhaseStartedAtMs`, drawer assist stacks once per awarded guesser, `broadcastLobbyRoster` runs inside the award **before** `broadcastCorrectGuess` from `applyChatMessage`, structured `correct_guess_award` logging includes bracket and round inputs for NFR-O2, and integration tests cover roster ordering vs `chatCorrectGuess` plus dual-guesser `N × assist`. No critical or warning-severity defects found.

---

### IN-01 — Logged `elapsedMs` vs clamped decay input *(fixed)*

**Location:** `apps/server/src/room/room-manager.ts` — `applyCorrectGuessAward` (`log.info` payload vs `computeGuesserPoints`)

**Issue:** Raw `elapsedMs` in logs could disagree with the clamped input used for speed decay.

**Fix:** **`clampGuessElapsedMs`** exported from `@skribbl/shared` (shared with **`computeGuesserPoints`**); **`correct_guess_award`** logs **`effectiveElapsedMs`** alongside raw **`elapsedMs`**.

---

### IN-02 — Structured log regression coverage *(fixed)*

**Location:** `apps/server/src/room-ws.integration.test.ts` vs `correct_guess_award` emission

**Issue:** No automated assertion on log payload shape.

**Fix:** Hoisted **`pino`** mock; integration test **`correct_guess_award structured log carries NFR-O2 fields plus effectiveElapsedMs`** matches resolver output and **`clampGuessElapsedMs`**.

---

## Positive notes

- JSDoc on `applyCorrectGuessAward` cleanly states exclusive ledger semantics and adjudication clock basis (`Date.now()` at server match).
- `applyChatMessage` comment ties ordering to FR22/UI expectations alongside integration proof (`lobbyRoster` index precedes first `chatCorrectGuess` per guesser).
- Three-player stacking test materially reduces doubt about cumulative drawer assists in one drawing phase.
- Repo grep confirms match-time score deltas are not incremented outside `applyCorrectGuessAward` (only zeros on schedule/lobby resets).
