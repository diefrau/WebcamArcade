import type { HandSample } from "./gestures";
import type { FaceSample } from "./face";
import type { BodySample } from "./body";
import type { VisionState, TimedPoint } from "./visionTypes";
import { mirrored } from "./shared/visionCoordinate";
export function visionSnapshot(
  source: { hand: HandSample; face: FaceSample; body: BodySample },
  timestamp: number,
  indexTrajectory: TimedPoint[] = [],
): VisionState {
  const { hand, face, body } = source;
  return {
    timestamp,
    aspect: body.aspect ?? 4 / 3,
    hand: {
      detected: hand.detected,
      primary: hand.detected ? { x: hand.x, y: hand.y } : undefined,
      index:
        hand.detected && hand.landmarks[8]
          ? mirrored(hand.landmarks[8])
          : undefined,
      indexTrajectory: hand.detected ? indexTrajectory : [],
      hands: hand.detected ? [hand.landmarks] : [],
      pinched: hand.pinched,
    },
    face: {
      detected: face.detected,
      x: face.detected ? face.x : undefined,
      y: face.detected ? face.y : undefined,
    },
    pose: {
      detected: body.detected,
      landmarks: body.detected ? body.landmarks : [],
    },
    motion: {},
    segmentation: { available: false },
  };
}
