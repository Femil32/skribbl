"use client";

import type { LobbyRosterPlayer } from "@skribbl/shared";
import { avatarPresets, type AvatarPresetId } from "@skribbl/shared";
import { sortPlayersByFinalScore } from "@/features/match/lib/sort-players-by-final-score";

export type ScoreboardSummaryProps = {
  players: LobbyRosterPlayer[];
  localPlayerId: string;
  /** Host sees primary Play again; guests see secondary hint only. */
  isHost: boolean;
  onPlayAgain?: () => void;
  playAgainDisabled?: boolean;
};

function presetLabel(id: AvatarPresetId): string {
  return avatarPresets.find((p) => p.id === id)?.label ?? id;
}

/**
 * Post-match ordered leaderboard (UX-DR10). Rankings come from server roster only.
 */
export function ScoreboardSummary({
  players,
  localPlayerId,
  isHost,
  onPlayAgain,
  playAgainDisabled = false,
}: ScoreboardSummaryProps) {
  const sorted = sortPlayersByFinalScore(players);
  const topScore = sorted[0] !== undefined ? (sorted[0].score ?? 0) : 0;
  const leaderIds = new Set(
    sorted.filter((p) => (p.score ?? 0) === topScore).map((p) => p.playerId),
  );
  const tieAtTop = leaderIds.size > 1;
  const headline = tieAtTop ? "It's a tie!" : sorted.length > 0 ? "Winner" : "Final scores";

  return (
    <div
      data-testid="scoreboard-summary"
      className="flex flex-col gap-4 w-full max-w-md mx-auto"
    >
      <div className="card bg-base-200 border border-base-300 shadow-sm">
        <div className="card-body gap-1 py-4">
          <h2 className="card-title text-lg text-base-content">{headline}</h2>
          {tieAtTop ? (
            <p className="text-sm text-base-content/70">Same top score — shared champs.</p>
          ) : sorted[0] ? (
            <p className="text-sm text-base-content/70">
              <span className="font-semibold text-primary">{sorted[0].displayName}</span>
              {" wins the match."}
            </p>
          ) : null}
        </div>
      </div>

      <ol className="flex flex-col gap-3 list-none m-0 p-0" aria-label="Final scores">
        {sorted.map((p, index) => {
          const rank = index + 1;
          const isLeaderRow = leaderIds.has(p.playerId);
          const emphasis =
            isLeaderRow && !tieAtTop
              ? "border-primary bg-primary/10 shadow-md"
              : isLeaderRow && tieAtTop
                ? "border-secondary bg-secondary/10"
                : "border-base-300 bg-base-100";
          const rowLabel = `Rank ${String(rank)} of ${String(sorted.length)}, ${p.displayName}, score ${String(p.score ?? 0)}`;
          return (
            <li key={p.playerId} aria-label={rowLabel}>
              <div
                className={`card border-2 ${emphasis} shadow-sm`}
                data-testid={`scoreboard-row-${p.playerId}`}
              >
                <div className="card-body flex-row items-center gap-4 py-3 px-4">
                  <span
                    className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-base-300 bg-linear-to-br from-primary/30 to-secondary/40 tabular-nums text-sm font-semibold text-base-content/90"
                    aria-hidden
                  >
                    {String(rank)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold truncate">{p.displayName}</span>
                      {p.playerId === localPlayerId ? (
                        <span className="badge badge-ghost badge-sm">You</span>
                      ) : null}
                      {p.isHost ? <span className="badge badge-primary badge-sm">Host</span> : null}
                    </div>
                    <span className="text-xs text-base-content/60">
                      {presetLabel(p.avatarPresetId)}
                    </span>
                  </div>
                  <span className="shrink-0 text-xl font-bold tabular-nums text-base-content">
                    {p.score ?? 0}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2 items-stretch">
        {isHost ? (
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={playAgainDisabled || !onPlayAgain}
            onClick={() => onPlayAgain?.()}
          >
            Play again
          </button>
        ) : (
          <p className="text-sm text-center text-base-content/70">
            Only the host can start a new match.
          </p>
        )}
      </div>
    </div>
  );
}
