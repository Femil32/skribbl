import { describe, expect, it } from "vitest";
import {
  buildMaskedWord,
  computeTotalLetters,
  eligibleLetterIndices,
  hintRevealOrderSeed,
  HINT_MASK_CHAR,
  shuffleIndicesDeterministic,
} from "./hint-mask.js";

describe("eligibleLetterIndices", () => {
  it("counts only ASCII letters", () => {
    expect(eligibleLetterIndices("a-b")).toEqual([0, 2]);
    expect(eligibleLetterIndices("A B")).toEqual([0, 2]);
  });

  it("ignores punctuation and whitespace indices", () => {
    expect(eligibleLetterIndices("hi, world")).toEqual([0, 1, 4, 5, 6, 7, 8]);
  });
});

describe("buildMaskedWord", () => {
  it("keeps spaces and punctuation visible; masks unrevealed letters", () => {
    const masked = buildMaskedWord("a, b!", new Set<number>());
    expect(masked).toBe(`${HINT_MASK_CHAR}, ${HINT_MASK_CHAR}!`);
  });

  it("reveals letters when indices are included", () => {
    expect(buildMaskedWord("cat", new Set([0]))).toBe(`c${HINT_MASK_CHAR}${HINT_MASK_CHAR}`);
    expect(buildMaskedWord("cat", new Set([0, 1, 2]))).toBe("cat");
  });
});

describe("shuffleIndicesDeterministic", () => {
  it("same seed yields same permutation", () => {
    const ix = [0, 1, 2, 3, 4];
    expect(shuffleIndicesDeterministic(ix, "room:0:apple")).toEqual(
      shuffleIndicesDeterministic([...ix], "room:0:apple"),
    );
  });

  it("changing secret changes ordering for same room/round", () => {
    const ix = [0, 1, 2];
    const a = shuffleIndicesDeterministic(ix, hintRevealOrderSeed({ roomId: "r", matchRoundIndex: 0, secretWord: "abc" }));
    const b = shuffleIndicesDeterministic([...ix], hintRevealOrderSeed({ roomId: "r", matchRoundIndex: 0, secretWord: "abd" }));
    expect(a).not.toEqual(b);
  });
});

describe("computeTotalLetters", () => {
  it("matches eligible count", () => {
    expect(computeTotalLetters("no-op")).toBe(eligibleLetterIndices("no-op").length);
  });
});
