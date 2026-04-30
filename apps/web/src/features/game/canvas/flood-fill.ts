/**
 * Bitmap flood fill (4-connected BFS) for canvas ImageData — Story 3.6.
 */

export function hexToRgbTriplet(hex: string): [number, number, number] {
  const m = /^#([\da-fA-F]{6})$/.exec(hex);
  if (!m?.[1]) return [0, 0, 0];
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * In-place flood fill in RGBA bitmap space. `seedX`/`seedY` must be in range.
 */
export function floodFillRgbaInPlace(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
  fr: number,
  fg: number,
  fb: number,
  fa: number,
): void {
  if (seedX < 0 || seedY < 0 || seedX >= width || seedY >= height) return;

  const idx0 = (seedY * width + seedX) * 4;
  const tr = pixels[idx0]!;
  const tg = pixels[idx0 + 1]!;
  const tb = pixels[idx0 + 2]!;
  const ta = pixels[idx0 + 3]!;

  if (tr === fr && tg === fg && tb === fb && ta === fa) return;

  const stack: Array<[number, number]> = [[seedX, seedY]];

  while (stack.length > 0) {
    const pair = stack.pop();
    if (!pair) break;
    const [x, y] = pair;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;

    const i = (y * width + x) * 4;
    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;
    const a = pixels[i + 3]!;

    if (r !== tr || g !== tg || b !== tb || a !== ta) continue;

    pixels[i] = fr;
    pixels[i + 1] = fg;
    pixels[i + 2] = fb;
    pixels[i + 3] = fa;

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

export function applyFloodFillAtCssPoint(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  cssX: number,
  cssY: number,
  fillHex: string,
  dpr: number,
): void {
  const bmpW = canvas.width;
  const bmpH = canvas.height;
  const x0 = Math.max(0, Math.min(bmpW - 1, Math.floor(cssX * dpr)));
  const y0 = Math.max(0, Math.min(bmpH - 1, Math.floor(cssY * dpr)));

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const imageData = ctx.getImageData(0, 0, bmpW, bmpH);
  const [r, g, b] = hexToRgbTriplet(fillHex);
  floodFillRgbaInPlace(imageData.data, bmpW, bmpH, x0, y0, r, g, b, 255);
  ctx.putImageData(imageData, 0, 0);
  ctx.restore();
}
