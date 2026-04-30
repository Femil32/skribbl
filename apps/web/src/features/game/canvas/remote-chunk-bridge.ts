import type { DrawingStrokePoint } from "@skribbl/shared";

/**
 * Builds a continuous polyline for remote replay: each upstream chunk only carries
 * points captured in that ~flush window, so observers must bridge the last point of
 * the previous chunk with the first point of the next (same `strokeId`).
 */
export function connectRemoteChunkPoints(
  strokeId: string,
  points: DrawingStrokePoint[],
  tails: Map<string, DrawingStrokePoint>,
): DrawingStrokePoint[] {
  if (points.length === 0) return points;
  const prevTail = tails.get(strokeId);
  const merged = prevTail ? [prevTail, ...points] : points;
  tails.set(strokeId, points[points.length - 1]!);
  return merged;
}
