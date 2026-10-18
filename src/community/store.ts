export const gameIds = ["shoot", "circle", "cham", "rps", "dodge"] as const;
export type GameId = (typeof gameIds)[number];
export type Run = {
  id: string;
  game: GameId;
  score: number;
  accuracy: number;
  seconds: number;
  date: string;
  synced?: boolean;
};
export const achievementIds = [
  "first",
  "five",
  "variety",
  "sharp",
  "artist",
  "reflex",
  "rps",
  "survivor",
] as const;
export type Progress = Record<(typeof achievementIds)[number], boolean> & {
  counts?: { plays: number; games: number };
  playedGames?: GameId[];
};
export function countProgress(progress: Progress, id: string) {
  const target =
    id === "first" ? 1 : id === "five" ? 5 : id === "variety" ? 3 : 0;
  if (!target) return null;
  const raw =
    id === "variety" ? progress.counts?.games : progress.counts?.plays;
  const value =
    progress[id as keyof typeof progress] === true
      ? target
      : Number.isInteger(raw) && raw! >= 0
        ? Math.min(target, raw!)
        : 0;
  return { value, target };
}
const caps: Record<GameId, number> = {
  shoot: 200000,
  circle: 1000,
  cham: 1000,
  rps: 500,
  dodge: 3000,
};
export function validRun(r: Run) {
  return (
    r &&
    gameIds.includes(r.game) &&
    typeof r.id === "string" &&
    /^[0-9a-f-]{36}$/i.test(r.id) &&
    Number.isInteger(r.score) &&
    r.score >= 0 &&
    r.score <= caps[r.game] &&
    Number.isInteger(r.accuracy) &&
    r.accuracy >= 0 &&
    r.accuracy <= 100 &&
    Number.isFinite(r.seconds) &&
    r.seconds >= 0 &&
    r.seconds <= 30
  );
}
export function readRuns(): Run[] {
  try {
    const v = JSON.parse(localStorage.getItem("arcade.community.runs") || "[]");
    return Array.isArray(v) ? v.filter(validRun).slice(-100) : [];
  } catch {
    return [];
  }
}
export function writeRuns(runs: Run[]) {
  try {
    const previous = readProgress(),
      next = progressFor(runs);
    next.playedGames = [
      ...new Set([
        ...(previous.playedGames || []),
        ...(next.playedGames || []),
      ]),
    ];
    next.counts = {
      plays: Math.max(previous.counts?.plays || 0, next.counts!.plays),
      games: Math.min(3, next.playedGames.length),
    };
    next.five ||= next.counts.plays >= 5;
    next.variety ||= next.counts.games >= 3;
    for (const id of achievementIds) next[id] ||= previous[id];
    localStorage.setItem("arcade.community.progress", JSON.stringify(next));
    localStorage.setItem(
      "arcade.community.runs",
      JSON.stringify(runs.slice(-100)),
    );
    return true;
  } catch {
    return false;
  }
}
export function readProgress(): Progress {
  const progress = progressFor(readRuns());
  try {
    const old = JSON.parse(
      localStorage.getItem("arcade.community.progress") || "{}",
    );
    for (const id of achievementIds) progress[id] ||= old?.[id] === true;
    const savedGames = Array.isArray(old?.playedGames)
      ? old.playedGames.filter((id: GameId) => gameIds.includes(id))
      : [];
    progress.playedGames = [
      ...new Set([...(progress.playedGames || []), ...savedGames]),
    ] as GameId[];
    const savedPlays = Number.isInteger(old?.counts?.plays)
      ? Math.max(0, Math.min(5, old.counts.plays))
      : 0;
    progress.counts = {
      plays: progress.five
        ? 5
        : Math.max(progress.first ? 1 : 0, progress.counts!.plays, savedPlays),
      games: progress.variety ? 3 : Math.min(3, progress.playedGames.length),
    };
    progress.first ||= progress.counts.plays >= 1;
    progress.five ||= progress.counts.plays >= 5;
    progress.variety ||= progress.counts.games >= 3;
  } catch {
    /* Keep valid recent runs. */
  }
  return progress;
}
export function progressFor(runs: Run[]): Progress {
  return {
    first: runs.length > 0,
    five: runs.length >= 5,
    variety: new Set(runs.map((r) => r.game)).size >= 3,
    sharp: runs.some(
      (r) => r.game === "shoot" && r.accuracy >= 90 && r.score > 0,
    ),
    artist: runs.some((r) => r.game === "circle" && r.score >= 800),
    reflex: runs.some((r) => r.game === "cham" && r.score >= 700),
    rps: runs.some((r) => r.game === "rps" && r.score >= 300),
    survivor: runs.some((r) => r.game === "dodge" && r.seconds >= 30),
    counts: {
      plays: Math.min(5, runs.length),
      games: Math.min(3, new Set(runs.map((r) => r.game)).size),
    },
    playedGames: [...new Set(runs.map((r) => r.game))],
  };
}
export function localBest(game: GameId) {
  // Existing records remain visible after the community feature is installed.
  try {
    const value = JSON.parse(
      localStorage.getItem(
        game === "shoot"
          ? "arcade.records"
          : game === "circle"
            ? "arcade.circle.best"
            : `arcade.${game}`,
      ) || "null",
    );
    const best = game === "circle" ? value : value?.best;
    return Number.isFinite(best) && best >= 0 ? (best as number) : 0;
  } catch {
    return 0;
  }
}
