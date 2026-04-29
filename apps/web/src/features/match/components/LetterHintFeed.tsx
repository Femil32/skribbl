"use client";

export type LetterHintLine = Readonly<{
  hintIndex: number;
  maskedWord: string;
  matchRoundIndex: number;
}>;

type LetterHintFeedProps = {
  hints: readonly LetterHintLine[];
  /** Drawer already knows the word — hide feed until Epic chat column can host history (Story 2.5). */
  showGuessersOnly?: boolean;
  isCurrentDrawer?: boolean;
};

/**
 * Hint rows adjacent to PhaseBar shell (Story 2.5 / UX-DR18) — muted copy, distinct from future chat pipe.
 */
export function LetterHintFeed({
  hints,
  showGuessersOnly = false,
  isCurrentDrawer = false,
}: LetterHintFeedProps) {
  if (!hints.length || (showGuessersOnly && isCurrentDrawer)) return null;

  return (
    <aside
      className="w-full rounded-box border border-base-300/80 bg-base-200/60 px-3 py-2 text-left"
      aria-label="Letter hints"
    >
      <ul className="space-y-1.5">
        {hints.map((h, i) => (
          <li
            key={`${String(h.matchRoundIndex)}-${String(h.hintIndex)}-${String(i)}`}
            className="text-sm leading-snug tracking-wide font-mono text-base-content/70"
          >
            <span className="select-none text-base-content/50">Hint · </span>
            <span>{h.maskedWord}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
