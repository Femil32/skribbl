import { describe, expect, it } from "vitest";
import type { LobbyRosterPlayer } from "@skribbl/shared";
import { sortPlayersByFinalScore } from "./sort-players-by-final-score";

function row(
  partial: Pick<LobbyRosterPlayer, "playerId" | "displayName" | "score"> &
    Partial<Omit<LobbyRosterPlayer, "playerId" | "displayName" | "score">>,
): LobbyRosterPlayer {
  return {
    avatarPresetId: "preset-1",
    isHost: false,
    connectionStatus: "connected",
    ...partial,
  };
}

describe("sortPlayersByFinalScore", () => {
  it("orders by score descending then playerId", () => {
    const a = row({ playerId: "b-id", displayName: "B", score: 10 });
    const c = row({ playerId: "c-id", displayName: "C", score: 10 });
    const d = row({ playerId: "a-id", displayName: "A", score: 50 });
    const sorted = sortPlayersByFinalScore([a, c, d]);
    expect(sorted.map((p) => p.playerId)).toEqual(["a-id", "b-id", "c-id"]);
  });
});
