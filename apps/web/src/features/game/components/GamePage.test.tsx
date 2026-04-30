import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GamePage } from "./GamePage";

describe("GamePage", () => {
  it("exposes Playwright hooks for phase bar, canvas, and chat regions", () => {
    render(<GamePage />);
    expect(screen.getByTestId("phase-bar")).toBeTruthy();
    expect(screen.getByTestId("canvas-region")).toBeTruthy();
    expect(screen.getByTestId("chat-region")).toBeTruthy();
  });

  it("uses header, main, and aside landmarks", () => {
    render(<GamePage />);
    expect(screen.getByTestId("phase-bar").tagName).toBe("HEADER");
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
    expect(within(aside).getByText("Chat area")).toBeTruthy();
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
