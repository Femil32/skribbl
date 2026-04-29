import type { LobbyRosterPlayer } from "@skribbl/shared";

export type PhaseBarProps = {
  players: LobbyRosterPlayer[];
  drawerPlayerId?: string;
  matchRoundIndex?: number;
};

function resolveDrawerName(
  players: LobbyRosterPlayer[],
  drawerPlayerId: string | undefined,
): string | undefined {
  if (!drawerPlayerId) return undefined;
  return players.find((p) => p.playerId === drawerPlayerId)?.displayName;
}

/**
 * Match rhythm summary — round index + current drawer (Story 2.2, UX-DR8 partial).
 */
export function PhaseBar({ players, drawerPlayerId, matchRoundIndex }: PhaseBarProps) {
  const drawerName = resolveDrawerName(players, drawerPlayerId);
  if (matchRoundIndex === undefined && !drawerName) return null;

  return (
    <div
      className="rounded-box border border-base-300 bg-base-200 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 shadow-sm"
      role="status"
      aria-live="polite"
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
  );
}
