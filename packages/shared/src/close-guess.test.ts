import { describe, expect, it } from "vitest";
import { evaluateCloseGuessTier, levenshteinDistanceBounded } from "./close-guess.js";
import { normalizeGuessText, sanitizeChatMessage } from "./chat-text.js";

const defaultOpts = {
  minSecretLength: 3,
  maxLengthDelta: 2,
  maxEditDistance: 2,
  veryCloseMaxDistance: 1,
} as const;

describe("levenshteinDistanceBounded", () => {
  it("returns 0 for equal strings", () => {
    expect(levenshteinDistanceBounded("apple", "apple", 2)).toBe(0);
  });

  it("returns 1 for single deletion", () => {
    expect(levenshteinDistanceBounded("appl", "apple", 2)).toBe(1);
  });

  it("bails when length diff exceeds max", () => {
    expect(levenshteinDistanceBounded("a", "abcdef", 2)).toBe(3);
  });

  it("returns > max when strings differ beyond bound", () => {
    expect(levenshteinDistanceBounded("foo", "bar", 1)).toBe(2);
  });
});

describe("evaluateCloseGuessTier", () => {
  it("returns none for exact match", () => {
    expect(
      evaluateCloseGuessTier(
        normalizeGuessText("Apple"),
        normalizeGuessText("apple"),
        defaultOpts,
      ),
    ).toBe("none");
  });

  it("returns none when secret too short", () => {
    expect(evaluateCloseGuessTier("ab", "xy", { ...defaultOpts, minSecretLength: 3 })).toBe(
      "none",
    );
  });

  it("returns none when length delta too large", () => {
    expect(
      evaluateCloseGuessTier("a", "abcde", { ...defaultOpts, maxLengthDelta: 1 }),
    ).toBe("none");
  });

  it("returns veryClose for distance 1 (typo)", () => {
    const secret = normalizeGuessText(sanitizeChatMessage("apple"));
    const guess = normalizeGuessText(sanitizeChatMessage("appl"));
    expect(evaluateCloseGuessTier(guess, secret, defaultOpts)).toBe("veryClose");
  });

  it("returns close for distance 2 when allowed", () => {
    const secret = normalizeGuessText(sanitizeChatMessage("apple"));
    const guess = normalizeGuessText(sanitizeChatMessage("apxl"));
    expect(evaluateCloseGuessTier(guess, secret, defaultOpts)).toBe("close");
  });

  it("treats NFC-composed and decomposed sequences as exact after normalizeGuessText", () => {
    const a = normalizeGuessText("e\u0301clair");
    const b = normalizeGuessText("éclair");
    expect(evaluateCloseGuessTier(a, b, defaultOpts)).toBe("none");
  });

  it("returns none for empty guess", () => {
    expect(evaluateCloseGuessTier("", "hello", defaultOpts)).toBe("none");
  });
});
