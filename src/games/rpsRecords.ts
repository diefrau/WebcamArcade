import {
  rpsChoices,
  rpsOutcome,
  type RpsChoice,
  type RpsOutcome,
} from "./rpsRules";
const ROUNDS = 5;

export type RpsRound = {
  player: RpsChoice | null;
  computer: RpsChoice;
  outcome: RpsOutcome;
  responseMs?: number;
  webcam?: boolean;
};
export type RpsResult = {
  score: number;
  wins: number;
  draws: number;
  rounds: RpsRound[];
  newBest: boolean;
  saved: boolean;
};
export function readRps(): {
  best: number;
  plays: number;
  last: RpsResult | null;
} {
  try {
    const value = JSON.parse(localStorage.getItem("arcade.rps") || "null");
    if (
      value &&
      Number.isFinite(value.best) &&
      value.best >= 0 &&
      Number.isInteger(value.plays) &&
      value.plays >= 0
    ) {
      const last = value.last;
      return {
        best: value.best,
        plays: value.plays,
        last:
          last &&
          Number.isFinite(last.score) &&
          Number.isFinite(last.wins) &&
          Number.isFinite(last.draws) &&
          Array.isArray(last.rounds) &&
          last.rounds.length === ROUNDS &&
          last.rounds.every(
            (r: RpsRound) =>
              r &&
              rpsChoices.includes(r.computer) &&
              (r.player === null || rpsChoices.includes(r.player)) &&
              r.outcome === rpsOutcome(r.player, r.computer),
          )
            ? last
            : null,
      };
    }
  } catch {
    /* Storage may be unavailable. */
  }
  return { best: 0, plays: 0, last: null };
}
