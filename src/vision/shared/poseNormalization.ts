import type { PosePoint, Point2D } from "../visionTypes";
export const upperBodyIds = [0, 11, 12, 13, 14, 15, 16] as const;
export function normalizePose(points: PosePoint[]): Point2D[] | null {
  if (
    upperBodyIds.some(
      (i) =>
        !points[i] ||
        !Number.isFinite(points[i].x) ||
        !Number.isFinite(points[i].y) ||
        (points[i].visibility ?? 1) < 0.5,
    )
  )
    return null;
  const a = points[11],
    b = points[12],
    dx = b.x - a.x,
    dy = b.y - a.y,
    scale = Math.hypot(dx, dy);
  if (scale < 0.04) return null;
  const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    cos = dx / scale,
    sin = dy / scale;
  return upperBodyIds.map((i) => ({
    x: ((points[i].x - c.x) * cos + (points[i].y - c.y) * sin) / scale,
    y: (-(points[i].x - c.x) * sin + (points[i].y - c.y) * cos) / scale,
  }));
}
function angle(a: Point2D, b: Point2D) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}
/** Shoulder-relative joint directions: translation, scale and torso tilt invariant. */
export function poseSimilarity(a: Point2D[] | null, b: Point2D[] | null) {
  if (!a || !b || a.length !== 7 || b.length !== 7) return null;
  const limbs = [
    [1, 3],
    [3, 5],
    [2, 4],
    [4, 6],
  ];
  if (
    limbs.some(
      ([i, j]) =>
        Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y) < 0.05 ||
        Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y) < 0.05,
    )
  )
    return null;
  const error =
    limbs.reduce((sum, [i, j]) => {
      const delta = angle(a[i], a[j]) - angle(b[i], b[j]);
      return sum + Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
    }, 0) / limbs.length;
  return Math.round(Math.max(0, 100 - (error / Math.PI) * 100));
}
