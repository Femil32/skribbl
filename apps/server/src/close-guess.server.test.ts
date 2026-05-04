import { describe, expect, it } from "vitest";
import {
  evaluateCloseGuessTier,
  normalizeGuessText,
  sanitizeChatMessage,
} from "@skribbl/shared";
import { resolveCloseGuessHeuristicOptions } from "./config/game.js";

describe("close guess heuristic + config (Story 7.1)", () => {
  it("classifies a single-letter typo as veryClose using resolved options", () => {
    const opts = resolveCloseGuessHeuristicOptions();
    const secret = normalizeGuessText(sanitizeChatMessage("kitten"));
    const guess = normalizeGuessText(sanitizeChatMessage("kiten"));
    expect(evaluateCloseGuessTier(guess, secret, opts)).toBe("veryClose");
  });

  it("returns none for wildly longer guesses beyond maxLengthDelta", () => {
    const opts = resolveCloseGuessHeuristicOptions();
    const secret = normalizeGuessText(sanitizeChatMessage("cat"));
    const guess = normalizeGuessText(sanitizeChatMessage("catxxxxxx"));
    expect(evaluateCloseGuessTier(guess, secret, opts)).toBe("none");
  });
});
