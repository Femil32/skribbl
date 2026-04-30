/**
 * Progressive letter hints (Story 2.5) — pure helpers for mask building + deterministic ordering.
 *
 * Replacement character for unrevealed **alphabetic** slots: ● (BLACK CIRCLE, U+25CF).
 * Spaces are always visible; punctuation/non-letter non-space characters stay visible as separators.
 */

/** Visible placeholder for unrevealed A–Z / a–z positions (safe UI glyph). */
export const HINT_MASK_CHAR = "\u25CF";

const LETTER = /^[a-zA-Z]$/;

/**
 * Indices of ASCII letters only (`A–Z` / `a–z`), per Epic 4 MVP guess alphabet.
 * Non-ASCII letters (e.g. accented) are not hinted and stay visible in the mask.
 */
export function eligibleLetterIndices(secret: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < secret.length; i++) {
    const c = secret[i]!;
    if (LETTER.test(c)) out.push(i);
  }
  return out;
}

/**
 * Deterministic RNG (mulberry32) from a numeric seed derived from UTF-16 string entropy.
 */
function hashSeedString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function next() {
    t = (t + 0x6d2b79f5) >>> 0;
    let z = t;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher–Yates shuffle using deterministic PRNG (`mulberry32` from `seedString`).
 * Server uses `hintRevealOrderSeed({ roomId, matchRoundIndex, secret })`.
 */
export function shuffleIndicesDeterministic(indices: readonly number[], seedString: string): number[] {
  const copy = [...indices];
  const rand = mulberry32(hashSeedString(seedString));
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

/** Stable concatenation inputs for seeded hint reveal order — document in Story 2.5. */
export function hintRevealOrderSeed(opts: {
  roomId: string;
  matchRoundIndex: number;
  secretWord: string;
}): string {
  const normalized = opts.secretWord.trim().toLowerCase();
  return `${opts.roomId}:${String(opts.matchRoundIndex)}:${normalized}`;
}

/**
 * Builds the masked preview: letters unrevealed → {@link HINT_MASK_CHAR}; spaces always shown;
 * other chars (digits, punctuation) shown verbatim.
 */
export function buildMaskedWord(secret: string, revealedLetterPositions: ReadonlySet<number>): string {
  let out = "";
  for (let i = 0; i < secret.length; i++) {
    const c = secret[i]!;
    if (c === " ") {
      out += " ";
      continue;
    }
    if (LETTER.test(c)) {
      out += revealedLetterPositions.has(i) ? c : HINT_MASK_CHAR;
      continue;
    }
    out += c;
  }
  return out;
}

export function computeTotalLetters(secret: string): number {
  return eligibleLetterIndices(secret).length;
}
