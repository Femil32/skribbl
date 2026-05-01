import { describe, expect, it } from "vitest";
import { lineForCorrectGuess } from "./MatchChatPanel";

describe("lineForCorrectGuess (server facts only — Story 4.2 AC6)", () => {
  it("uses censoredAnnouncement when revealedWord is absent", () => {
    expect(
      lineForCorrectGuess({
        type: "chatCorrectGuess",
        roomId: "r1",
        id: "i1",
        ts: 1,
        guesserPlayerId: "p1",
        guesserDisplayName: "Alex",
        censoredAnnouncement: "Alex guessed the word!",
      }),
    ).toBe("Alex guessed the word!");
  });

  it("uses censoredAnnouncement when revealedWord is empty string", () => {
    expect(
      lineForCorrectGuess({
        type: "chatCorrectGuess",
        roomId: "r1",
        id: "i1",
        ts: 1,
        guesserPlayerId: "p1",
        guesserDisplayName: "Alex",
        revealedWord: "",
        censoredAnnouncement: "Alex guessed the word!",
      }),
    ).toBe("Alex guessed the word!");
  });

  it("uses censoredAnnouncement when revealedWord is whitespace only", () => {
    expect(
      lineForCorrectGuess({
        type: "chatCorrectGuess",
        roomId: "r1",
        id: "i1",
        ts: 1,
        guesserPlayerId: "p1",
        guesserDisplayName: "Alex",
        revealedWord: "   ",
        censoredAnnouncement: "Alex guessed the word!",
      }),
    ).toBe("Alex guessed the word!");
  });

  it("shows revealed word only when server supplied it", () => {
    expect(
      lineForCorrectGuess({
        type: "chatCorrectGuess",
        roomId: "r1",
        id: "i1",
        ts: 1,
        guesserPlayerId: "p1",
        guesserDisplayName: "Alex",
        revealedWord: "kitten",
        censoredAnnouncement: "Alex guessed the word!",
      }),
    ).toBe("Alex guessed: kitten");
  });
});
