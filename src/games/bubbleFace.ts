import type { FaceAim } from "../vision/face";
import { BUBBLE_ANGLE_LIMIT } from "./bubbleRules";

const RAD = Math.PI / 180;
const MAX_SAMPLE_GAP = 180;
export const BUBBLE_HOLD_MS = 380;
const CLOSED_MS = 115;
const NEUTRAL_MS = 650;

export function rollAngle(roll: number, neutral: number) {
  const delta = roll - neutral;
  const fraction = Math.max(0, Math.min(1, (Math.abs(delta) / RAD - 4) / 20));
  return Math.sign(delta) * fraction * BUBBLE_ANGLE_LIMIT;
}

export class BubbleFaceInput {
  neutral: number | null = null;
  angle = 0;
  hold = 0;
  private lastTime = -Infinity;
  private samples: { roll: number; time: number }[] = [];
  private closedAt: number | null = null;
  private openingAt: number | null = null;
  private armed = false;

  stop() {
    this.samples = [];
    this.lastTime = -Infinity;
    this.closedAt = null;
    this.openingAt = null;
    this.armed = false;
    this.hold = 0;
  }

  recalibrate() {
    this.stop();
    this.neutral = null;
    this.angle = 0;
  }

  update(face: FaceAim, time: number, playing: boolean): number | null {
    if (time <= this.lastTime) return null;
    let dt = time - this.lastTime;
    if (dt > MAX_SAMPLE_GAP) {
      this.stop();
      dt = 45;
    }
    this.lastTime = time;
    const mouthClosed = face.jawOpen < 0.23;
    if (this.neutral === null) {
      if (!mouthClosed) {
        this.samples = [];
        return null;
      }
      if (
        this.samples[0] &&
        Math.abs(face.roll - this.samples[0].roll) > 4 * RAD
      )
        this.samples = [];
      this.samples.push({ roll: face.roll, time });
      if (
        this.samples.length >= 5 &&
        time - this.samples[0].time >= NEUTRAL_MS
      ) {
        this.neutral =
          this.samples.reduce((sum, sample) => sum + sample.roll, 0) /
          this.samples.length;
        this.samples = [];
      }
      return null;
    }

    if (!playing) return null;
    if (mouthClosed) {
      this.openingAt = null;
      this.hold = 0;
      this.closedAt ??= time;
      if (time - this.closedAt >= CLOSED_MS) this.armed = true;
      const target = rollAngle(face.roll, this.neutral);
      this.angle += (target - this.angle) * (1 - Math.exp(-dt / 68));
      return null;
    }

    this.closedAt = null;
    const threshold = this.openingAt === null ? 0.55 : 0.43;
    if (!this.armed || face.jawOpen < threshold) {
      this.openingAt = null;
      this.hold = 0;
      return null;
    }
    this.openingAt ??= time;
    this.hold = Math.min(1, (time - this.openingAt) / BUBBLE_HOLD_MS);
    if (this.hold < 1) return null;
    this.armed = false;
    this.openingAt = null;
    this.hold = 0;
    return this.angle;
  }
}
