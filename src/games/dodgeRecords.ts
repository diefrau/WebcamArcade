import type { GameMode } from "../community/store";

export type DodgeResult = {
  gameMode?: GameMode;
  score: number;
  seconds: number;
  dodged: number;
  hits: number;
  cleared: boolean;
  newBest: boolean;
  saved: boolean;
};
export function readDodge(): {
  best: number;
  plays: number;
  last: DodgeResult | null;
} {
  try {
    const v = JSON.parse(localStorage.getItem("arcade.dodge") || "null");
    if (
      v &&
      Number.isFinite(v.best) &&
      v.best >= 0 &&
      Number.isInteger(v.plays) &&
      v.plays >= 0
    ) {
      const r = v.last;
      return {
        best: v.best,
        plays: v.plays,
        last:
          r &&
          Number.isFinite(r.score) &&
          r.score >= 0 &&
          Number.isFinite(r.seconds) &&
          r.seconds >= 0 &&
          r.seconds <= 31536000 &&
          Number.isInteger(r.dodged) &&
          r.dodged >= 0 &&
          Number.isInteger(r.hits) &&
          r.hits >= 0 &&
          r.hits <= 3 &&
          typeof r.cleared === "boolean"
            ? r
            : null,
      };
    }
  } catch {
    /* Storage can be blocked. */
  }
  return { best: 0, plays: 0, last: null };
}
