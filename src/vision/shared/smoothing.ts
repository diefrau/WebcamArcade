import type { Point2D } from "../visionTypes";
export function smoothPoint(
  previous: Point2D,
  current: Point2D,
  dtMs: number,
  tauMs = 90,
): Point2D {
  const a = 1 - Math.exp(-Math.max(0, dtMs) / Math.max(1, tauMs));
  return {
    x: previous.x + (current.x - previous.x) * a,
    y: previous.y + (current.y - previous.y) * a,
  };
}
