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
  });

  it("rejects overly long sanitized text", () => {
    const long = "a".repeat(201);
    expect(assertChatMessageLength(long).ok).toBe(false);
    expect(assertChatMessageLength("hi").ok).toBe(true);
  });
});
