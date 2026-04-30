import { describe, expect, it } from "vitest";
import { pointerClientToCanvasCss } from "./pointer-mapping";

function makeCanvas(rect: Partial<DOMRect>, width: number, height: number): HTMLCanvasElement {
  const el = document.createElement("canvas");
  el.width = width;
  el.height = height;
  el.getBoundingClientRect = (): DOMRect =>
    ({
      width: rect.width ?? 0,
      height: rect.height ?? 0,
      left: rect.left ?? 0,
      top: rect.top ?? 0,
      right: rect.right ?? Number.NaN,
      bottom: rect.bottom ?? Number.NaN,
      x: rect.x ?? rect.left ?? 0,
      y: rect.y ?? rect.top ?? 0,
      toJSON(): unknown {
        return {};
      },
    }) as DOMRect;
  return el;
}

describe("pointerClientToCanvasCss", () => {
  it("maps center of canvas with uniform scale and rect offset", () => {
    const canvas = makeCanvas({ left: 100, top: 50, width: 400, height: 200 }, 800, 400);
    const p = pointerClientToCanvasCss(canvas, 100 + 200, 50 + 100, { devicePixelRatio: 2 });
    expect(p.x).toBeCloseTo(200);
    expect(p.y).toBeCloseTo(100);
  });

  it("returns zeros when layout box has zero dimension", () => {
    const canvas = makeCanvas({ left: 0, top: 0, width: 0, height: 200 }, 800, 400);
    const p = pointerClientToCanvasCss(canvas, 50, 50, { devicePixelRatio: 2 });
    expect(p).toEqual({ x: 0, y: 0 });
  });

  it("handles non-1 bitmap-to-layout ratios using canvas width and dpr", () => {
    const canvas = makeCanvas({ left: 0, top: 0, width: 100, height: 50 }, 300, 150);
    const p = pointerClientToCanvasCss(canvas, 50, 25, { devicePixelRatio: 3 });
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(25);
  });
});
