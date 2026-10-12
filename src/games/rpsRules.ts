import type { Landmark } from "../vision/gestures";

export const rpsChoices = ["rock", "paper", "scissors"] as const;
export type RpsChoice = (typeof rpsChoices)[number];
export type RpsOutcome = "win" | "draw" | "lose" | "timeout";
export function rpsOutcome(
  player: RpsChoice | null,
  computer: RpsChoice,
): RpsOutcome {
  if (!player) return "timeout";
  if (player === computer) return "draw";
  return (player === "rock" && computer === "scissors") ||
    (player === "paper" && computer === "rock") ||
    (player === "scissors" && computer === "paper")
    ? "win"
    : "lose";
}
export const rpsPoints = (outcome: RpsOutcome) =>
  outcome === "win" ? 100 : outcome === "draw" ? 30 : 0;

/** Finger joint angles and wrist-relative lengths; independent of hand translation/size. */
export function classifyRps(
  points: Landmark[],
  aspect = 4 / 3,
): RpsChoice | null {
  if (
    points.length !== 21 ||
    !Number.isFinite(aspect) ||
    aspect <= 0 ||
    points.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    return null;
  const distance = (a: Landmark, b: Landmark) =>
    Math.hypot((a.x - b.x) * aspect, a.y - b.y);
  if (distance(points[5], points[17]) < 0.015) return null;
  const fingers = [5, 9, 13, 17].map((index) => {
    const mcp = points[index],
      pip = points[index + 1],
      tip = points[index + 3];
    const ax = (mcp.x - pip.x) * aspect,
      ay = mcp.y - pip.y;
    const bx = (tip.x - pip.x) * aspect,
      by = tip.y - pip.y;
    const length = Math.hypot(ax, ay) * Math.hypot(bx, by);
    if (length < 0.00001) return "unknown";
    const angle =
      (Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / length))) *
        180) /
      Math.PI;
    const reach =
      distance(tip, points[0]) / Math.max(0.001, distance(pip, points[0]));
    return angle > 150 && reach > 1.15
      ? "open"
      : angle < 125 && reach < 1.1
        ? "closed"
        : "unknown";
  });
  if (fingers.every((finger) => finger === "open")) return "paper";
  if (fingers.every((finger) => finger === "closed")) return "rock";
  if (
    fingers[0] === "open" &&
    fingers[1] === "open" &&
    fingers[2] === "closed" &&
    fingers[3] === "closed"
  )
    return "scissors";
  return null;
}
