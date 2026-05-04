"use client";

import { isMatchFlowPhase, type LobbyRosterPlayer, type RoomPhase } from "@skribbl/shared";
import { PhaseCountdownChip } from "@/features/match/components/PhaseCountdownChip";
import { sortPlayersByFinalScore } from "@/features/match/lib/sort-players-by-final-score";

export type PhaseBarProps = {
  phase: RoomPhase;
  players: LobbyRosterPlayer[];
  /** When set during match phases, PhaseBar surfaces your score and leader (Story 2.6). */
  localPlayerId?: string;
  drawerPlayerId?: string;
  matchRoundIndex?: number;
  /** Authoritative UX deadline from `matchPhase.phaseDeadlineMs` (Story 2.4). */
  phaseDeadlineMs?: number;
};

function resolveDrawerName(
  players: LobbyRosterPlayer[],
  drawerPlayerId: string | undefined,
): string | undefined {
  if (!drawerPlayerId) return undefined;
  const row = players.find((p) => p.playerId === drawerPlayerId);
  if (!row) return undefined;
  const away = (row.connectionStatus ?? "connected") === "disconnected";
  return away ? `${row.displayName} (away)` : row.displayName;
}

function resolveLeaderChip(players: LobbyRosterPlayer[]): {
  displayName: string;
  score: number;
} | null {
  if (players.length === 0) return null;
  const top = sortPlayersByFinalScore(players)[0]!;
  const away = (top.connectionStatus ?? "connected") === "disconnected";
  return {
    displayName: away ? `${top.displayName} (away)` : top.displayName,
    score: top.score ?? 0,
  };
}

function phaseShowsCountdownTimer(phase: RoomPhase): boolean {
  return phase === "choosingWord" || phase === "drawing";
}

/**
 * Match rhythm summary — round index + current drawer + server-driven countdown (Story 2.2, 2.4) + totals (Story 2.6).
 */
export function PhaseBar({
  phase,
  players,
  localPlayerId,
  drawerPlayerId,
  matchRoundIndex,
  phaseDeadlineMs,
}: PhaseBarProps) {
  if (phase === "matchEnded") {
    return (
      <div
        role="region"
        aria-label="Match status"
        className="rounded-box border border-base-300 bg-base-200 px-4 py-3 shadow-sm"
      >
        <div role="status" aria-live="polite" className="text-sm font-medium text-base-content/80">
          Match complete
        </div>
      </div>
    );
  }

  const drawerName = resolveDrawerName(players, drawerPlayerId);
  const showTimer =
    phaseDeadlineMs !== undefined && phaseShowsCountdownTimer(phase);
  const chipResetKey = `${String(phase)}-${String(matchRoundIndex ?? "—")}-${String(phaseDeadlineMs)}`;

  const myScore =
    localPlayerId !== undefined
      ? (players.find((p) => p.playerId === localPlayerId)?.score ?? 0)
      : undefined;
  const scoreStripVisible =
    localPlayerId !== undefined && isMatchFlowPhase(phase) && players.length > 0;
  const leader = scoreStripVisible ? resolveLeaderChip(players) : null;

  const hasMainRow =
    matchRoundIndex !== undefined || Boolean(drawerName) || Boolean(showTimer);
  const hasScoreStrip = scoreStripVisible;
  if (!hasMainRow && !hasScoreStrip) return null;

  return (
    <div
      role="region"
      aria-label="Match status"
      className="rounded-box border border-base-300 bg-base-200 px-4 py-3 flex flex-col gap-y-3 shadow-sm"
    >
      {hasMainRow ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div
            role="status"
            aria-live="polite"
            className="flex flex-wrap items-center gap-x-6 gap-y-2"
          >
            <span className="text-sm font-medium text-base-content/80 tabular-nums">
              Round{" "}
              <span className="text-base-content font-semibold">
                {matchRoundIndex !== undefined ? String(matchRoundIndex + 1) : "—"}
              </span>
            </span>
            {drawerName ? (
              <span className="text-sm text-base-content">
                Drawer:{" "}
                <span className="font-semibold text-primary">{drawerName}</span>
              </span>
            ) : null}
          </div>
          {showTimer ? (
            <span
              className="inline-flex items-center gap-2 text-sm text-base-content/90"
              aria-live="off"
            >
              <span className="hidden sm:inline">Time</span>
              <PhaseCountdownChip
                key={`phasebar-${chipResetKey}`}
                resetKey={chipResetKey}
                deadlineMs={phaseDeadlineMs}
                data-testid="phase-bar-timer"
              />
            </span>
          ) : null}
        </div>
      ) : null}
      {scoreStripVisible ? (
        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm border-t border-base-300 pt-3"
          role="status"
          aria-live="polite"
        >
          <span className="tabular-nums text-base-content">
            You:{" "}
            <span className="font-semibold tabular-nums">{String(myScore)}</span>
          </span>
          {leader ? (
            <span className="text-base-content/90 tabular-nums">
              Leader:{" "}
              <span className="font-medium">{leader.displayName}</span>
              {" — "}
              <span className="font-semibold tabular-nums">{String(leader.score)}</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
