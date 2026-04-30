import type { DrawingStrokePoint } from "@skribbl/shared";

export function drawStrokePolylineOnContext(
  ctx: CanvasRenderingContext2D,
  points: DrawingStrokePoint[],
  color: string,
  lineWidthPx: number,
): void {
  if (points.length === 0) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidthPx;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  ctx.stroke();
  ctx.restore();
}
