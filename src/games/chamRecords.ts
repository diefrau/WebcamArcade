import type { Direction } from "../vision/face";

export type ChamRound = {
  computer: Direction;
  player: Direction | null;
  win: boolean;
  responseMs?: number;
};
export type ChamResult = {
  gameMode?: "standard" | "hard" | "seeker";
  score: number;
  wins: number;
  rounds: ChamRound[];
  newBest: boolean;
  saved: boolean;
};
export function readCham(): {
  best: number;
  plays: number;
  last: ChamResult | null;
} {
  try {
    const value = JSON.parse(localStorage.getItem("arcade.cham") || "null");
    if (value && Number.isFinite(value.best) && Number.isFinite(value.plays))
      return value;
  } catch {
    /* Storage can be disabled. */
  }
  return { best: 0, plays: 0, last: null };
}
