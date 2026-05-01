import { describe, expect, it } from "vitest";
import { MAX_CANVAS_OPS_PER_DRAWING_PHASE } from "@skribbl/shared";
import { CanvasPhaseLog } from "./canvas-log.js";

describe("CanvasPhaseLog", () => {
  it("rejects non-contiguous seq (fail closed)", () => {
    const log = new CanvasPhaseLog();
    const first = {
      type: "drawingStrokeCommitted" as const,
      roomId: "r1",
      seq: 1,
      senderPlayerId: "p1",
      strokeId: "s",
      chunkId: "c",
      points: [{ x: 0, y: 0 }],
      color: "#000000",
      lineWidthPx: 2,
    };
    expect(log.tryAppend(first)).toEqual({ ok: true });

    const skipSeq = {
      ...first,
      seq: 3,
      chunkId: "c2",
    };
    expect(log.tryAppend(skipSeq)).toEqual({ ok: false, code: "CANVAS_OP_LOG_GAP" });
  });

  it("rejects overflow once the buffer is at the hard cap", () => {
    const log = new CanvasPhaseLog();
    const base = {
      type: "drawingStrokeCommitted" as const,
      roomId: "r1",
      senderPlayerId: "p1",
      strokeId: "s",
      points: [{ x: 0, y: 0 }],
      color: "#000000",
      lineWidthPx: 2,
    };
    for (let seq = 1; seq <= MAX_CANVAS_OPS_PER_DRAWING_PHASE; seq++) {
      expect(log.tryAppend({ ...base, seq, chunkId: `c${seq}` })).toEqual({ ok: true });
    }
    expect(
      log.tryAppend({
        ...base,
        seq: MAX_CANVAS_OPS_PER_DRAWING_PHASE + 1,
        chunkId: "over",
      }),
    ).toEqual({ ok: false, code: "CANVAS_OP_LOG_OVERFLOW" });
  });
});
