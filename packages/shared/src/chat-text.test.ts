import { describe, expect, it } from "vitest";
import {
  assertChatMessageLength,
  normalizeGuessText,
  sanitizeChatMessage,
} from "./chat-text.js";

describe("chat-text", () => {
  it("sanitizeChatMessage strips tags and normalizes whitespace", () => {
    expect(sanitizeChatMessage("  hello\n\tworld  ")).toBe("hello world");
    expect(sanitizeChatMessage('<b>a</b> & c')).toBe("a & c");
  });

  it("normalizeGuessText is case and space insensitive for guessing", () => {
    expect(normalizeGuessText("  Apple ")).toBe("apple");
    expect(normalizeGuessText("ICE\n\tcream")).toBe("ice cream");
    expect(normalizeGuessText("  a   b \tc")).toBe("a b c");
    expect(normalizeGuessText("   ")).toBe("");
  });

  it("normalizeGuessText applies NFKC before case fold (fullwidth Latin)", () => {
    // U+FF21 FULLWIDTH LATIN CAPITAL A → NFKC → "A" → "a"
    expect(normalizeGuessText("\uFF41\uFF50\uFF50\uFF4C\uFF45")).toBe("apple");
  });

  it("rejects overly long sanitized text", () => {
    const long = "a".repeat(201);
    expect(assertChatMessageLength(long).ok).toBe(false);
    expect(assertChatMessageLength("hi").ok).toBe(true);
  });
});
