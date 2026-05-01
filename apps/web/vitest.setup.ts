import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

globalThis.ResizeObserver = class ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};

// jsdom has no usable CanvasRenderingContext2D — minimal stub for components that resize + transform.
vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
  function mockGetContext(this: HTMLCanvasElement, ...args: Parameters<HTMLCanvasElement["getContext"]>) {
    const contextId = args[0];
    if (typeof contextId !== "string" || contextId !== "2d") return null;
    const noop = {
      canvas: this,
      setTransform: vi.fn(),
      scale: vi.fn(),
    };
    return noop as unknown as CanvasRenderingContext2D;
  }
);

afterEach(() => {
  cleanup();
});
