import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RoomPhase } from "@skribbl/shared";
import { MatchChatPanel } from "@/features/match/components/MatchChatPanel";
import { PhaseBar } from "@/features/match/components/PhaseBar";
import { WordChoicePanel } from "@/features/match/components/WordChoicePanel";

describe("match shell landmarks (Story 6.4)", () => {
  it("MatchChatPanel uses complementary aside + labelled heading", () => {
    const { container } = render(
      <MatchChatPanel localPlayerId="p1" feed={[]} onSend={() => {}} disabled={false} />,
    );
    const aside = container.querySelector("aside[aria-labelledby='match-chat-heading']");
    expect(aside).toBeTruthy();
    expect(screen.getByRole("complementary", { name: /room chat/i })).toBeTruthy();
  });

  it("PhaseBar exposes a labelled region for match status", () => {
    const phase = "choosingWord" as RoomPhase;
    render(
      <PhaseBar
        phase={phase}
        players={[
          {
            playerId: "a",
            displayName: "Ada",
            avatarPresetId: "preset-1",
            isHost: true,
            connectionStatus: "connected",
            score: 0,
          },
        ]}
        matchRoundIndex={0}
      />,
    );
    expect(screen.getByRole("region", { name: /match status/i })).toBeTruthy();
  });

  it("WordChoicePanel section is labelled by its title", () => {
    render(
      <WordChoicePanel
        words={["one", "two", "three"]}
        isLoading={false}
        errorMessage={null}
        onPick={() => {}}
      />,
    );
    expect(screen.getByRole("region", { name: /pick a word to draw/i })).toBeTruthy();
  });
});
