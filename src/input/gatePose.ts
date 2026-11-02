import type { GameInput } from "./GameInputAdapter";
import { adaptGameInput } from "./GameInputAdapter";
import type { VisionState, Point2D } from "../vision/visionTypes";
import { upperBodyIds } from "../vision/shared/poseNormalization";
import { smoothPoint } from "../vision/shared/smoothing";
export type GatePoseReading = {
  input: GameInput;
  ready: boolean;
  progress: number;
};
/** Per-frame adapter only: owns no camera, model, timer or Worker. */
export class GatePoseTracker {
  private since: number | null = null;
  private frames = 0;
  private calibrated = false;
  private last = 0;
  private smoothed: Point2D[] | null = null;
  private anchor: { x: number; y: number; width: number } | null = null;
  reset() {
    this.since = null;
    this.frames = 0;
    this.calibrated = false;
    this.last = 0;
    this.smoothed = null;
    this.anchor = null;
  }
  update(state: VisionState, now: number): GatePoseReading {
    const input = adaptGameInput(state),
      points = state.pose.landmarks;
    const visible =
      state.pose.detected &&
      input.poseVector !== null &&
      Number.isFinite(state.timestamp) &&
      state.timestamp <= now &&
      now - state.timestamp < 900 &&
      upperBodyIds.every(
        (i) =>
          points[i].x >= 0.02 &&
          points[i].x <= 0.98 &&
          points[i].y >= 0.02 &&
          points[i].y <= 0.98 &&
          Number.isFinite(points[i].visibility ?? 1) &&
          (points[i].visibility ?? 1) >= 0.5,
      );
    if (!visible) {
      this.smoothed = null;
      if (!this.calibrated) {
        this.since = null;
        this.frames = 0;
        this.anchor = null;
      }
      return {
        input: { ...input, poseVector: null },
        ready: false,
        progress: this.calibrated ? 100 : 0,
      };
    }
    if (state.timestamp < this.last) this.reset();
    const center = {
      x: (points[11].x + points[12].x) / 2,
      y: (points[11].y + points[12].y) / 2,
      width: Math.hypot(
        points[11].x - points[12].x,
        points[11].y - points[12].y,
      ),
    };
    if (!this.calibrated) {
      if (
        !this.anchor ||
        Math.hypot(center.x - this.anchor.x, center.y - this.anchor.y) > 0.08 ||
        Math.abs(center.width - this.anchor.width) > this.anchor.width * 0.35
      ) {
        this.anchor = center;
        this.since = state.timestamp;
        this.frames = 0;
      }
      if (state.timestamp !== this.last) this.frames++;
      this.since ??= state.timestamp;
      this.calibrated =
        state.timestamp - this.since >= 1200 && this.frames >= 10;
    }
    const dt = state.timestamp - this.last;
    this.smoothed =
      this.smoothed && dt >= 0 && dt <= 250
        ? input.poseVector!.map((p, i) =>
            smoothPoint(this.smoothed![i], p, dt, 70),
          )
        : input.poseVector;
    this.last = state.timestamp;
    return {
      input: { ...input, poseVector: this.smoothed },
      ready: this.calibrated,
      progress: this.calibrated
        ? 100
        : Math.min(
            99,
            Math.round(
              (state.timestamp - (this.since ?? state.timestamp)) / 12,
            ),
          ),
    };
  }
}
