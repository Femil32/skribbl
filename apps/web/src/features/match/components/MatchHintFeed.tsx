"use client";

import type { MatchHintFeedRow } from "@/features/lobby/lib/drawing-hint-rows";

export type { MatchHintFeedRow } from "@/features/lobby/lib/drawing-hint-rows";

type MatchHintFeedProps = {
  rows: readonly MatchHintFeedRow[];
  /** Story 2.5: mute hint noise for the drawer (`localPlayerId === drawerPlayerId`). */
  suppressForDrawer?: boolean;
};

/** UX-DR18: muted system rows, “Hint” prefix, tabular numbers for ticks. */
export function MatchHintFeed({ rows, suppressForDrawer }: MatchHintFeedProps) {
  if (suppressForDrawer || rows.length === 0) return null;

  return (
    <section
      data-testid="match-hint-feed"
      aria-label="Progressive letter hints"
      className="rounded-lg border border-base-300 bg-base-200/40 px-3 py-2 text-left"
    >
      <header className="text-[0.65rem] font-semibold uppercase tracking-wide text-base-content/45">
        Hint
      </header>
      <ul className="mt-1.5 flex max-h-40 flex-col gap-1 overflow-y-auto" role="list">
        {rows.map((row) => (
          <li
            key={`${String(row.hintIndex)}:${row.maskedWord}`}
            data-testid={`drawing-hint-row-${String(row.hintIndex)}`}
            className="flex flex-wrap items-baseline gap-x-2 rounded-md bg-base-100/35 px-2 py-1 text-sm text-base-content/75"
          >
            <span className="shrink-0 text-xs font-medium text-base-content/45">Hint</span>
            <span className="tabular-nums text-xs font-medium text-base-content/50">
              #{String(row.hintIndex + 1)}
            </span>
            <span className="min-w-0 flex-1 break-all font-mono tabular-nums tracking-wide">
              {row.maskedWord}
            </span>
            <span className="tabular-nums text-[0.7rem] text-base-content/40">
              <span>{String(row.revealedLetterCount)}</span>
              <span aria-hidden>/</span>
              <span>{String(row.totalLetters)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
