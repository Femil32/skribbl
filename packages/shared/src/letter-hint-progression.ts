/**
 * Deterministic progressive letter hints (Story 2.5): same inputs → same masks on every client.
 * Letter slots use Unicode `\p{L}` (any script); punctuation, digits, spaces, etc. stay verbatim from tick 0.
 */

const LETTER_RE = /\p{L}/u;

/**
 * True if `char` is exactly one user-perceived character and that character is a Unicode letter.
 */
export function isAlphabeticHintChar(char: string): boolean {
  return char.length > 0 && [...char].length === 1 && LETTER_RE.test(char);
}

function forEachCodePointStart(
  secret: string,
  fn: (startIndex: number, char: string) => void,
): void {
  for (let i = 0; i < secret.length; ) {
    const cp = secret.codePointAt(i)!;
    const c = String.fromCodePoint(cp);
    fn(i, c);
    i += c.length;
  }
}

/** UTF-16 start indices of letter code points in presentation order (reveal uses this order). */
export function hintLetterIndices(secret: string): readonly number[] {
  const out: number[] = [];
  forEachCodePointStart(secret, (i, c) => {
    if (isAlphabeticHintChar(c)) out.push(i);
  });
  return out;
}

export function countLetterSlots(secret: string): number {
  return hintLetterIndices(secret).length;
}

/** How many **`letterHint`** emissions for this secret (hintIndex is 0..total-1). */
export function totalLetterHintEmissions(secret: string): number {
  const L = countLetterSlots(secret);
  if (L <= 1) return 1;
  return L + 1;
}

/**
 * Letter slots revealed after the given **`hintIndex`** emission (Story 2.5).
 * Single-letter secrets: reveal on first (and only) tick. Multi-letter: hint 0 shows no letters unless L===1.
 */
export function lettersRevealedAfterHint(hintIndex: number, secret: string): number {
  const L = countLetterSlots(secret);
  if (L === 0) return 0;
  if (L === 1) return 1;
  return Math.min(hintIndex, L);
}

export function buildMaskedWord(secret: string, lettersRevealed: number): string {
  const indices = hintLetterIndices(secret);
  const cap = Math.min(Math.max(0, lettersRevealed), indices.length);
  const revealedSet = new Set(indices.slice(0, cap));
  let out = "";
  forEachCodePointStart(secret, (i, c) => {
    if (isAlphabeticHintChar(c)) out += revealedSet.has(i) ? c : "_";
    else out += c;
  });
  return out;
}

/** `maskedWord` payload for **`letterHint`** event at **`hintIndex`**. */
export function maskedWordAtLetterHintIndex(hintIndex: number, secret: string): string {
  const revealed = lettersRevealedAfterHint(hintIndex, secret);
  return buildMaskedWord(secret, revealed);
}
