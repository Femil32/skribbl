---
status: remediated
scope: story-3-5-bmad
depth: standard
files_reviewed: 9
critical: 0
warning: 0
info: 5
total: 5
generated: 2026-04-30
remediated: 2026-04-30
note: "WR-01, WR-02, IF-02 fixed in codebase. Body below retains original review wording for history."
---

# Code review: Story 3.5 — Palette & brush sizing toolbar

## Summary

Implementation aligns with acceptance criteria: toolbar is drawer-only during `drawing`, uses `aria-pressed`, normalizes hex on **toolbar** interactions, lifts brush state in host/guest/dev shells, integrates `MatchDrawingColumn`, and buffers `drawingStrokeCommitted` with drawer self-skip in `DrawingCanvas`. No critical security or protocol-breaking issues found in the reviewed files.

## Findings

### WR-01 — Lifted `brushColor` is not normalized at the canvas boundary

**Where:** `LobbyHostPage.tsx`, `JoinRoomClient.tsx`, `MatchDrawingColumn.tsx` → `DrawingCanvas`  
**Problem:** `DrawingToolbar.normalizeStrokeHex` only runs inside the toolbar UI. `setBrushColor` / `setBrushWidthPx` accept any string/number from React state. Future or mistaken callers could set a non-`#RRGGBB` value; `DrawingCanvas` flushes `brushColor` verbatim into `drawingStrokeChunk`, risking server `error` / rejects (AC3).  
**Fix (pick one):** Normalize and clamp in `MatchDrawingColumn` before passing to `DrawingCanvas`, or validate/normalize in `DrawingCanvas` when building the batch.

### WR-02 — `remoteStrokeCommits` grows without cap for the whole match

**Where:** `use-host-create-room.ts`, `use-guest-join-room.ts` (append on each `drawingStrokeCommitted`)  
**Problem:** Long rounds with dense strokes could grow the array without an upper bound (memory / main-thread churn when spreading `[...prev.remoteStrokeCommits, strokeEv]`). Unlikely in early playtests but unbounded.  
**Fix:** Optional cap with drop-oldest or rely on server chunking; document as NFR if deferred.

### IF-01 — Silent fallback for invalid `brushColor` in toolbar only affects display/selection

**Where:** `DrawingToolbar.tsx` (`normalizeStrokeHex`)  
**Detail:** Invalid hex maps to first preset for **comparison** and child callback on **click** paths; if parent state were ever invalid, pressed state could mismatch until user clicks. Low risk with current-only toolbar updates.

### IF-02 — Brush width change not covered by unit test

**Where:** `DrawingToolbar.test.tsx`  
**Detail:** Color callback + `aria-pressed` are tested; width click handler is not. Small coverage gap.

### IF-03 — `remoteWatermarkRef` reset on mount only (`[]`)

**Where:** `DrawingCanvas.tsx`  
**Detail:** Round remount via `MatchDrawingColumn` `key` avoids stale watermark; if `remoteCommitted` were ever reset without remounting, edge cases could exist. Current lobby hooks clear + round key reduce risk.

### IF-04 — `sendJsonLine` swallow on host/guest

**Where:** `use-host-create-room.ts`, `use-guest-join-room.ts`  
**Detail:** `send` errors are ignored (reasonable for resilience); optional debug/hook for diagnostics.

### IF-05 — Dev `GamePage` noop transport

**Where:** `GamePage.tsx`  
**Detail:** Intentional local-only ink; comment already notes no WebSocket — acceptable for dev scaffold.

## Positive notes

- Exhaustive `switch` on parsed server events in both hooks.  
- Drawer skip for own commits: `DrawingCanvas` `evt.senderPlayerId === localId` ✓  
- `remoteStrokeCommits` cleared on `lobby` and on `matchRoundIndex` change ✓  
- Preset widths (2–24) and default 4 satisfy shared schema `1–96` ✓  
- Guessers get a short hint when `phase === "drawing"` && `!isDrawer` ✓  

## Suggested next steps

1. Add normalization (or Zod parse) for outbound stroke color/`lineWidthPx` at a single boundary (WR-01).  
2. Decide on buffer cap or document deferred (WR-02).  
3. Optional: one RTL test for brush width change (IF-02).

---

_Report path:_ `_bmad-output/implementation-artifacts/3-5-palette-brush-sizing-toolbar-REVIEW.md`
