import type { Point2D, TimedPoint } from "../visionTypes";
export const distance = (a: Point2D, b: Point2D) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export function recentPoints(
  points: TimedPoint[],
  now: number,
  windowMs = 300,
) {
  return points.filter(
    (p) =>
      Number.isFinite(p.time) &&
      p.time <= now &&
      p.time >= now - windowMs &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.y),
  );
}
export function trajectory(points: TimedPoint[]) {
  const length = points
    .slice(1)
    .reduce((sum, p, i) => sum + distance(points[i], p), 0);
  const direct = points.length > 1 ? distance(points[0], points.at(-1)!) : 0;
  const ms = points.length > 1 ? points.at(-1)!.time - points[0].time : 0;
  return {
    length,
    linearity: length > 0 ? direct / length : 0,
    velocity: ms > 0 ? (length * 1000) / ms : 0,
  };
}
