import { describe, expect, it } from "vitest";
import {
  lettersRevealedAfterHint,
  maskedWordAtLetterHintIndex,
  totalLetterHintEmissions,
} from "./letter-hint-progression.js";

describe("letter-hint-progression", () => {
  it("multi-letter secret: first emission masks all letters", () => {
    expect(maskedWordAtLetterHintIndex(0, "cat")).toBe("___");
  });

  it("single-letter secret: plain letter on first (and only) tick", () => {
    expect(totalLetterHintEmissions("a")).toBe(1);
    expect(maskedWordAtLetterHintIndex(0, "a")).toBe("a");
  });

  it("reveals strictly more letters per tick until fully revealed", () => {
    const word = "ab";
    const n = totalLetterHintEmissions(word);
    expect(n).toBe(3);
    expect(maskedWordAtLetterHintIndex(0, word)).toBe("__");
    expect(maskedWordAtLetterHintIndex(1, word)).toBe("a_");
    expect(maskedWordAtLetterHintIndex(2, word)).toBe("ab");
    const prev = new Set<string>();
    for (let i = 0; i < n; i++) {
      const m = maskedWordAtLetterHintIndex(i, word);
      expect(prev.has(m)).toBe(false);
      prev.add(m);
    }
  });

  it("shows non-letters verbatim from hint 0", () => {
    expect(maskedWordAtLetterHintIndex(0, "a-b")).toBe("_-_");
    expect(lettersRevealedAfterHint(0, "a-b")).toBe(0);
  });

  it("masks Unicode letters (e.g. accented Latin) like ASCII letters", () => {
    const word = "café";
    expect(maskedWordAtLetterHintIndex(0, word)).toBe("____");
    expect(maskedWordAtLetterHintIndex(1, word)).toBe("c___");
    expect(maskedWordAtLetterHintIndex(4, word)).toBe("café");
    expect(totalLetterHintEmissions(word)).toBe(5);
  });

  it("counts emissions for word with punctuation", () => {
    expect(totalLetterHintEmissions("five!")).toBe(5);
  });
});
