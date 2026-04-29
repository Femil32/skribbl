---
status: resolved
story_file: "_bmad-output/implementation-artifacts/2-6-score-rules-running-totals.md"
depth: standard
scope_note: "GSD phase-op not configured for this repo; scope = story Dev Agent File List (source only; sprint-status.yaml excluded)."
files_reviewed: 14
critical: 0
warning: 0
info: 0
total: 0
---

# Code review: Story 2.6 — Score rules & running totals

**Update (2026-04-29):** Previous findings addressed in code.

| Id | Resolution |
|----|-------------|
| WR-001 | Per-drawing-phase set `drawingPhaseAwardedGuesserIds`; second award for same guesser returns `ALREADY_AWARDED_THIS_DRAWING`; integration test asserts. |
| IN-001 | JSDoc on `applyCorrectGuessAward` documents server `Date.now()` preference vs client time. |
| IN-002 | `computeGuesserPoints(Number.NEGATIVE_INFINITY, …)` test added. |
| IN-003 | Happy-path env test for bracket + `DRAWER_ASSIST_PER_CORRECT` overrides. |

---

## Original review (archived)

<details>
<summary>Earlier report (4 findings)</summary>

Implementation met FR10 overall. Reported: duplicate-award risk (`applyCorrectGuessAward`), trust notes for `occurredAtMs`, optional tests for `NEGATIVE_INFINITY` and valid env overrides. All cleared as above.

</details>
