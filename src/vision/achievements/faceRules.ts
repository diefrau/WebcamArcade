import type { HomeMotionFrame } from "./types";
export function faceVisible(frame: HomeMotionFrame) {
  return (
    frame.face.length >= 264 &&
    [1, 33, 263].every((i) => {
      const p = frame.face[i];
      return (
        p && [p.x, p.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
      );
    }) &&
    Math.hypot(
      frame.face[33].x - frame.face[263].x,
      frame.face[33].y - frame.face[263].y,
    ) > 0.02
  );
}
export function faceExpression(frame: HomeMotionFrame, key: string) {
  const score = frame.expressions[key];
  return Number.isFinite(score) ? score : 0;
}
export function oneEyeWink(frame: HomeMotionFrame) {
  const left = faceExpression(frame, "eyeBlinkLeft"),
    right = faceExpression(frame, "eyeBlinkRight");
  return (left > 0.65 && right < 0.25) || (right > 0.65 && left < 0.25);
}
