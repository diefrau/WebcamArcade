import type { Landmark } from "./gestures";

export type Direction = "left" | "right" | "up" | "down";
export type FaceSample = {
  detected: boolean;
  x: number;
  y: number;
  time: number;
};
export const emptyFace: FaceSample = { detected: false, x: 0, y: 0, time: 0 };

// Nose relative to the eye line: translation/scale independent, with roll removed.
// Horizontal coordinates follow the mirrored camera preview.
export function faceSample(
  points: Landmark[] | undefined,
  time: number,
  aspect = 4 / 3,
): FaceSample {
  if (
    !points ||
    points.length < 264 ||
    !Number.isFinite(time) ||
    !Number.isFinite(aspect) ||
    aspect <= 0
  )
    return { ...emptyFace, time: Number.isFinite(time) ? time : 0 };
  const a = points[33],
    b = points[263],
    nose = points[1];
  if (
    [a, b, nose].some(
      (p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y),
    )
  )
    return { ...emptyFace, time };
  const dx = (b.x - a.x) * aspect,
    dy = b.y - a.y;
  const squared = dx * dx + dy * dy;
  if (!Number.isFinite(squared) || squared < 0.0004)
    return { ...emptyFace, time };
  const nx = (nose.x - (a.x + b.x) / 2) * aspect,
    ny = nose.y - (a.y + b.y) / 2;
  const x = -(nx * dx + ny * dy) / squared,
    y = (ny * dx - nx * dy) / squared;
  return Number.isFinite(x) && Number.isFinite(y)
    ? { detected: true, x, y, time }
    : { ...emptyFace, time };
}

export function faceDirection(
  face: FaceSample,
  neutral: { x: number; y: number },
): Direction | "center" {
  if (
    !face.detected ||
    ![face.x, face.y, neutral.x, neutral.y].every(Number.isFinite)
  )
    return "center";
  const x = (face.x - neutral.x) / 0.16,
    y = (face.y - neutral.y) / 0.12;
  if (Math.max(Math.abs(x), Math.abs(y)) < 1) return "center";
  return Math.abs(x) >= Math.abs(y)
    ? x > 0
      ? "right"
      : "left"
    : y > 0
      ? "down"
      : "up";
}
