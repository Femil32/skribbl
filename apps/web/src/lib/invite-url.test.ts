import { describe, expect, it } from "vitest";
import {
  isValidRoomCodeForJoin,
  normalizeRoomCode,
} from "@skribbl/shared";
import {
  buildRoomInviteUrl,
  normalizeRoomCodeForDisplay,
} from "./invite-url";

describe("invite URL vs shared room-code rules", () => {
  it("display normalization matches shared normalizeRoomCode", () => {
    const raw = " ab-12 \t";
    expect(normalizeRoomCodeForDisplay(raw)).toBe(normalizeRoomCode(raw));
  });

  it("rejects invalid length for join parity with server", () => {
    expect(isValidRoomCodeForJoin(normalizeRoomCodeForDisplay("SHORT"))).toBe(
      false,
    );
  });
});

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
