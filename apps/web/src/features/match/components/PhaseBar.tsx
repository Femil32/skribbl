"use client";

import type { LobbyRosterPlayer, RoomPhase } from "@skribbl/shared";
import { PhaseCountdownChip } from "@/features/match/components/PhaseCountdownChip";

export type PhaseBarProps = {
  phase: RoomPhase;
  players: LobbyRosterPlayer[];
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
  return players.find((p) => p.playerId === drawerPlayerId)?.displayName;
}

function phaseShowsCountdownTimer(phase: RoomPhase): boolean {
  return phase === "choosingWord" || phase === "drawing";
}

/**
 * Match rhythm summary — round index + current drawer + server-driven countdown (Story 2.2, 2.4).
 */
export function PhaseBar({
  phase,
  players,
  drawerPlayerId,
  matchRoundIndex,
  phaseDeadlineMs,
}: PhaseBarProps) {
  const drawerName = resolveDrawerName(players, drawerPlayerId);
  const showTimer =
    phaseDeadlineMs !== undefined && phaseShowsCountdownTimer(phase);
  const chipResetKey = `${String(phase)}-${String(matchRoundIndex ?? "—")}-${String(phaseDeadlineMs)}`;

  if (matchRoundIndex === undefined && !drawerName && !showTimer) return null;

  return (
    <div className="rounded-box border border-base-300 bg-base-200 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 shadow-sm">
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
  );
}
