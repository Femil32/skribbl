import { describe, expect, it } from "vitest";
import {
  ROOM_CODE_LENGTH,
  isValidRoomCodeForJoin,
  normalizeRoomCode,
} from "./room-code.js";

describe("normalizeRoomCode + validation", () => {
  it("uppercases and strips non-alphanumeric", () => {
    expect(normalizeRoomCode("  ab \t cd  ")).toBe("ABCD");
    expect(normalizeRoomCode("ab-12")).toBe("AB12");
  });

  it("isValidRoomCodeForJoin matches generated charset and length", () => {
    expect(isValidRoomCodeForJoin("A".repeat(ROOM_CODE_LENGTH))).toBe(true);
    expect(isValidRoomCodeForJoin("SHORT")).toBe(false);
    expect(isValidRoomCodeForJoin("O".repeat(ROOM_CODE_LENGTH))).toBe(false);
  });
});
