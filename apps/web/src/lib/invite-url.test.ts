import { describe, expect, it } from "vitest";
import {
  buildRoomInviteUrl,
  normalizeRoomCodeForDisplay,
} from "./invite-url";

describe("normalizeRoomCodeForDisplay", () => {
  it("strips whitespace and non-alphanumeric, uppercases", () => {
    expect(normalizeRoomCodeForDisplay("  ab \t cd  ")).toBe("ABCD");
    expect(normalizeRoomCodeForDisplay("ab-12")).toBe("AB12");
  });
});

describe("buildRoomInviteUrl", () => {
  it("builds stable /join path with encoded code", () => {
    expect(
      buildRoomInviteUrl("AB12CD", "https://play.example.com"),
    ).toBe("https://play.example.com/join?code=AB12CD");
  });

  it("uses encodeURIComponent for the query value", () => {
    expect(
      buildRoomInviteUrl("A&B", "https://x.test"),
    ).toBe("https://x.test/join?code=A%26B");
  });
});
