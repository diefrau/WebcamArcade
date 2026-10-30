import type { Landmark } from "../gestures";
export function handPose(points: Landmark[], aspect = 4 / 3) {
  if (
    points.length !== 21 ||
    points.some(
      (p) =>
        !p ||
        ![p.x, p.y].every(Number.isFinite) ||
        p.x < 0 ||
        p.x > 1 ||
        p.y < 0 ||
        p.y > 1,
    )
  )
    return null;
  const d = (a: Landmark, b: Landmark) =>
    Math.hypot((a.x - b.x) * aspect, a.y - b.y);
  const scale = d(points[5], points[17]);
  if (scale < 0.025 || scale > 0.7) return null;
  const fingers = [5, 9, 13, 17].map((i) => {
    const a = {
      x: (points[i].x - points[i + 1].x) * aspect,
      y: points[i].y - points[i + 1].y,
    };
    const b = {
      x: (points[i + 3].x - points[i + 1].x) * aspect,
      y: points[i + 3].y - points[i + 1].y,
    };
    const denominator = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (denominator < 0.00001) return { open: false, closed: false };
    const cosine = (a.x * b.x + a.y * b.y) / denominator;
    const ratio =
      d(points[i + 3], points[0]) /
      Math.max(0.001, d(points[i + 1], points[0]));
    return {
      open: cosine < -0.65 && ratio > 1.18,
      closed: cosine > -0.3 && ratio < 1.12,
    };
  });
  return {
    middle: fingers[1].open && [0, 2, 3].every((i) => fingers[i].closed),
    peace:
      fingers[0].open &&
      fingers[1].open &&
      fingers[2].closed &&
      fingers[3].closed,
    open: fingers.every((f) => f.open) && d(points[4], points[5]) > scale * 0.5,
    wrist: points[0],
  };
}
