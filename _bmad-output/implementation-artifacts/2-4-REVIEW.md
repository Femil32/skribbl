---
status: resolved
story_file: "_bmad-output/implementation-artifacts/2-4-drawing-phase-countdown-timer-driven-round-end.md"
depth: standard
files_reviewed: 12
critical: 0
warning: 0
info: 0
total: 0
---

# Code review: Story 2.4 — Drawing phase countdown & timer-driven round end

**Update:** Findings from the initial review were addressed in code (single `roundMs` / `wordChoiceMs` capture on the server; `PhaseBar` shows countdown when `phaseDeadlineMs` exists without requiring `matchRoundIndex`; `aria-live` scoped to round/drawer with `role="timer"` + `aria-live="off"` on the chip; dark-scheme overrides for `--color-timer-*`).

---

## Original findings (fixed)

| Id | Topic | Resolution |
|----|--------|------------|
| IN-01 | Duplicate `resolve*Ms()` for broadcast vs timer | `lockWordAndBeginDrawing`: `roundMs` + `drawingEndsAt`; word-choice branch: `wordChoiceMs` + `choiceDeadline`; `setTimeout` uses same captured duration. |
| IN-02 | Timer hidden without `matchRoundIndex` | `showTimer` no longer gates on round index; `chipResetKey` uses `matchRoundIndex ?? "—"`. |
| IN-03 | `aria-live` + 1 Hz countdown | Outer bar is neutral; `role="status"` / `aria-live="polite"` only on round + drawer group; timer wrapper `aria-live="off"`; chip `role="timer"` with `aria-valuenow` / min / max. |
| IN-04 | Dark mode timer contrast | Brighter `--color-timer-*` OKLCH stops under `prefers-color-scheme: dark`. |

---

Full report: earlier pass documented 4 informational items; codebase updated to close them.
