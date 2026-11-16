import type { PosePoint } from "./visionTypes";

/** Bitmap and landmarks originate from the same camera frame. Owned by CameraProvider. */
export type BodyCutoutFrame = {
  bitmap: ImageBitmap;
  landmarks: PosePoint[];
  time: number;
};
export type CutoutState = "idle" | "loading" | "ready" | "unavailable";

/** Feather only the uncertain person boundary; never alter landmark scoring. */
export function maskAlpha(confidence: number) {
  const t = Math.max(0, Math.min(1, (confidence - 0.35) / 0.4));
  return Math.round(t * t * (3 - 2 * t) * 255);
}

/** Map an unmirrored camera frame onto the same shoulder anchor as the wall. */
export function cutoutPlacement(
  points: PosePoint[],
  width: number,
  height: number,
) {
  const left = points[11],
    right = points[12];
  if (
    !left ||
    !right ||
    [left, right].some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        (p.visibility ?? 1) < 0.5,
    )
  )
    return null;
  const shoulderWidth = Math.hypot(
    (left.x - right.x) * width,
    (left.y - right.y) * height,
  );
  if (shoulderWidth < width * 0.04) return null;
  return {
    x: ((left.x + right.x) * width) / 2,
    y: ((left.y + right.y) * height) / 2,
    scale: 180 / shoulderWidth,
  };
}
