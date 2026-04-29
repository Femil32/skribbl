import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LetterHintFeed } from "./LetterHintFeed";

describe("LetterHintFeed", () => {
  it("returns null when there are no hints", () => {
    const { container } = render(<LetterHintFeed hints={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders hint rows for guessers", () => {
    render(
      <LetterHintFeed
        hints={[
          { matchRoundIndex: 0, hintIndex: 0, maskedWord: "___" },
          { matchRoundIndex: 0, hintIndex: 1, maskedWord: "c__" },
        ]}
        showGuessersOnly
        isCurrentDrawer={false}
      />,
    );
    expect(
      screen.getByRole("complementary", { name: /letter hints/i }),
    ).toBeTruthy();
    expect(screen.getByText("___")).toBeTruthy();
    expect(screen.getByText("c__")).toBeTruthy();
  });

  it("hides feed for current drawer when showGuessersOnly", () => {
    const { container } = render(
      <LetterHintFeed
        hints={[{ matchRoundIndex: 0, hintIndex: 0, maskedWord: "___" }]}
        showGuessersOnly
        isCurrentDrawer
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
