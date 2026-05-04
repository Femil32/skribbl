/**
 * Server-authoritative "close guess" heuristic (Story 7.1). Uses Levenshtein distance on
 * {@link normalizeGuessText} outputs — callers must normalize both strings first.
 */

/** O(min(m,n) * maxDistance) early-exit Levenshtein; returns > maxDistance when not within bound. */
export function levenshteinDistanceBounded(
  a: string,
  b: string,
  maxDistance: number,
): number {
  if (a === b) return 0;
  if (maxDistance < 0) return Number.POSITIVE_INFINITY;
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > maxDistance) return maxDistance + 1;

  let prev = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    const cur = new Array<number>(n + 1);
    cur[0] = i;
    let rowMin = cur[0]!;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
      if (cur[j]! < rowMin) rowMin = cur[j]!;
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    prev = cur;
  }
  return prev[n]!;
}

export type CloseGuessHeuristicOptions = {
  /** Minimum secret length (after normalize) to evaluate closeness. */
  minSecretLength: number;
  /** Reject when |len(guess) − len(secret)| exceeds this (wild divergence guard). */
  maxLengthDelta: number;
  /** Inclusive upper bound on edit distance to count as "close". */
  maxEditDistance: number;
  /** Distances in [1, veryCloseMaxDistance] use the "very close" copy tier on the server. */
  veryCloseMaxDistance: number;
};

export type CloseGuessTier = "none" | "veryClose" | "close";

/**
 * @returns `"none"` for exact match, non-close strings, or inputs that fail length guards.
 */
export function evaluateCloseGuessTier(
  normalizedGuess: string,
  normalizedSecret: string,
  opts: CloseGuessHeuristicOptions,
): CloseGuessTier {
  if (normalizedSecret.length < opts.minSecretLength) return "none";
  if (normalizedGuess.length === 0) return "none";
  if (Math.abs(normalizedGuess.length - normalizedSecret.length) > opts.maxLengthDelta) {
    return "none";
  }

  const dist = levenshteinDistanceBounded(
    normalizedGuess,
    normalizedSecret,
    opts.maxEditDistance,
  );
  if (dist === 0) return "none";
  if (dist > opts.maxEditDistance) return "none";
  if (dist <= opts.veryCloseMaxDistance) return "veryClose";
  return "close";
}
