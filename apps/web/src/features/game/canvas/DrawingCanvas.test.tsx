import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { DrawingCanvas } from "./DrawingCanvas";

describe("DrawingCanvas", () => {
  const roInstances: Array<{ callback: ResizeObserverCallback }> = [];

  beforeEach(() => {
    roInstances.length = 0;
    globalThis.ResizeObserver = class ResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        roInstances.push({ callback: cb });
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };

    vi.spyOn(HTMLDivElement.prototype, "clientWidth", "get").mockReturnValue(200);
    vi.spyOn(HTMLDivElement.prototype, "clientHeight", "get").mockReturnValue(150);
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      writable: true,
      value: 2,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function flushResizeObservers(): void {
    act(() => {
      roInstances.slice().forEach(({ callback }) => {
        callback([], {} as ResizeObserver);
      });
    });
  }

  it("renders canvas with img role and accessible name", () => {
    render(<DrawingCanvas ariaLabel="Sketching board" />);
    flushResizeObservers();
    const canvas = screen.getByRole("img", { name: /sketching board/i });
    expect(canvas.tagName).toBe("CANVAS");
    expect(canvas.getAttribute("aria-label")).toBe("Sketching board");
  });

  it("sets backing store from CSS box and mocked devicePixelRatio when ResizeObserver runs", () => {
    render(<DrawingCanvas />);
    flushResizeObservers();
    const canvas = screen.getByRole("img") as HTMLCanvasElement;
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(300);
  });

  it("applies pointer-events-none for read-only mode", () => {
    render(<DrawingCanvas mode="read-only" />);
    flushResizeObservers();
    const canvas = screen.getByRole("img");
    expect(canvas.className).toMatch(/pointer-events-none/);
  });
});
