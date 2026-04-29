import type { LetterHintLine } from "@/features/match/components/LetterHintFeed";

/** Append a hint row or replace the row with the same `(matchRoundIndex, hintIndex)` (duplicate delivery). */
export function appendLetterHintDeduped(
  hints: readonly LetterHintLine[],
  row: LetterHintLine,
): LetterHintLine[] {
  const idx = hints.findIndex(
    (h) =>
      h.matchRoundIndex === row.matchRoundIndex && h.hintIndex === row.hintIndex,
  );
  if (idx === -1) return [...hints, row];
  const next = [...hints];
  next[idx] = row;
  return next;
}
