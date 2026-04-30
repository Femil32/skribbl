---
title: 'Fix remote stroke chunk continuity (smooth lines for observers)'
type: bugfix
created: '2026-04-30'
status: done
route: one-shot
---

# Fix remote stroke chunk continuity (smooth lines for observers)

## Intent

**Problem:** Observers saw dashed, fragmented lines while the drawer saw smooth strokes, because each batched `drawingStrokeCommitted` and eraser chunk was drawn as its own polyline with no segment linking one flush window to the next.

**Approach:** Keep a per-`strokeId` last point for brush and eraser on the receiving client, prepend it to the next chunk’s points before `stroke()`, and clear those maps when the replay buffer is empty, the canvas is cleared, or the bitmap is resized so full repaint stays consistent.

## Suggested Review Order

- Remote replay now bridges brush chunks using shared tail state per stroke.
  [`DrawingCanvas.tsx:318`](../../apps/web/src/features/game/canvas/DrawingCanvas.tsx#L318)

- Server `clear` and local resize reset tails so redraws do not stitch across rounds.
  [`DrawingCanvas.tsx:335`](../../apps/web/src/features/game/canvas/DrawingCanvas.tsx#L335)

- Eraser chunks use the same bridging helper with a separate tail map.
  [`DrawingCanvas.tsx:342`](../../apps/web/src/features/game/canvas/DrawingCanvas.tsx#L342)

- Pure merge helper and unit tests for chunk sequences.
  [`remote-chunk-bridge.ts:1`](../../apps/web/src/features/game/canvas/remote-chunk-bridge.ts#L1)

- Regression coverage for two-chunk continuity and independent stroke IDs.
  [`remote-chunk-bridge.test.ts:1`](../../apps/web/src/features/game/canvas/remote-chunk-bridge.test.ts#L1)
