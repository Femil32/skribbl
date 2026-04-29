import { describe, expect, it } from "vitest";
import {
  NICKNAME_MAX_GRAPHEMES,
  avatarPresetIdSchema,
  countGraphemes,
  isValidAvatarPresetId,
  sanitizeDisplayName,
} from "./player-identity.js";

describe("sanitizeDisplayName", () => {
  it("trims and strips angle-bracket tags", () => {
    expect(sanitizeDisplayName("  <b>hi</b>  ")).toBe("hi");
    expect(sanitizeDisplayName("<script>x</script>yo")).toBe("yo");
  });

  it("removes control characters", () => {
    expect(sanitizeDisplayName("a\u0000b")).toBe("ab");
    expect(sanitizeDisplayName("x\u007Fy")).toBe("xy");
  });

  it("collapses whitespace", () => {
    expect(sanitizeDisplayName("a \t\n b")).toBe("a b");
    expect(sanitizeDisplayName("a\tb")).toBe("a b");
  });

  it("does not treat entities as HTML (plain text)", () => {
    expect(sanitizeDisplayName("Tom &amp; Jerry")).toBe("Tom &amp; Jerry");
  });
});

describe("countGraphemes + nickname bound", () => {
  it("counts ascii characters", () => {
    expect(countGraphemes("hello")).toBe(5);
  });

  it("documents max constant within 16–32 range", () => {
    expect(NICKNAME_MAX_GRAPHEMES).toBeGreaterThanOrEqual(16);
    expect(NICKNAME_MAX_GRAPHEMES).toBeLessThanOrEqual(32);
  });
});

describe("avatarPresetIdSchema", () => {
  it("accepts allow-listed ids", () => {
    expect(avatarPresetIdSchema.safeParse("preset-1").success).toBe(true);
  });

  it("rejects unknown ids", () => {
    expect(avatarPresetIdSchema.safeParse("hacker-avatar").success).toBe(
      false,
    );
  });
});

describe("isValidAvatarPresetId", () => {
  it("narrows known ids", () => {
    expect(isValidAvatarPresetId("preset-2")).toBe(true);
    expect(isValidAvatarPresetId("nope")).toBe(false);
  });
});
