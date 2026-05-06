import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { configureAxe, toHaveNoViolations } from "jest-axe";
import { afterEach, expect, vi } from "vitest";

expect.extend(toHaveNoViolations);

// Relax color-contrast rule globally — jsdom has no rendered styles so contrast
// checks produce false positives. Test files that care can enable it selectively.
export const axe = configureAxe({
  rules: { "color-contrast": { enabled: false } },
});

globalThis.ResizeObserver = class ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};

// jsdom exposes no matchMedia — required by PhaseBar / PhaseCountdownChip in Vitest.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value(query: string) {
    void query;
    return {
      matches: false,
      media: typeof query === "string" ? query : String(query ?? ""),
      onchange: null,
      addListener: (): void => {},
      removeListener: (): void => {},
      addEventListener(): void {},
      removeEventListener(): void {},
      dispatchEvent(): boolean {
        return true;
      },
    };
  },
});

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
