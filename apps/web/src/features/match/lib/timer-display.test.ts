import { describe, expect, it } from "vitest";
import {
  formatRoundCountdown,
  remainingMs,
  timerUrgencyTier,
  type TimerUrgencyTier,
} from "./timer-display";

describe("remainingMs", () => {
  it("floors fractional ms and clamps at 0 past deadline", () => {
    expect(remainingMs(1_000, 250)).toBe(750);
    expect(remainingMs(1_000, 1_001)).toBe(0);
  });
});

describe("formatRoundCountdown", () => {
  it("formats MM:SS for sub-hour windows", () => {
    expect(formatRoundCountdown(0)).toBe("00:00");
    expect(formatRoundCountdown(125_420)).toBe("02:05");
    expect(formatRoundCountdown(80_000)).toBe("01:20");
  });
});

describe("timerUrgencyTier", () => {
  function tierAt(fraction: number): TimerUrgencyTier {
    return timerUrgencyTier(fraction);
  }

  it("classifies healthy / urgent / critical by fraction thresholds", () => {
    expect(tierAt(1)).toBe("healthy");
    expect(tierAt(0.43)).toBe("healthy");
    expect(tierAt(0.42)).toBe("urgent");
    expect(tierAt(0.16)).toBe("urgent");
    expect(tierAt(0.15)).toBe("critical");
    expect(tierAt(0)).toBe("critical");
  });

  it("clamps out-of-range input", () => {
    expect(timerUrgencyTier(2)).toBe(timerUrgencyTier(1));
    expect(timerUrgencyTier(-1)).toBe(timerUrgencyTier(0));
  });
});
