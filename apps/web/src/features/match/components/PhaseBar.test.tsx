import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LobbyRosterPlayer } from "@skribbl/shared";
import { PhaseBar } from "./PhaseBar";

const samplePlayer = (partial: Partial<LobbyRosterPlayer>): LobbyRosterPlayer => ({
  playerId: "p1",
  displayName: "Tester",
  avatarPresetId: "preset-1",
  isHost: true,
  score: 0,
  connectionStatus: "connected",
  ...partial,
});

describe("PhaseBar", () => {
  it("exposes stable phase-bar hook on match-ended card", () => {
    render(<PhaseBar phase="matchEnded" players={[]} />);
    const bar = screen.getByTestId("phase-bar");
    expect(bar).toBeTruthy();
    expect(bar).toHaveTextContent(/match complete/i);
  });

  it("exposes stable phase-bar hook when displaying active match summary", () => {
    render(
      <PhaseBar
        phase="drawing"
        players={[samplePlayer({ playerId: "d1", displayName: "Drawer" })]}
        localPlayerId="d1"
        drawerPlayerId="d1"
        matchRoundIndex={0}
        phaseDeadlineMs={Date.now() + 60_000}
      />,
    );
    expect(screen.getByTestId("phase-bar")).toBeTruthy();
  });
});
