---
phase: epic-2-story-2.5-letter-hints
reviewed: 2026-04-29
depth: standard
files_reviewed: 12
files_reviewed_list:
  - _bmad-output/implementation-artifacts/2-5-progressive-letter-hints-cadence.md
  - packages/shared/src/schemas.test.ts
  - packages/shared/src/letter-hint-progression.ts
  - packages/shared/src/letter-hint-progression.test.ts
  - packages/shared/src/index.ts
  - packages/shared/src/schemas.ts
  - apps/server/src/config/game.ts
  - apps/server/src/room/room.ts
  - apps/server/src/room/room-manager.ts
  - apps/server/src/room-ws.integration.test.ts
  - apps/web/src/features/lobby/hooks/use-host-create-room.ts
  - apps/web/src/features/lobby/hooks/use-guest-join-room.ts
  - apps/web/src/features/match/components/LetterHintFeed.tsx
  - apps/web/src/features/lobby/components/LobbyHostPage.tsx
  - apps/web/src/app/join/JoinRoomClient.tsx
findings:
  critical: 0
  high: 0
  medium: 1
  low: 4
  suggestions: 2
  total: 7
status: issues_found
---

# Story 2.5: Code Review Report

**Reviewed:** 2026-04-29  
**Depth:** standard  
**Spec:** `_bmad-output/implementation-artifacts/2-5-progressive-letter-hints-cadence.md`  
**Status:** issues_found (no critical/high)

## Summary

Server-side hint scheduling (`resolveHintTickMs`, chained `setTimeout` in `scheduleLetterHints`), fan-out to all sockets, timer cleanup via `clearMatchTimers` / `clearLetterHintTimers`, shared Zod `letterHint` variant, pure mask progression, and guest/host UI wiring look coherent and aligned with the story. Remaining gaps are mostly test coverage for `serializeServerEvent` on `letterHint`, optional web/component tests, international-character semantics, and client-side append-only deduplication if duplicate events ever appear.

---

## Acceptance criteria map

| AC | Verdict | Evidence |
|----|---------|----------|
| **1** Server cadence, `resolveHintTickMs()`, 3k–60k, no client timing | **PASS** | `resolveHintTickMs()` in `apps/server/src/config/game.ts` (default 10_000, clamp 3_000–60_000). Hints scheduled only in `scheduleLetterHints` (`room-manager.ts`) using `setTimeout` + `resolveHintTickMs()`. No client timers for hints. |
| **2** Partial progression; masked start multi-letter; length-1 first tick full; stop exhausted / leave drawing | **PASS** | `letter-hint-progression.ts`: `totalLetterHintEmissions`, `lettersRevealedAfterHint`, `maskedWordAtLetterHintIndex`. L=1 → one emission with full letter; L>1 → first tick zero letters revealed; stop when `hintSeq >= totalEmissions` or phase/round/secret checks fail in timer callback; `clearLetterHintTimers` on drawing end. |
| **3** Wire protocol in `schemas.ts`; serialize/parse valid | **PARTIAL** | `letterHint` only in `packages/shared/src/schemas.ts` (lines 157–165). `safeParseServerEvent` tested in `schemas.test.ts` (accepts `letterHint`). **Gap:** no explicit `serializeServerEvent` ↔ JSON round-trip for `letterHint` (see Low). |
| **4** Same ordered fan-out per tick | **PASS** | `scheduleLetterHints`: same `hintEvent` built once, `for (const sock of room.sockets) this.sendEvent(sock, hintEvent)` (`room-manager.ts` 175–183). |
| **5** Timers cleared with `clearMatchTimers` / phase transitions | **PASS** | `clearMatchTimers` calls `clearLetterHintTimers` (`room-manager.ts` 98–104). `clearLetterHintTimers` also before new drawing in `lockWordAndBeginDrawing` (201), on drawing timeout (211), room empty (378), and `scheduleMatchFlow` (280). Advancing past drawing does not add hints (`integration` test). |
| **6** UI: distinct from chat; drawer hides hints | **PASS** | `LetterHintFeed.tsx`: muted monospace, `Hint ·` prefix, distinct `aside` styling. `showGuessersOnly` + `isCurrentDrawer` hides for drawer (`LobbyHostPage.tsx` 389–394, `JoinRoomClient.tsx` 243–248). |
| **7** Tests + claimed commands | **PARTIAL** | Shared tests: `letter-hint-progression.test.ts`. Server: `room-ws.integration.test.ts` `"drawing: letterHint events match..."`. **Gap:** no `apps/web` tests for hints (AC allows “if needed”). Story completion claims full `pnpm` matrix — not re-executed in this review session. |

---

## Critical

_None._

## High

_None._

## Medium

### MG-01: Non‑ASCII letters are not masked as “slots”

**Location:** `packages/shared/src/letter-hint-progression.ts` — `isAlphabeticHintChar` (`^[A-Za-z]$`), consumed by `buildMaskedWord`.

**Problem:** Code units matching neither `[A-Za-z]` nor “space/non-letter handling” stay verbatim from tick 0. For words containing letters outside Basic Latin (accents, many scripts), those characters may be revealed immediately while Latin letters stay underscored, which weakens fairness vs “masked start for multi-letter words” and can leak target language/shape earlier than intended.

**Fix:** Narrow scope explicitly in docs/word list validation (ASCII-only words), or extend hint logic to Unicode letter classes (e.g. `\p{L}` if project policy allows) with tests for accented words.

---

## Low

### LO-01: No `serializeServerEvent` golden round-trip for `letterHint`

**Location:** `packages/shared/src/schemas.test.ts` — `letterHint` test uses `safeParse` only (~123–132).

**Problem:** AC3 expects serialize/parse paths to stay valid. `serializeServerEvent` is `JSON.stringify(serverEventSchema.parse(event))`; one regression could break outbound validation without touching `safeParse` tests.

**Fix:** Add a test that builds a typed `letterHint` object, passes `serializeServerEvent`, then `JSON.parse` + `safeParseServerEvent`, expecting equality.

### LO-02: Duplicate `letterHint` events append duplicate rows

**Location:** `use-host-create-room.ts` / `use-guest-join-room.ts` — `letterHint` handlers (~267–288 / ~255–276).

**Problem:** Append-only `[...prev.letterHints, newRow]` never dedupes `(matchRoundIndex, hintIndex)`. A duplicate delivery would duplicate UI rows (unlikely today; possible with transport quirks).

**Fix:** Replace last row for same `(matchRoundIndex, hintIndex)` or skip if already present.

### LO-03: Hint scheduling uses only wall-clock timers (no immediate first tick)

**Location:** `room-manager.ts` `scheduleLetterHints` — first `emitAt(0)` schedules after `tickMs`.

**Problem:** Strict reading of AC1 could expect a hint aligned to “enters drawing”; implementation delays the first masked snapshot by one full interval (integration test advances `resolveHintTickMs()` before asserting). Functional but worth confirming against product expectation.

**Fix:** If product wants an Opening snapshot at t=0: emit masked word synchronously inside `lockWordAndBeginDrawing`, then chain intervals for further ticks (adjust `totalLetterHintEmissions` / sequencing accordingly).

### LO-04: No presentational/unit test for `LetterHintFeed` in web package

**Location:** `apps/web` tests (grep: no matches for `LetterHint` / `letterHint`).

**Problem:** Story AC7 allows optional web tests; zero coverage means regressions in hide-for-drawer or rendering only caught manually.

**Fix:** Lightweight component test (`showGuessersOnly` + drawer hides; guest visible) if CI budget allows.

---

## Suggestions

### SG-01: `letterHintTimerHandles` growth during a round

**Location:** `room.ts` / `scheduleLetterHints` (`room-manager.ts`).

Filled timers remain in `letterHintTimerHandles` until phase clear; harmless for bounded rounds. Optional: splice or track single pending handle only to reduce noise in debugging.

### SG-02: Exhaustive `ServerEvent` switch

**Location:** `use-host-create-room.ts` / `use-guest-join-room.ts`.

`default: { const _exhaustive: never = parsed.data }` is correct for compile-time exhaustiveness when `parsed.data` is narrowed after cases; good practice.

---

_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
