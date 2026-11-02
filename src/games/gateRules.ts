import type { GameInput } from "../input/GameInputAdapter";
import { adaptGameInput } from "../input/GameInputAdapter";
import { mockVision, gateTargets } from "../input/mockPose";
import { poseSimilarity } from "../vision/shared/poseNormalization";
export type GateOutcome = {
  similarity: number;
  grade: "perfect" | "pass" | "close" | "fail";
  points: number;
};
export type GateState = {
  round: number;
  elapsed: number;
  phase: "approach" | "feedback" | "finished";
  outcomes: GateOutcome[];
};
export const GATE_APPROACH = 3.5,
  GATE_FEEDBACK = 1;
export const newGate = (): GateState => ({
  round: 0,
  elapsed: 0,
  phase: "approach",
  outcomes: [],
});
export function judgeGate(similarity: number | null): GateOutcome {
  const value = Math.max(0, Math.min(100, similarity ?? 0));
  return {
    similarity: value,
    grade:
      value >= 95
        ? "perfect"
        : value >= 80
          ? "pass"
          : value >= 60
            ? "close"
            : "fail",
    points: value >= 95 ? 300 : value >= 80 ? 150 : 0,
  };
}
export function advanceGate(
  state: GateState,
  seconds: number,
  input: GameInput,
): GateState {
  if (state.phase === "finished" || !Number.isFinite(seconds) || seconds <= 0)
    return state;
  let next = { ...state, outcomes: [...state.outcomes] },
    remaining = Math.min(seconds, 0.25);
  while (remaining > 0 && next.phase !== "finished") {
    const limit = next.phase === "approach" ? GATE_APPROACH : GATE_FEEDBACK,
      dt = Math.min(remaining, limit - next.elapsed);
    next.elapsed += dt;
    remaining -= dt;
    if (next.elapsed + 1e-8 < limit) break;
    if (next.phase === "approach") {
      const t = gateTargets[next.round],
        target = adaptGameInput(mockVision(t.left, t.right), "mock");
      next.outcomes.push(
        judgeGate(poseSimilarity(input.poseVector, target.poseVector)),
      );
      next.phase = "feedback";
      next.elapsed = 0;
    } else if (next.round === gateTargets.length - 1) {
      next.phase = "finished";
    } else {
      next.round++;
      next.phase = "approach";
      next.elapsed = 0;
    }
  }
  return next;
}
export const gateScore = (s: Pick<GateState, "outcomes">) =>
  s.outcomes.reduce((sum, r) => sum + r.points, 0);
