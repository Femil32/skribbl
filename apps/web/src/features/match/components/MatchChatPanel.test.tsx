import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CORRECT_GUESS_BANNER_MS,
  CORRECT_GUESS_BANNER_MS_REDUCED_MOTION,
  lineForCorrectGuess,
  MatchChatPanel,
  type MatchChatFeedEvent,
} from "./MatchChatPanel";

function stubPreferReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" && reduce,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("lineForCorrectGuess (server facts only — Story 4.2 AC6)", () => {
  it("uses censoredAnnouncement when revealedWord is absent", () => {
    expect(
      lineForCorrectGuess({
        type: "chatCorrectGuess",
        roomId: "r1",
        id: "i1",
        ts: 1,
        guesserPlayerId: "p1",
        guesserDisplayName: "Alex",
        censoredAnnouncement: "Alex guessed the word!",
      }),
    ).toBe("Alex guessed the word!");
  });

  it("uses censoredAnnouncement when revealedWord is empty string", () => {
    expect(
      lineForCorrectGuess({
        type: "chatCorrectGuess",
        roomId: "r1",
        id: "i1",
        ts: 1,
        guesserPlayerId: "p1",
        guesserDisplayName: "Alex",
        revealedWord: "",
        censoredAnnouncement: "Alex guessed the word!",
      }),
    ).toBe("Alex guessed the word!");
  });

  it("uses censoredAnnouncement when revealedWord is whitespace only", () => {
    expect(
      lineForCorrectGuess({
        type: "chatCorrectGuess",
        roomId: "r1",
        id: "i1",
        ts: 1,
        guesserPlayerId: "p1",
        guesserDisplayName: "Alex",
        revealedWord: "   ",
        censoredAnnouncement: "Alex guessed the word!",
      }),
    ).toBe("Alex guessed the word!");
  });

  it("shows revealed word only when server supplied it", () => {
    expect(
      lineForCorrectGuess({
        type: "chatCorrectGuess",
        roomId: "r1",
        id: "i1",
        ts: 1,
        guesserPlayerId: "p1",
        guesserDisplayName: "Alex",
        revealedWord: "kitten",
        censoredAnnouncement: "Alex guessed the word!",
      }),
    ).toBe("Alex guessed: kitten");
  });
});

describe("MatchChatPanel — correct-guess UX (Story 4.4)", () => {
  const onSend = vi.fn();

  const baseGuess = (
    overrides: Partial<{
      id: string;
      ts: number;
      censoredAnnouncement: string;
      revealedWord: string;
    }> = {},
  ) => ({
    type: "chatCorrectGuess" as const,
    roomId: "r1",
    id: overrides.id ?? "g1",
    ts: overrides.ts ?? 100,
    guesserPlayerId: "p1",
    guesserDisplayName: "Alex",
    censoredAnnouncement: overrides.censoredAnnouncement ?? "Alex guessed the word!",
    ...(overrides.revealedWord !== undefined ? { revealedWord: overrides.revealedWord } : {}),
  });

  beforeEach(() => {
    stubPreferReducedMotion(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    onSend.mockClear();
  });

  it("shows pulse banner driven by latest chatCorrectGuess via lineForCorrectGuess", () => {
    render(
      <MatchChatPanel
        localPlayerId="p1"
        feed={[{ type: "chatPlayerMessage", roomId: "r1", id: "m1", ts: 1, senderPlayerId: "p2", senderDisplayName: "Bo", text: "hi" }, baseGuess()]}
        onSend={onSend}
        disabled={false}
      />,
    );

    const banner = screen.getByTestId("correct-guess-pulse-banner");
    expect(banner).toHaveTextContent("Alex guessed the word!");
    expect(banner.querySelector('[aria-hidden="true"]')).toHaveTextContent("✓");
  });

  it("applies motion-safe pulse and motion-reduce none on pulse banner", () => {
    render(<MatchChatPanel localPlayerId="p1" feed={[baseGuess()]} onSend={onSend} disabled={false} />);
    const banner = screen.getByTestId("correct-guess-pulse-banner");
    expect(banner.className).toMatch(/motion-safe:animate-pulse/);
    expect(banner.className).toMatch(/motion-reduce:animate-none/);
  });

  it("renders transcript correct-guess row with check cue and pure lineForCorrectGuess text", () => {
    render(
      <MatchChatPanel
        localPlayerId="p1"
        feed={[baseGuess({ censoredAnnouncement: "Server line only." })]}
        onSend={onSend}
        disabled={false}
      />,
    );

    const log = screen.getByRole("log");
    const row = log.querySelector('[data-chat-row="correctGuess"]');
    expect(row).toHaveAttribute("data-chat-row", "correctGuess");
    expect(row?.querySelector('[aria-hidden="true"]')).toHaveTextContent("✓");
  });

  describe("pulse banner dwell timings", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("clears banner after CORRECT_GUESS_BANNER_MS when reduced motion is off", () => {
      stubPreferReducedMotion(false);
      render(<MatchChatPanel localPlayerId="p1" feed={[baseGuess()]} onSend={onSend} disabled={false} />);
      expect(screen.getByTestId("correct-guess-pulse-banner")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(CORRECT_GUESS_BANNER_MS));
      expect(screen.queryByTestId("correct-guess-pulse-banner")).not.toBeInTheDocument();
    });

    it("clears banner sooner when prefers-reduced-motion is reduce", () => {
      vi.unstubAllGlobals();
      stubPreferReducedMotion(true);

      render(<MatchChatPanel localPlayerId="p1" feed={[baseGuess()]} onSend={onSend} disabled={false} />);
      expect(screen.getByTestId("correct-guess-pulse-banner")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(CORRECT_GUESS_BANNER_MS_REDUCED_MOTION));
      expect(screen.queryByTestId("correct-guess-pulse-banner")).not.toBeInTheDocument();
    });

    it("refreshes banner when feed appends another chatCorrectGuess (back-to-back)", () => {
      stubPreferReducedMotion(false);
      const g1 = baseGuess({ id: "ga", ts: 1, censoredAnnouncement: "First correct!" });
      const g2 = baseGuess({ id: "gb", ts: 2, censoredAnnouncement: "Second correct!" });

      const view = render(
        <MatchChatPanel localPlayerId="p1" feed={[g1]} onSend={onSend} disabled={false} />,
      );
      expect(screen.getByTestId("correct-guess-pulse-banner")).toHaveTextContent("First correct!");

      act(() => vi.advanceTimersByTime(500));

      view.rerender(
        <MatchChatPanel localPlayerId="p1" feed={[g1, g2]} onSend={onSend} disabled={false} />,
      );
      expect(screen.getByTestId("correct-guess-pulse-banner")).toHaveTextContent("Second correct!");

      act(() => vi.advanceTimersByTime(CORRECT_GUESS_BANNER_MS));
      expect(screen.queryByTestId("correct-guess-pulse-banner")).not.toBeInTheDocument();
    });

    it("clears banner when a newer chat message becomes the feed tail (timer not required)", () => {
      stubPreferReducedMotion(false);
      const g1 = baseGuess({ id: "ga", ts: 1 });
      const chat: MatchChatFeedEvent = {
        type: "chatPlayerMessage",
        roomId: "r1",
        id: "m1",
        ts: 2,
        senderPlayerId: "p2",
        senderDisplayName: "Bo",
        text: "yo",
      };

      const view = render(
        <MatchChatPanel localPlayerId="p1" feed={[g1]} onSend={onSend} disabled={false} />,
      );
      expect(screen.getByTestId("correct-guess-pulse-banner")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(400));

      view.rerender(
        <MatchChatPanel localPlayerId="p1" feed={[g1, chat]} onSend={onSend} disabled={false} />,
      );
      expect(screen.queryByTestId("correct-guess-pulse-banner")).not.toBeInTheDocument();
    });
  });
});
