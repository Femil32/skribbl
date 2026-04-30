/** Defaults match `DrawingCanvas` production props and `drawingStrokeChunk` Zod bounds. */
export const DEFAULT_CLIENT_STROKE_COLOR = "#0f172a";
export const DEFAULT_CLIENT_LINE_WIDTH_PX = 4;
const LINE_WIDTH_MIN = 1;
const LINE_WIDTH_MAX = 96;

/**
 * Coerce any string to a valid `#rrggbb` for outbound `drawingStrokeChunk.color`
 * (see `drawingStrokeChunk` regex in schemas).
 */
export function normalizeClientStrokeColor(input: string): string {
  const t = input.trim();
  const m = /^#([\da-fA-F]{6})$/.exec(t);
  if (!m) return DEFAULT_CLIENT_STROKE_COLOR;
  return `#${m[1]!.toLowerCase()}`;
}

/** Clamp to `drawingStrokeChunk.lineWidthPx` bounds (1–96 inclusive). */
export function clampClientLineWidthPx(px: number): number {
  if (!Number.isFinite(px)) return DEFAULT_CLIENT_LINE_WIDTH_PX;
  return Math.min(LINE_WIDTH_MAX, Math.max(LINE_WIDTH_MIN, px));
}
