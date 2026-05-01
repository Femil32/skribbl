import type { CanvasReplayEvent } from "@skribbl/shared";
import { MAX_CANVAS_OPS_PER_DRAWING_PHASE } from "@skribbl/shared";

export type CanvasAppendFailureCode = "CANVAS_OP_LOG_GAP" | "CANVAS_OP_LOG_OVERFLOW";

/** Authoritative ordered buffer for one drawing phase (Story 5.2). */
export class CanvasPhaseLog {
  private readonly commits: CanvasReplayEvent[] = [];

  reset(): void {
    this.commits.length = 0;
  }

  snapshot(): readonly CanvasReplayEvent[] {
    return this.commits;
  }

  /**
   * Persist after the server incremented **`seq`** and built the **`CanvasReplayEvent`**. Fails closed on
   * overflow or accidental non-contiguous assignment (bugs must surface as hydrate / resync errors).
   */
  tryAppend(commit: CanvasReplayEvent): { ok: true } | { ok: false; code: CanvasAppendFailureCode } {
    if (this.commits.length >= MAX_CANVAS_OPS_PER_DRAWING_PHASE) {
      return { ok: false, code: "CANVAS_OP_LOG_OVERFLOW" };
    }
    const expectedSeq = this.commits.length + 1;
    if (commit.seq !== expectedSeq) {
      return { ok: false, code: "CANVAS_OP_LOG_GAP" };
    }
    this.commits.push(commit);
    return { ok: true };
  }

  verifyAgainstWatermark(seqWatermark: number): { ok: true } | { ok: false; code: "CANVAS_OP_LOG_GAP" } {
    if (seqWatermark === 0) {
      if (this.commits.length !== 0) return { ok: false, code: "CANVAS_OP_LOG_GAP" };
      return { ok: true };
    }
    if (this.commits.length !== seqWatermark) return { ok: false, code: "CANVAS_OP_LOG_GAP" };
    for (let i = 0; i < this.commits.length; i++) {
      if (this.commits[i]?.seq !== i + 1) return { ok: false, code: "CANVAS_OP_LOG_GAP" };
    }
    return { ok: true };
  }
}
