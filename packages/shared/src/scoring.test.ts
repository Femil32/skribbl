import { describe, expect, it } from "vitest";
import { clampGuessElapsedMs, computeGuesserPoints } from "./scoring.js";

describe("clampGuessElapsedMs", () => {
  const roundMs = 80_000;

  it("clamps to [0, roundMs] and matches non-finite rules used by computeGuesserPoints", () => {
    expect(clampGuessElapsedMs(0, roundMs)).toBe(0);
    expect(clampGuessElapsedMs(-10, roundMs)).toBe(0);
    expect(clampGuessElapsedMs(40_000, roundMs)).toBe(40_000);
    expect(clampGuessElapsedMs(roundMs, roundMs)).toBe(roundMs);
    expect(clampGuessElapsedMs(roundMs + 1000, roundMs)).toBe(roundMs);
    expect(clampGuessElapsedMs(Number.NaN, roundMs)).toBe(0);
    expect(clampGuessElapsedMs(Number.NEGATIVE_INFINITY, roundMs)).toBe(0);
    expect(clampGuessElapsedMs(Number.POSITIVE_INFINITY, roundMs)).toBe(roundMs);
  });

  it("returns 0 when roundMs is invalid (scoring path uses minPts fallback)", () => {
    expect(clampGuessElapsedMs(5000, 0)).toBe(0);
    expect(clampGuessElapsedMs(5000, Number.NaN)).toBe(0);
  });
});

describe("computeGuesserPoints", () => {
  const roundMs = 80_000;
  const maxPts = 100;
  const minPts = 10;

  it("elapsedMs <= 0 yields max points", () => {
    expect(computeGuesserPoints(0, roundMs, maxPts, minPts)).toBe(100);
    expect(computeGuesserPoints(-99, roundMs, maxPts, minPts)).toBe(100);
  });

  it("negative infinity elapsed matches instant guess (max points)", () => {
    expect(computeGuesserPoints(Number.NEGATIVE_INFINITY, roundMs, maxPts, minPts)).toBe(100);
  });

  it("elapsedMs >= roundMs yields min points", () => {
    expect(computeGuesserPoints(roundMs, roundMs, maxPts, minPts)).toBe(10);
    expect(computeGuesserPoints(roundMs + 5000, roundMs, maxPts, minPts)).toBe(10);
  });

  it("mid-round uses linear interpolation and rounds", () => {
    expect(computeGuesserPoints(40_000, roundMs, maxPts, minPts)).toBe(55);
  });

  it("uses the same elapsed clamp as clampGuessElapsedMs", () => {
    const excess = roundMs + 9999;
    expect(computeGuesserPoints(excess, roundMs, maxPts, minPts)).toBe(
      computeGuesserPoints(clampGuessElapsedMs(excess, roundMs), roundMs, maxPts, minPts),
    );
  });

  it("non-finite elapsed: NaN → max, +Infinity → min", () => {
    expect(computeGuesserPoints(Number.NaN, roundMs, maxPts, minPts)).toBe(100);
    expect(computeGuesserPoints(Number.POSITIVE_INFINITY, roundMs, maxPts, minPts)).toBe(
      10,
    );
  });

  it("invalid roundMs yields minPts rounded", () => {
    expect(computeGuesserPoints(1000, 0, maxPts, minPts)).toBe(10);
    expect(computeGuesserPoints(1000, Number.NaN, maxPts, minPts)).toBe(10);
    expect(computeGuesserPoints(1000, -5000, maxPts, minPts)).toBe(10);
  });

  it("max/min arguments may be passed in either order", () => {
    expect(computeGuesserPoints(0, roundMs, 10, 100)).toBe(100);
    expect(computeGuesserPoints(roundMs, roundMs, 10, 100)).toBe(10);
  });
});
