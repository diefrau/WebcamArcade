import type { Landmark } from "../gestures";
export type HomeMotionFrame = {
  time: number;
  aspect: number;
  hands: Landmark[][];
  face: Landmark[];
  expressions: Record<string, number>;
};
