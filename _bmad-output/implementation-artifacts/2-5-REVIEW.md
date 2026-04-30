---
status: issues_found
story: "2.5 Progressive letter hints cadence"
files_reviewed: 13
depth: standard
critical: 0
warning: 1
info: 5
total: 6
scope_note: "GSD phase init unavailable (no .planning roadmap). Scoped from 2-5 story File List."
---

# Code review: Story 2.5 — Progressive letter hints cadence

## Summary

Implementation aligns well with the story: server-owned cadence, deterministic reveal order, shared mask helpers + schema, `RoomManager` timer hygiene with `timeouts` / drawing-end teardown, client hint feed with phase/round guards and drawer suppression. Integration and unit tests cover the happy path and timer stop-after-round behavior.

---

## Findings

### WR-1 — `drawingHintTick` accepted when `matchRoundIndex` is still undefined on the client

**Severity:** Warning  
**Files:** `apps/web/src/features/lobby/hooks/use-host-create-room.ts`, `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`

Both handlers only reject ticks when `prev.matchRoundIndex !== undefined && prev.matchRoundIndex !== h.matchRoundIndex`. If `matchRoundIndex` were ever missing on the client while `phase === "drawing"`, hint rows could be recorded without a round correlation guard (reorder or delayed `matchPhase` edge cases).

**Fix:** Treat a missing `matchRoundIndex` during `drawing` as reject-or-queue-until-known, or default to `h.matchRoundIndex` only when adopting the first tick after an authoritative `matchPhase`. Easiest hardening: require `prev.matchRoundIndex === h.matchRoundIndex` whenever `prev.phase === "drawing"` (ensure `matchPhase` always sets index before hints; then this is a tautology but safer if server/client drift).

---

### IN-1 — Epic 4: early correct guess must clear match timers

**Severity:** Info  
**Files:** `apps/server/src/room/room-manager.ts` (`applyCorrectGuessAward`)

Story AC5 / completion notes require hints not to fire after the match leaves `drawing`. Today `applyCorrectGuessAward` does not change phase or call `clearMatchTimers`. Inline comments document the intent for Epic 4. No action required for 2.5 if scope stops at documentation; track as integration checkpoint when chat/guess lands.

---

### IN-2 — `resolveHintCadenceMs` tests omit clamp boundaries

**Severity:** Info  
**File:** `apps/server/src/config/game.test.ts`

Tests cover default, invalid string, and `5000`. They do not assert behavior for values just outside the documented **2000–60000** clamp (e.g. `1999`, `60001`), unlike other resolvers’ style in the same file.

**Fix:** Add two one-line stubs expecting fallback to `DEFAULT_HINT_CADENCE_MS`.

---

### IN-3 — Zod does not relate `revealedLetterCount` to `totalLetters`

**Severity:** Info  
**File:** `packages/shared/src/schemas.ts`

`drawingHintTick` allows any nonnegative integers for both fields. A malformed server payload could pass parse while contradicting the mask.

**Fix:** Optional `.refine()` on the object, or keep server-only invariant and rely on tests (current approach).

---

### IN-4 — ASCII-only “letters” for hints

**Severity:** Info  
**File:** `packages/shared/src/hint-mask.ts`

`eligibleLetterIndices` uses `/^[a-zA-Z]$/`. Non-ASCII letters (e.g. accented characters) are not hinted and appear verbatim. Consistent with “Epic 4 MVP alphabet” notes; document if word bank expands.

---

### IN-5 — Duplicated hint-append helper

**Severity:** Info  
**Files:** `use-host-create-room.ts`, `use-guest-join-room.ts`

Identical `MAX_HINT_FEED_ROWS` and `appendDrawingHintRows`. Low risk; consider a tiny shared module if more surfaces consume hints.

---

### IN-6 — UX copy: section title vs row label

**Severity:** Info  
**File:** `apps/web/src/features/match/components/MatchHintFeed.tsx`

Section header is **“Hints”** while per-row prefix is **“Hint”** (UX-DR18 calls for a fixed hint label). Cosmetic; align wording with UX spec if strict.

---

## Positive notes

- **Timer model:** Hint timers live on the same `timeouts` array as drawing end; `drawingEnd` clears all pending handles before inter-round scheduling — matches Story 2.4/2.5 expectations.
- **Determinism:** `hintRevealOrderSeed` + `shuffleIndicesDeterministic` are pure and tested (`hint-mask.test.ts`).
- **Integration test:** `drawingHintTick` fake-timer test checks monotonic `hintIndex`, full reveal, and no further ticks after round end.
- **Exhaustive routing:** Client handlers use `default: never` for `ServerEvent` switches.

---

## Suggested next steps

1. Address **WR-1** if you want defense-in-depth against `matchRoundIndex` omission.
2. When implementing Epic 4 guessing, wire early round completion to `clearMatchTimers` / phase transition (**IN-1**).
3. Optional test and schema hardening (**IN-2**, **IN-3**).
