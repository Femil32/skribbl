import { render } from "@testing-library/react";
import type { LobbyRosterPlayer } from "@skribbl/shared";
import { describe, expect, it } from "vitest";
import { axe } from "../../../../vitest.setup";
import { LobbyPlayerRoster } from "./LobbyPlayerRoster";

const PLAYERS: LobbyRosterPlayer[] = [
  {
    playerId: "p1",
    displayName: "Alice",
    avatarPresetId: "preset-1",
    isHost: true,
    score: 0,
    connectionStatus: "connected",
  },
  {
    playerId: "p2",
    displayName: "Bob",
    avatarPresetId: "preset-2",
    isHost: false,
    score: 0,
    connectionStatus: "connected",
  },
];

describe("Lobby shell — axe smoke (AC #6)", () => {
  it("LobbyPlayerRoster (lobby shell component) has no critical axe violations", async () => {
    const { container } = render(
      <LobbyPlayerRoster
        players={PLAYERS}
        localPlayerId="p1"
        maxPlayers={8}
        accent="#22d3ee"
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
