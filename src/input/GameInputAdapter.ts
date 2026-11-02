import type { VisionState, Point2D } from "../vision/visionTypes";
import { normalizePose } from "../vision/shared/poseNormalization";
import { mirrored } from "../vision/shared/visionCoordinate";
export type GameInput = {
  timestamp: number;
  aim?: Point2D;
  fire: boolean;
  indexPath: VisionState["hand"]["indexTrajectory"];
  bodyCenter?: Point2D;
  poseVector: Point2D[] | null;
  motionAmount?: number;
  source: "mock" | "vision";
};
export function adaptGameInput(
  state: VisionState,
  source: "mock" | "vision" = "vision",
): GameInput {
  const left = state.pose.landmarks[11],
    right = state.pose.landmarks[12];
  return {
    timestamp: state.timestamp,
    aim: state.hand.detected ? state.hand.primary : undefined,
    fire: state.hand.detected && state.hand.pinched,
    indexPath: state.hand.detected ? state.hand.indexTrajectory : [],
    bodyCenter:
      state.pose.detected && left && right
        ? mirrored({ x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 })
        : undefined,
    poseVector: state.pose.detected
      ? normalizePose(
          source === "mock"
            ? state.pose.landmarks
            : state.pose.landmarks.map((p) => ({
                ...p,
                x: (1 - p.x) * (state.aspect ?? 4 / 3),
                y: p.y,
              })),
        )
      : null,
    motionAmount: state.motion.bodyVelocity,
    source,
  };
}
