export type Point2D = { x: number; y: number };
export type TimedPoint = Point2D & { time: number };
export type PosePoint = Point2D & { visibility?: number };
/** Provider-neutral contract: no fabricated handedness or segmentation output. */
export interface VisionState {
  timestamp: number;
  aspect?: number;
  hand: {
    detected: boolean;
    primary?: Point2D;
    index?: Point2D;
    indexTrajectory: TimedPoint[];
    hands: PosePoint[][];
    pinched: boolean;
  };
  face: { detected: boolean; x?: number; y?: number };
  pose: { detected: boolean; landmarks: PosePoint[] };
  motion: {
    bodyVelocity?: number;
    leftArmVelocity?: number;
    rightArmVelocity?: number;
  };
  segmentation: { available: boolean; mask?: ImageData | OffscreenCanvas };
}
