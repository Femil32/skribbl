import type { LobbyRosterPlayer } from "@skribbl/shared";

/** Descending score; tie-break by `playerId` (matches server roster sort bias). */
export function sortPlayersByFinalScore(players: LobbyRosterPlayer[]): LobbyRosterPlayer[] {
  return [...players].sort((a, b) => {
    const ds = (b.score ?? 0) - (a.score ?? 0);
    if (ds !== 0) return ds;
    return a.playerId.localeCompare(b.playerId);
  });
}
