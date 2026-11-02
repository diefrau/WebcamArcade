import type { VisionState, PosePoint } from "../vision/visionTypes";
export function mockPose(left: number, right: number): PosePoint[] {
  const p = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.7,
    visibility: 1,
  }));
  p[0] = { x: 0.5, y: 0.2, visibility: 1 };
  p[11] = { x: 0.35, y: 0.45, visibility: 1 };
  p[12] = { x: 0.65, y: 0.45, visibility: 1 };
  for (const [shoulder, elbow, wrist, degrees, sign] of [
    [11, 13, 15, left, -1],
    [12, 14, 16, right, 1],
  ]) {
    const r = (degrees * Math.PI) / 180;
    const base = p[shoulder];
    p[elbow] = {
      x: base.x + sign * Math.cos(r) * 0.13,
      y: base.y - Math.sin(r) * 0.13,
      visibility: 1,
    };
    p[wrist] = {
      x: base.x + sign * Math.cos(r) * 0.26,
      y: base.y - Math.sin(r) * 0.26,
      visibility: 1,
    };
  }
  return p;
}
export function mockVision(
  left: number,
  right: number,
  timestamp = 0,
): VisionState {
  return {
    timestamp,
    hand: { detected: false, indexTrajectory: [], hands: [], pinched: false },
    face: { detected: false },
    pose: { detected: true, landmarks: mockPose(left, right) },
    motion: {},
    segmentation: { available: false },
  };
}
export const gateTargets = [
  { left: 90, right: 90 },
  { left: 0, right: 0 },
  { left: 90, right: 0 },
  { left: 0, right: 90 },
  { left: 45, right: 45 },
];
