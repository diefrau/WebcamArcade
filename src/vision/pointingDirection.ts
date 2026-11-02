import type { Landmark } from "./gestures";
import type { Direction } from "./face";
/** Screen-space direction of a clearly extended index, mirrored like the preview. */
export function pointingDirection(
  points: Landmark[],
  aspect = 4 / 3,
): Direction | "center" {
  if (
    points.length !== 21 ||
    !Number.isFinite(aspect) ||
    aspect <= 0 ||
    points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    return "center";
  const base = points[5],
    tip = points[8],
    joint = points[6];
  const x = -(tip.x - base.x) * aspect,
    y = tip.y - base.y;
  const length = Math.hypot(x, y);
  const palm = Math.hypot(
    (points[5].x - points[17].x) * aspect,
    points[5].y - points[17].y,
  );
  if (
    palm < 0.015 ||
    length < palm * 0.8 ||
    Math.hypot((tip.x - base.x) * aspect, tip.y - base.y) <
      Math.hypot((joint.x - base.x) * aspect, joint.y - base.y) * 1.2
  )
    return "center";
  if (Math.abs(x) > Math.abs(y) * 1.25) return x > 0 ? "right" : "left";
  if (Math.abs(y) > Math.abs(x) * 1.25) return y > 0 ? "down" : "up";
  return "center";
}
