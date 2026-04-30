import { describe, expect, it } from "vitest";

import {
  clampClientLineWidthPx,
  DEFAULT_CLIENT_STROKE_COLOR,
  normalizeClientStrokeColor,
} from "./drawing-stroke-style.js";

describe("normalizeClientStrokeColor", () => {
  it("lowercases valid hex", () => {
    expect(normalizeClientStrokeColor("#AA00FF")).toBe("#aa00ff");
  });

  it("returns default for invalid input", () => {
    expect(normalizeClientStrokeColor("red")).toBe(DEFAULT_CLIENT_STROKE_COLOR);
    expect(normalizeClientStrokeColor("#fff")).toBe(DEFAULT_CLIENT_STROKE_COLOR);
    expect(normalizeClientStrokeColor("")).toBe(DEFAULT_CLIENT_STROKE_COLOR);
  });
});

describe("clampClientLineWidthPx", () => {
  it("clamps to 1–96", () => {
    expect(clampClientLineWidthPx(0)).toBe(1);
    expect(clampClientLineWidthPx(200)).toBe(96);
    expect(clampClientLineWidthPx(8)).toBe(8);
  });

  it("uses default for non-finite", () => {
    expect(clampClientLineWidthPx(Number.NaN)).toBe(4);
    expect(clampClientLineWidthPx(Number.POSITIVE_INFINITY)).toBe(4);
  });
});
