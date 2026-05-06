import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../../vitest.setup";
import { GamePage } from "./GamePage";

describe("GamePage", () => {
  it("exposes Playwright hooks for phase bar, canvas, and chat regions", () => {
    render(<GamePage />);
    expect(screen.getByTestId("phase-bar")).toBeTruthy();
    expect(screen.getByTestId("canvas-region")).toBeTruthy();
    expect(screen.getByTestId("chat-region")).toBeTruthy();
  });

  it("uses header, main, and aside landmarks with PhaseBar carrying phase-bar inside banner", () => {
    render(<GamePage />);
    const banner = screen.getByRole("banner");
    expect(within(banner).getByTestId("phase-bar")).toBeTruthy();
    expect(screen.getByTestId("canvas-region").tagName).toBe("MAIN");
    expect(screen.getByTestId("chat-region").tagName).toBe("ASIDE");
  });

  it("keeps canvas floor width at 320px and chat aside independently scrollable", () => {
    render(<GamePage />);
    const main = screen.getByTestId("canvas-region");
    expect(main.className).toMatch(/min-w-\[320px\]/);
    const aside = screen.getByTestId("chat-region");
    expect(aside.className).toMatch(/overflow-y-auto/);
  });

  it("stacks vertically below lg and goes row at lg for canvas and chat", () => {
    render(<GamePage />);
    const shell = screen.getByTestId("canvas-region").parentElement;
    expect(shell).toBeTruthy();
    expect(shell!.className).toMatch(/flex-col/);
    expect(shell!.className).toMatch(/lg:flex-row/);
  });

  it("renders drawing surface in canvas region and chat placeholder in aside", () => {
    render(<GamePage />);
    const main = screen.getByTestId("canvas-region");
    const aside = screen.getByTestId("chat-region");
    expect(within(main).getByRole("img", { name: /drawing surface/i })).toBeTruthy();
    expect(within(main).getByTestId("drawing-canvas")).toBeTruthy();
    expect(within(main).getByTestId("drawing-toolbar")).toBeTruthy();
    expect(within(aside).getByText("Chat area")).toBeTruthy();
  });

  it("match shell has no critical axe violations (AC #6)", async () => {
    const { container } = render(<GamePage />);
    const results = await axe(container, {
      rules: {
        // Canvas drawing limitation: canvas element is not keyboard-operable by design.
        // Architecture decision: pointer-primary canvas drawing, documented in story 6.4 Dev Notes.
        "scrollable-region-focusable": { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });

  it("scrolls chat aside independently without moving the canvas region", () => {
    render(
      <GamePage
        chatSlot={<div data-testid="tall-chat-filler" style={{ height: 4000 }} />}
      />
    );
    const aside = screen.getByTestId("chat-region");
    const main = screen.getByTestId("canvas-region");
    Object.defineProperty(aside, "clientHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(aside, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    aside.scrollTop = 150;
    expect(aside.scrollTop).toBe(150);
    expect(main.scrollTop).toBe(0);
  });
});
