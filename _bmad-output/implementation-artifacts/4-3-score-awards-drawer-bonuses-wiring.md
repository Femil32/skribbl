# Story 4.3: Score awards & drawer bonuses wiring

Status: review

<!-- gds-create-story (2026-05-01). Ultimate context engine analysis completed — comprehensive developer guide created. Brownfield: chat path already invokes `applyCorrectGuessAward`; dev-story should prove FR22 end-to-end, tighten observability (NFR-O2), and forbid duplicate scoring paths. -->

## Story

As scoring-aware gameplay,

I want FR22 hooks feeding Epic 2 totals,

So points align with adjudicated guesses.

## Acceptance Criteria

1. **Given** a **first** correct chat guess in **`drawing`** (normalized exact match per Story 4.2) **when** the server accepts the award **then** **`applyCorrectGuessAward`** runs **exactly once** for that guesser in that drawing phase — no parallel or client-side score mutation; **`room.scoresByPlayerId`** is the sole session ledger.
2. **Given** a successful award **when** points are computed **then** the **guesser** receives **`computeGuesserPoints(elapsed, roundMs, maxPts, minPts)`** from `@skribbl/shared` with **`elapsed = occurredAtMs - drawingPhaseStartedAtMs`**, **`occurredAtMs` taken at server adjudication time** (same basis as Story 2.6 / existing JSDoc — do not trust client clocks).
3. **Given** the same award **when** drawer bonus applies **then** **`currentDrawerPlayerId`** receives **`resolveDrawerAssistPerCorrect()`** points **once per distinct awarded guesser** (fixed assist, not speed-scaled per Story 2.6).
4. **Given** a successful award **when** clients observe totals **then** **`broadcastLobbyRoster`** has already run **before** **`chatCorrectGuess`** emission from `applyChatMessage`, so **`lobbyRoster`** reflects new totals when the celebration event arrives (ordering invariant for UI consistency).
5. **Given** scoring executes **when** operators inspect logs **then** structured **`correct_guess_award`** (or successor) records **enough rationale for NFR-O2**: at minimum **`guesserPts`**, **`drawerAssistPts`**, **`elapsedMs`**, plus **formula inputs** **`roundMs`**, **`guesserScoreMax`**, **`guesserScoreMin`** (or equivalent bracket resolution output) so speed-decay debugging does not require guessing env defaults.
6. **Given** multi-guesser rooms **when** each distinct guesser solves **then** cumulative drawer assists match **N × assist** for N distinct successful awards in the same drawing phase; duplicate guesses do **not** change totals (still **`ALREADY_AWARDED_THIS_DRAWING`** path only).

## Tasks / Subtasks

- [x] **Trace single scoring spine** (AC: #1, #6) — Confirm only **`RoomManager.applyCorrectGuessAward`** mutates match scores for correct guesses; **`applyChatMessage`** success path uses it; no other handler increments scores on chat.
- [x] **Verify ordering + fan-out** (AC: #4) — In **`room-manager.ts`**, document or assert in tests: **`applyCorrectGuessAward`** → internal **`broadcastLobbyRoster`** → then **`broadcastCorrectGuess`** (and optional **`transitionDrawingToRoundResult`** when all non-drawer guessers awarded).
- [x] **Integration test: chat → scores** (AC: #1–#4) — Extend **`apps/server/src/room-ws.integration.test.ts`**: drive **`drawing`** with known word, send **`chatMessage`** from guesser with exact word; parse emitted **`lobbyRoster`** (last per socket) and assert guesser + drawer **`score`** deltas match **`computeGuesserPoints`** + **`resolveDrawerAssistPerCorrect`** for stubbed **`ROUND_MS`** / known **`vi.advanceTimersByTime`** offset from drawing start.
- [x] **Structured logging** (AC: #5) — Augment **`correct_guess_award`** log payload in **`applyCorrectGuessAward`** with **`roundMs`**, **`guesserScoreMax`**, **`guesserScoreMin`** (from **`resolveRoundMs`** / **`resolveGuesserScoreBracket()`**) — keep **`pino`** object-first pattern.
- [x] **Regression guard** — Ensure **`applyCorrectGuessAward`** unit/integration behaviors from Story 2.6 remain green (drawer-as-guesser reject, duplicate award, roster **`score`** ints).
- [x] **Cross-story** — Do **not** duplicate spoiler logic here (Story 4.2); do **not** move scoring into web UI; Story 4.4 may add celebration UX only — totals stay **`lobbyRoster`**-authoritative.

## Dev Notes

### Brownfield state (read before coding)

- **Scoring math and entry point already exist:** **`applyCorrectGuessAward`** in **`apps/server/src/room/room-manager.ts`** implements FR10-style decay + drawer assist, **`drawingPhaseAwardedGuesserIds`** dedupes per drawing, **`broadcastLobbyRoster`** updates clients.
- **Chat pipeline already awards:** On first exact match from a non-drawer, **`applyChatMessage`** calls **`applyCorrectGuessAward({ occurredAtMs: Date.now() })`** then **`broadcastCorrectGuess`**; early round completion calls **`transitionDrawingToRoundResult`** when **`allNonDrawerGuessersAwarded`** ([Source: **`apps/server/src/room/room-manager.ts`**]).
- **Treat Story 4.3 as verification + observability + regression closure** unless gaps appear — align epic wording (“FR22 hooks feeding Epic 2 totals”) with **proven** chat→ledger→roster behavior.

### Architecture compliance

- **Server-authoritative ledger:** **`room.scoresByPlayerId`** only; clients consume **`lobbyRoster`** ([Source: **`_bmad-output/project-context.md`**]).
- **Pure scoring helper:** **`computeGuesserPoints`** only from **`@skribbl/shared`** ([Source: **`packages/shared/src/scoring.ts`**]).
- **Config:** Brackets and assist from **`apps/server/src/config/game.ts`** (**`GUESSER_SCORE_MAX`**, **`GUESSER_SCORE_MIN`**, **`DRAWER_ASSIST_PER_CORRECT`**, **`ROUND_MS`**).

### Developer guardrails / file map

| Concern | Location |
|--------|----------|
| Award + roster broadcast + logging | **`apps/server/src/room/room-manager.ts`** — **`applyCorrectGuessAward`**, **`broadcastLobbyRoster`** |
| Chat → award orchestration | **`applyChatMessage`** (same file) |
| Scoring pure function | **`packages/shared/src/scoring.ts`**, **`computeGuesserPoints`** tests |
| Game constants / env | **`apps/server/src/config/game.ts`** |
| Client totals during match | **`use-host-create-room.ts`**, **`use-guest-join-room.ts`** — **`lobbyRoster`** branch; **`PhaseBar.tsx`** — score strip |
| Prior scoring story spec | **`_bmad-output/implementation-artifacts/2-6-score-rules-running-totals.md`** |

### EPIC 4 cross-story context

- **4.2** — Exact match + spoiler-safe broadcasts; must remain **`applyCorrectGuessAward`** for scoring ([Source: **`4-2-guess-adjudication-exact-match-spoiler-safe-broadcasts.md`**]).
- **4.4** — Messaging/UX beats for correct guess; optional display of point deltas belongs there **only if** wire/schema extensions are agreed — **not required** for 4.3 AC as written.

### Previous story intelligence (4.2)

- **`applyCorrectGuessAward`** was explicitly left as the **only** scoring hook from chat; duplicate guesses must **not** re-invoke successful awards.
- Failure codes from award (**`NOT_IN_MATCH`**, **`NO_DRAWING_START`**, etc.) propagate from **`applyChatMessage`** — scoring story should **not** widen generic client error strings unless PM expands scope ([Source: **`4-2-REVIEW.md`**] note).

### Git intelligence

- **`97fcbaf` / `c10c4cb`** — Guess adjudication + spoiler-safe broadcasts (**Epic 4**).
- **`dc342eb`** — Chat pipeline landing (`chatMessage`, **`MatchChatPanel`**).

### Latest tech / versions

- Re-verify pins in **`_bmad-output/project-context.md`** (Next ~16.x, React ~19.x, Zod 4.x, **`ws`** 8.x) before dependency changes.

### Project Context Rules (extract)

- Parse WS JSON through **`@skribbl/shared`** Zod schemas only.
- **`pnpm`** workspaces; single wire authority **`@skribbl/shared`**.
- **Vitest** for server integration tests; prefer real **`handleClientCommand`** / WS capture patterns matching existing **`room-ws.integration.test.ts`**.
- **Structured logging** (**pino**), not ad-hoc **`console.log`** in hot paths ([Source: **`project-context.md`**]).

### References

- [Source: **`_bmad-output/planning-artifacts/epics.md`** — Epic 4, Story 4.3, FR22]
- [Source: **`_bmad-output/planning-artifacts/gdd.md`** — Scoring, FR10/FR22]
- [Source: **`_bmad-output/planning-artifacts/prd.md`** — FR22, NFR-O2]
- [Source: **`_bmad-output/game-architecture.md`** — Scoring system overview]
- [Source: **`_bmad-output/implementation-artifacts/2-6-score-rules-running-totals.md`** — FR10 acceptance + **`applyCorrectGuessAward`** contract]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

—

### Completion Notes List

- **Single scoring spine:** JSDoc on **`applyCorrectGuessAward`** states exclusive ledger mutation for adjudicated guesses; repo search shows **`scoresByPlayerId`** increments only from match bootstrap resets and **`applyCorrectGuessAward`** (`apps/server` scope).
- **Ordering:** Inline comment on **`applyChatMessage`** notes roster broadcast inside award runs before **`chatCorrectGuess`**; integration test asserts per-guesser **`lobbyRoster`** index precedes **`chatCorrectGuess`**.
- **`correct_guess_award`** log payload includes **`roundMs`**, **`guesserScoreMax`**, **`guesserScoreMin`** (NFR-O2 / AC5).
- Integration tests exercise **`chatMessage`** via **`handleClientCommand`**: totals match **`computeGuesserPoints`** + **`resolveDrawerAssistPerCorrect`** with **`ROUND_MS=80000`**; three-player test verifies drawer **`N × assist`** for two distinct successful guessers.

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-3-score-awards-drawer-bonuses-wiring.md`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/room-ws.integration.test.ts`

---

## Questions / clarifications (optional — for product owner)

- Should **`chatCorrectGuess`** eventually carry **`guesserPointsAwarded`** / **`drawerAssistAwarded`** for inline celebration (would touch **`packages/shared/src/schemas.ts`**), or is **`lobbyRoster`**-only sufficient for MVP?

---

## Change Log

- **2026-05-01** — Story authored via `gds-create-story 4-3`; status **`ready-for-dev`**; sprint entry **`4-3-score-awards-drawer-bonuses-wiring`** → **`ready-for-dev`**.
- **2026-05-01** — Implementation: richer **`correct_guess_award`** logging; **`room-manager`** orchestration docs; **`room-ws`** integration tests for chat→ledger→roster ordering and multi-guesser drawer assists; story status **`review`**; sprint **`4-3-score-awards-drawer-bonuses-wiring`** → **`review`**.
