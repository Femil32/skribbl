import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DRAWER_ASSIST_PER_CORRECT,
  DEFAULT_GUESSER_SCORE_MAX,
  DEFAULT_GUESSER_SCORE_MIN,
  resolveDrawerAssistPerCorrect,
  resolveGuesserScoreBracket,
} from "./game.js";

describe("game.ts scoring env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses defaults when env invalid for guesser bracket and assist", () => {
    vi.stubEnv("GUESSER_SCORE_MAX", "not-a-number");
    vi.stubEnv("GUESSER_SCORE_MIN", "-3");
    vi.stubEnv("DRAWER_ASSIST_PER_CORRECT", "");
    const b = resolveGuesserScoreBracket();
    expect(b.max).toBe(DEFAULT_GUESSER_SCORE_MAX);
    expect(b.min).toBe(DEFAULT_GUESSER_SCORE_MIN);
    expect(resolveDrawerAssistPerCorrect()).toBe(DEFAULT_DRAWER_ASSIST_PER_CORRECT);
  });

  it("swaps when max < min", () => {
    vi.stubEnv("GUESSER_SCORE_MAX", "5");
    vi.stubEnv("GUESSER_SCORE_MIN", "50");
    const b = resolveGuesserScoreBracket();
    expect(b.max).toBe(50);
    expect(b.min).toBe(5);
  });

  it("uses valid env overrides for guesser bracket and assist", () => {
    vi.stubEnv("GUESSER_SCORE_MAX", "200");
    vi.stubEnv("GUESSER_SCORE_MIN", "40");
    vi.stubEnv("DRAWER_ASSIST_PER_CORRECT", "15");
    const b = resolveGuesserScoreBracket();
    expect(b.max).toBe(200);
    expect(b.min).toBe(40);
    expect(resolveDrawerAssistPerCorrect()).toBe(15);
  });
});
