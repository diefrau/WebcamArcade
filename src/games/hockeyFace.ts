import type { FaceBox, FaceMotionFrame } from "../vision/face";
import type { Point2D } from "../vision/visionTypes";
import {
  clampHockey,
  hockeyMalletTarget,
  MALLET_RADIUS,
  PLAYER_HOME,
} from "./hockeyRules";

const center = (box: FaceBox) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});
const NEUTRAL_MS = 800;

export class HockeyCalibration {
  private samples: FaceMotionFrame[] = [];

  reset() {
    this.samples = [];
  }

  add(frame: FaceMotionFrame): FaceBox | null {
    const first = this.samples[0];
    const last = this.samples.at(-1);
    if (last && frame.time <= last.time) return null;
    if (
      first &&
      last &&
      (frame.time - last.time > 240 ||
        Math.abs(center(first.box).x - center(frame.box).x) > 0.035 ||
        Math.abs(center(first.box).y - center(frame.box).y) > 0.035)
    )
      this.reset();
    this.samples.push(frame);
    if (
      this.samples.length < 5 ||
      frame.time - this.samples[0].time < NEUTRAL_MS
    )
      return null;
    const average = { x: 0, y: 0, width: 0, height: 0 };
    for (const { box } of this.samples) {
      average.x += box.x / this.samples.length;
      average.y += box.y / this.samples.length;
      average.width += box.width / this.samples.length;
      average.height += box.height / this.samples.length;
    }
    return average;
  }
}

export function hockeyFaceTarget(
  box: FaceBox,
  neutral: FaceBox,
  gain = 1.4,
): Point2D {
  const at = center(box);
  const home = center(neutral);
  const reachX = clampHockey(neutral.width * 0.72, 0.11, 0.24);
  const reachY = clampHockey(neutral.height * 0.58, 0.14, 0.27);
  return hockeyMalletTarget(
    {
      x:
        PLAYER_HOME.x +
        ((home.x - at.x) * gain * (PLAYER_HOME.x - MALLET_RADIUS - 6)) / reachX,
      y:
        PLAYER_HOME.y +
        ((at.y - home.y) * gain * (PLAYER_HOME.y - MALLET_RADIUS - 6)) / reachY,
    },
    "player",
  );
}

export function faceCrop(
  box: FaceBox,
  videoWidth: number,
  videoHeight: number,
) {
  const at = center(box);
  const size = Math.min(
    videoWidth,
    videoHeight,
    Math.max(box.width * videoWidth, box.height * videoHeight) * 1.18,
  );
  return {
    size,
    x: clampHockey(at.x * videoWidth - size / 2, 0, videoWidth - size),
    y: clampHockey(at.y * videoHeight - size / 2, 0, videoHeight - size),
  };
}
