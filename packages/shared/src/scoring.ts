/**
 * Same elapsed normalization and clamp `[0, roundMs]` applied inside {@link computeGuesserPoints}
 * (excluding invalid `roundMs` — then scoring uses `minPts` fallback and this returns `0`).
 */
export function clampGuessElapsedMs(elapsedMs: number, roundMs: number): number {
  if (!Number.isFinite(roundMs) || roundMs <= 0) return 0;
  let e = elapsedMs;
  if (!Number.isFinite(e)) {
    e = Object.is(e, Number.POSITIVE_INFINITY) ? roundMs : 0;
  }
  return Math.max(0, Math.min(e, roundMs));
}

/**
 * Pure guesser score from elapsed drawing time (FR10). Linear decay from `maxPts` (elapsed 0) to `minPts` (elapsed ≥ round length).
 */
export function computeGuesserPoints(
  elapsedMs: number,
  roundMs: number,
  maxPts: number,
  minPts: number,
): number {
  const hi = Math.max(maxPts, minPts);
  const lo = Math.min(maxPts, minPts);
  if (!Number.isFinite(roundMs) || roundMs <= 0) return Math.round(lo);

  const clampedElapsed = clampGuessElapsedMs(elapsedMs, roundMs);
  const span = hi - lo;
  const interpolated = hi - span * (clampedElapsed / roundMs);
  return Math.round(Math.max(lo, Math.min(hi, interpolated)));
}
