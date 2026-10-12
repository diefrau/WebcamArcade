import type { Landmark } from "./gestures";
export type BodyPoint = Landmark & { visibility?: number };
export type BodySample = {
  detected: boolean;
  x: number;
  width: number;
  landmarks: BodyPoint[];
};
export const emptyBody: BodySample = {
  detected: false,
  x: 0.5,
  width: 0,
  landmarks: [],
};
export function bodySample(points?: BodyPoint[]): BodySample {
  if (!points || points.length !== 33) return { ...emptyBody };
  const shoulders = [points[11], points[12]];
  if (
    shoulders.some(
      (p) =>
        !p ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.x > 1 ||
        p.y < 0 ||
        p.y > 1 ||
        !Number.isFinite(p.visibility) ||
        p.visibility! < 0.6,
    )
  )
    return { ...emptyBody };
  const width = Math.abs(shoulders[0].x - shoulders[1].x);
  if (width < 0.04) return { ...emptyBody };
  return {
    detected: true,
    x: 1 - (shoulders[0].x + shoulders[1].x) / 2,
    width,
    landmarks: points,
  };
}
export function bodyTarget(body: BodySample, center: number, width: number) {
  return Math.max(
    0.1,
    Math.min(0.9, 0.5 + (body.x - center) / Math.max(0.16, width * 1.8)),
  );
}
