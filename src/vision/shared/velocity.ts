import type { TimedPoint } from "../visionTypes";
import { distance } from "./trajectory";
export function velocity(
  previous: TimedPoint | undefined,
  current: TimedPoint,
  maxGapMs = 250,
) {
  const dt = previous ? current.time - previous.time : 0;
  return previous && dt > 0 && dt <= maxGapMs
    ? (distance(previous, current) * 1000) / dt
    : 0;
}
