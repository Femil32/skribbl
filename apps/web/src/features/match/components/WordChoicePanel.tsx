"use client";

export type WordChoicePanelProps = {
  words: readonly [string, string, string] | null;
  isLoading: boolean;
  errorMessage: string | null;
  onPick: (index: 0 | 1 | 2) => void;
  disabled?: boolean;
};

/**
 * Drawer-only word pick (Story 2.3, UX-DR6). Guessers must not mount this with secret words.
 */
export function WordChoicePanel({
  words,
  isLoading,
  errorMessage,
  onPick,
  disabled,
}: WordChoicePanelProps) {
  return (
    <section
      className="rounded-box border border-primary/30 bg-base-200/80 px-4 py-4 shadow-sm"
      data-testid="word-choice-panel"
      aria-label="Choose a word to draw"
    >
      <h2 className="text-sm font-semibold text-base-content mb-3">Pick a word to draw</h2>
      {isLoading && !words ? (
        <div className="flex items-center gap-2 text-sm text-base-content/70">
          <span className="loading loading-spinner loading-sm text-primary" />
          Loading word choices…
        </div>
      ) : null}
      {words ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {words.map((label, index) => (
            <button
              key={`${String(index)}-${label}`}
              type="button"
              className="btn btn-outline btn-primary h-auto min-h-14 py-3 px-4 normal-case whitespace-normal"
              disabled={disabled}
              onClick={() => onPick(index as 0 | 1 | 2)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-warning" role="alert">
            {errorMessage}
          </p>
          {words ? (
            <span className="text-xs text-base-content/60">
              Tap a word above to try again.
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
