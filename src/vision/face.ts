import type { Landmark } from "./gestures";

export type Direction = "left" | "right" | "up" | "down";
export type FaceSample = {
  detected: boolean;
  x: number;
  y: number;
  time: number;
};
export const emptyFace: FaceSample = { detected: false, x: 0, y: 0, time: 0 };

/** Normalized bounds in the unmirrored camera image. */
export type FaceBox = { x: number; y: number; width: number; height: number };
export type FaceAim = { roll: number; jawOpen: number };
export type FaceMotionFrame = { box: FaceBox; time: number; aim?: FaceAim };
const faceContour = [10, 152, 234, 454, 127, 356, 172, 397, 338, 109, 199, 175];

export function faceLandmarkBox(points?: Landmark[]): FaceBox | null {
  if (!points) return null;
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (const index of faceContour) {
    const point = points[index];
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y))
      return null;
    left = Math.min(left, point.x);
    right = Math.max(right, point.x);
    top = Math.min(top, point.y);
    bottom = Math.max(bottom, point.y);
  }
  const width = right - left;
  const height = bottom - top;
  if (
    width < 0.06 ||
    height < 0.09 ||
    width > 0.96 ||
    height > 1.1 ||
    left + width / 2 < 0 ||
    right - width / 2 > 1 ||
    top + height / 2 < 0 ||
    bottom - height / 2 > 1
  )
    return null;
  return { x: left, y: top, width, height };
}

export function faceAimSample(
  points: Landmark[] | undefined,
  aspect: number,
  jawOpen: number | undefined,
): FaceAim | undefined {
  if (
    !points ||
    jawOpen === undefined ||
    !Number.isFinite(jawOpen)
  )
    return;
  const face = faceSample(points, 0, aspect);
  if (!face.detected || Math.abs(face.x) > 0.37) return;
  const left = points[33];
  const right = points[263];
  const dx = (right.x - left.x) * aspect;
  if (dx <= 0) return;
  // In the mirrored view a clockwise roll in the raw video aims left.
  const roll = -Math.atan2(right.y - left.y, dx);
  return { roll, jawOpen };
}

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
  const x = (face.x - neutral.x) / 0.12,
    y = (face.y - neutral.y) / 0.1;
  if (Math.max(Math.abs(x), Math.abs(y)) < 1) return "center";
  return Math.abs(x) >= Math.abs(y)
    ? x > 0
      ? "right"
      : "left"
    : y > 0
      ? "down"
      : "up";
}
