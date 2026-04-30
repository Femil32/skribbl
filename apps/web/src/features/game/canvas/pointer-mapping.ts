/**
 * Maps viewport pointer coordinates into the canvas **CSS-pixel** coordinate space used
 * with a 2D context after `scale(devicePixelRatio, devicePixelRatio)` and bitmap sizing
 * `canvas.width ≈ cssWidth * dpr`.
 *
 * Uses `canvas.width / dpr` (not layout alone) so backing-store quantization stays aligned with drawing.
 */
export function pointerClientToCanvasCss(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  options?: { devicePixelRatio?: number }
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const cssLayoutW = rect.width;
  const cssLayoutH = rect.height;

  const dpr =
    options?.devicePixelRatio ??
    (typeof window !== "undefined" && typeof window.devicePixelRatio === "number"
      ? window.devicePixelRatio
      : 1);

  const safeDpr = Math.max(dpr, Number.EPSILON);
  const logicalW = canvas.width / safeDpr;
  const logicalH = canvas.height / safeDpr;

  if (cssLayoutW === 0 || cssLayoutH === 0) {
    return { x: 0, y: 0 };
  }

  const nx = (clientX - rect.left) / cssLayoutW;
  const ny = (clientY - rect.top) / cssLayoutH;

  return {
    x: nx * logicalW,
    y: ny * logicalH,
  };
}
