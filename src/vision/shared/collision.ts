import type { Point2D } from "../visionTypes";
import { distance } from "./trajectory";
export const pointCircle = (p: Point2D, c: Point2D, r: number) =>
  distance(p, c) <= r;
export const circleCircle = (a: Point2D, ar: number, b: Point2D, br: number) =>
  distance(a, b) <= ar + br;
export function lineCircle(a: Point2D, b: Point2D, c: Point2D, r: number) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    n = dx * dx + dy * dy;
  const t = n
    ? Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / n))
    : 0;
  return pointCircle({ x: a.x + t * dx, y: a.y + t * dy }, c, r);
}
export const capsuleCircle = (
  a: Point2D,
  b: Point2D,
  width: number,
  c: Point2D,
  r: number,
) => lineCircle(a, b, c, width + r);
export const aabb = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) =>
  a.x <= b.x + b.width &&
  a.x + a.width >= b.x &&
  a.y <= b.y + b.height &&
  a.y + a.height >= b.y;
