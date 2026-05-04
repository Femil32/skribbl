import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhaseCountdownChip } from "./PhaseCountdownChip";

function mockMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const raw = String(query);
    const isReduceQuery =
      raw.includes("prefers-reduced-motion") && raw.includes("reduce");
    return {
      matches: reducedMotion ? isReduceQuery : false,
      media: raw,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  }) as unknown as typeof window.matchMedia;
}

describe("PhaseCountdownChip", () => {
  let baselineMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    baselineMatchMedia = window.matchMedia;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = baselineMatchMedia;
  });

  it("does not use animate-pulse when prefers-reduced-motion is reduce (critical tier)", async () => {
    mockMatchMedia(true);
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);
    const deadlineMs = t0 + 60_000;
    render(<PhaseCountdownChip deadlineMs={deadlineMs} resetKey="a" />);
    vi.setSystemTime(t0 + 55_900);
    await act(async () => {
      vi.advanceTimersByTime(55_900);
    });
    const chip = screen.getByRole("timer");
    expect(chip.className).not.toMatch(/animate-pulse/);
  });

  it("uses animate-pulse in critical tier when motion is allowed", async () => {
    mockMatchMedia(false);
    const t0 = 2_700_000_000_000;
    vi.setSystemTime(t0);
    const deadlineMs = t0 + 60_000;
    render(<PhaseCountdownChip deadlineMs={deadlineMs} resetKey="b" />);
    vi.setSystemTime(t0 + 55_900);
    await act(async () => {
      vi.advanceTimersByTime(55_900);
    });
    const chip = screen.getByRole("timer");
    expect(chip.className).toMatch(/animate-pulse/);
  });
});
