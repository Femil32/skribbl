import type { DrawingHintTick } from "@skribbl/shared";

export type MatchHintFeedRow = Pick<
  DrawingHintTick,
  "hintIndex" | "maskedWord" | "totalLetters" | "revealedLetterCount"
>;

/** Bounded hint history per round (Story 2.5). */
const MAX_HINT_FEED_ROWS = 96;

export function appendDrawingHintRows(
  prevRows: readonly MatchHintFeedRow[],
  row: MatchHintFeedRow,
): MatchHintFeedRow[] {
  const cap = Math.min(Math.max(row.totalLetters, 1), MAX_HINT_FEED_ROWS);
  return [...prevRows, row].slice(-cap);
}
