import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/** jsdom: modal `<dialog>` APIs are incomplete — Escape + initial focus mirror native showModal enough for tests. */
function installDialogPolyfill() {
  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal === "function") return;

  const openStack: HTMLDialogElement[] = [];

  function onDocumentKeyDown(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    const top = openStack[openStack.length - 1];
    if (!top?.isConnected || !top.hasAttribute("open")) return;
    top.close();
  }

  proto.showModal = function showModal(this: HTMLDialogElement) {
    if (!this.isConnected) return;
    if (this.hasAttribute("open")) return;
    this.setAttribute("open", "");
    if (openStack.length === 0) {
      window.addEventListener("keydown", onDocumentKeyDown);
    }
    openStack.push(this);
    queueMicrotask(() => {
      const selector =
        'button:not([disabled]), [href]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const first = this.querySelector<HTMLElement>(selector);
      first?.focus();
    });
  };

  proto.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    const idx = openStack.lastIndexOf(this);
    if (idx !== -1) openStack.splice(idx, 1);
    if (openStack.length === 0) {
      window.removeEventListener("keydown", onDocumentKeyDown);
    }
    queueMicrotask(() => {
      this.dispatchEvent(new Event("close", { bubbles: false }));
    });
  };
}

installDialogPolyfill();

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
