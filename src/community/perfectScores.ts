import type { GameId, GameMode, Run } from "./store";
/** Reachable gameplay ceilings, not database validation limits. */
export function perfectScore(
  game: GameId,
  mode: GameMode = "standard",
): number | null {
  if (game === "circle" && mode === "standard") return 1000;
  if (game === "cham" && ["standard", "hard", "seeker"].includes(mode))
    return 1000;
  if (game === "rps" && mode === "standard") return 500;
  if (game === "shoot" && mode === "wave") return 2500;
  return null;
}
const key = "arcade.perfect-counts.v1";
type Counts = { counts: Record<string, number>; processedIds: string[] };
function readCounts(runs: Run[]): Counts {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    if (
      value &&
      value.counts &&
      typeof value.counts === "object" &&
      !Array.isArray(value.counts) &&
      Object.values(value.counts).every(
        (v) => Number.isSafeInteger(v) && Number(v) >= 0,
      ) &&
      Array.isArray(value.processedIds)
    )
      return {
        counts: { ...value.counts },
        processedIds: value.processedIds
          .filter((v: unknown) => typeof v === "string")
          .slice(-500),
      };
  } catch {
    /* Derive only observed completions. */
  }
  const state: Counts = { counts: {}, processedIds: [] };
  for (const run of runs) applyRun(state, run);
  return state;
}
function applyRun(state: Counts, run: Run) {
  if (state.processedIds.includes(run.id)) return;
  state.processedIds = [...state.processedIds, run.id].slice(-500);
  const mode = run.details?.gameMode ?? "standard";
  if (perfectScore(run.game, mode) !== run.score) return;
  const id = `${run.game}:${mode}`;
  state.counts[id] = (state.counts[id] ?? 0) + 1;
}
export function recordPerfectRun(run: Run, history: Run[]) {
  const state = readCounts(history);
  applyRun(state, run);
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* Recent history remains available. */
  }
}
export function perfectCount(game: GameId, mode: GameMode, history: Run[]) {
  return readCounts(history).counts[`${game}:${mode}`] ?? 0;
}
