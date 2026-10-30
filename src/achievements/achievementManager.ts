import raw from "./catalog.json";
import ko from "../locales/ko.json";
import en from "../locales/en.json";
import {
  gameIds,
  readRuns,
  readProgress,
  type Progress,
} from "../community/store";
import { readSecrets, type SecretId } from "../community/secrets";
import { announceAchievement } from "../community/achievementNotices";
import type {
  AchievementDefinition,
  AchievementState,
  GameResultEvent,
  PlayerStats,
} from "./types";
export const achievements = raw as AchievementDefinition[];
export const ACHIEVEMENT_KEY = "arcade.achievements.v1";
export const legacyIds = [
  "first",
  "five",
  "variety",
  "sharp",
  "artist",
  "reflex",
  "rps",
  "survivor",
] as const;
let memory: AchievementState | null = null;
const sessionGames = new Set<string>();
let warmupGames: string[] = [];
const liveMetrics = new Set(["session", "warmup", "daily"]);
const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0;
export const localDay = (date: string) => {
  const d = new Date(date);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};
function emptyStats(): PlayerStats {
  return {
    totalGamesCompleted: 0,
    completedGameIds: [],
    gamePlayCount: {},
    bestScores: {},
    totalShootHits: 0,
    consecutiveSameGameCount: 0,
    recordGameIds: [],
    dailyCompletedGames: {},
    rpsWinStreak: 0,
    chamWinStreak: 0,
    circleHighStreak: 0,
    facts: {},
  };
}
function save(state: AchievementState) {
  state.unlockedIds = Object.keys(state.unlockedAt);
  memory = state;
  try {
    localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(state));
  } catch {
    /* Keep this session usable when storage is blocked. */
  }
}
function metrics(state: AchievementState) {
  const s = state.stats;
  return {
    ...s.facts,
    total: s.totalGamesCompleted,
    variety: s.completedGameIds.length,
    session: sessionGames.size,
    same: s.consecutiveSameGameCount,
    warmup: new Set(warmupGames).size,
    records: s.recordGameIds.length,
    daily: s.dailyCompletedGames[localDay(new Date().toISOString())] ?? 0,
    "shoot.totalHits": s.totalShootHits,
    ...Object.fromEntries(
      gameIds.flatMap((id) => [
        ["score." + id, s.bestScores[id] ?? 0],
        ["plays." + id, s.gamePlayCount[id] ?? 0],
      ]),
    ),
  } as Record<string, number>;
}
function apply(
  state: AchievementState,
  peaks: Record<string, number> = {},
  at = Date.now(),
) {
  const values = metrics(state);
  const newlyUnlocked: string[] = [];
  for (const definition of achievements) {
    if (definition.pending || definition.category === "secret") continue;
    const id = definition.id,
      value = values[definition.metric] ?? 0;
    const resets = [
      "same",
      "warmup",
      "daily",
      "circle.streak",
      "cham.streak",
      "rps.streak",
    ].includes(definition.metric);
    const progress = resets ? value : Math.max(state.progress[id] ?? 0, value);
    if (
      !(id in state.unlockedAt) &&
      Math.max(progress, peaks[definition.metric] ?? 0) >= definition.target
    ) {
      state.unlockedAt[id] = at;
      newlyUnlocked.push(id);
    }
    state.progress[id] =
      id in state.unlockedAt
        ? definition.target
        : Math.min(definition.target, progress);
  }
  return newlyUnlocked;
}
export function achievementTitle(id: string): [string, string] {
  const k = ko.achievements.items as Record<string, { title: string }>,
    e = en.achievements.items as Record<string, { title: string }>;
  return [k[id]?.title ?? id, e[id]?.title ?? id];
}
/** Old unlocks survive; absent historical telemetry never grants a new skill badge. */
export function readAchievementState(): AchievementState {
  if (memory) return memory;
  try {
    const stored = JSON.parse(localStorage.getItem(ACHIEVEMENT_KEY) || "null");
    if (
      stored?.version === 1 &&
      stored.stats &&
      Array.isArray(stored.processedIds) &&
      stored.unlockedAt &&
      stored.progress
    ) {
      const base = emptyStats();
      const stats = { ...base, ...stored.stats };
      const numericMap = (value: unknown) =>
        !!value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.values(value).every(finite);
      if (
        !finite(stats.totalGamesCompleted) ||
        ![
          "totalShootHits",
          "consecutiveSameGameCount",
          "rpsWinStreak",
          "chamWinStreak",
          "circleHighStreak",
        ].every((key) => finite(stats[key])) ||
        !["completedGameIds", "recordGameIds"].every(
          (key) =>
            Array.isArray(stats[key]) &&
            stats[key].every((id: unknown) =>
              gameIds.includes(id as (typeof gameIds)[number]),
            ),
        ) ||
        !["gamePlayCount", "bestScores", "dailyCompletedGames", "facts"].every(
          (key) => numericMap(stats[key]),
        ) ||
        !gameIds.every(
          (id) =>
            stats.gamePlayCount[id] === undefined ||
            finite(stats.gamePlayCount[id]),
        )
      )
        throw Error("invalid stats");
      const known = new Set(achievements.map((a) => a.id));
      const lastResults = Object.fromEntries(
        gameIds.flatMap((game) => {
          const receipt = stored.lastResults?.[game];
          return receipt &&
            typeof receipt.runId === "string" &&
            Array.isArray(receipt.unlockedIds)
            ? [
                [
                  game,
                  {
                    runId: receipt.runId,
                    unlockedIds: receipt.unlockedIds.filter(
                      (id: unknown) => typeof id === "string" && known.has(id),
                    ),
                  },
                ],
              ]
            : [];
        }),
      );
      const unlockedAt = Object.fromEntries(
        Object.entries(stored.unlockedAt).filter(
          ([id, time]) => known.has(id) && finite(time),
        ),
      );
      memory = {
        version: 1,
        stats,
        lastResults,
        unlockedAt,
        unlockedIds: Object.keys(unlockedAt),
        progress: Object.fromEntries(
          Object.entries(stored.progress).filter(
            ([id, value]) => known.has(id) && finite(value),
          ),
        ),
        processedIds: stored.processedIds
          .filter((id: unknown) => typeof id === "string")
          .slice(-500),
      } as AchievementState;
      // Session goals deliberately do not restore from the previous document.
      for (const id of ["sessionAll", "warmup"])
        if (!(id in memory.unlockedAt)) memory.progress[id] = 0;
      return memory;
    }
  } catch {
    /* Migrate valid existing community records instead of failing the page. */
  }
  const runs = readRuns(),
    previous = readProgress(),
    stats = emptyStats();
  stats.totalGamesCompleted = Math.max(
    runs.length,
    previous.counts?.plays ?? 0,
  );
  stats.completedGameIds = [
    ...new Set([...(previous.playedGames ?? []), ...runs.map((r) => r.game)]),
  ];
  for (const run of runs) {
    stats.gamePlayCount[run.game] = (stats.gamePlayCount[run.game] ?? 0) + 1;
    stats.bestScores[run.game] = Math.max(
      stats.bestScores[run.game] ?? 0,
      run.score,
    );
    const day = localDay(run.date);
    stats.dailyCompletedGames[day] = (stats.dailyCompletedGames[day] ?? 0) + 1;
    if (run.game === "circle" && run.score > 0)
      stats.facts["circle.complete"] = 1;
    if (run.game === "dodge")
      stats.facts["duration.dodge"] = Math.max(
        stats.facts["duration.dodge"] ?? 0,
        run.seconds,
      );
  }
  const state: AchievementState = {
    version: 1,
    stats,
    unlockedAt: {},
    unlockedIds: [],
    progress: {},
    processedIds: runs.map((r) => r.id),
  };
  for (const id of legacyIds) if (previous[id]) state.unlockedAt[id] = 0;
  for (const record of readSecrets())
    state.unlockedAt[record.id] = Date.parse(record.date) || 0;
  apply(state, {}, 0);
  save(state);
  return state;
}
export function syncSecretAchievement(id: SecretId, date: string) {
  const state = structuredClone(readAchievementState());
  state.unlockedAt[id] ??= Date.parse(date) || 0;
  save(state);
}
export function validResult(event: GameResultEvent) {
  const caps = {
    shoot: 200000,
    circle: 1000,
    cham: 1000,
    rps: 500,
    dodge: 3000,
  };
  if (
    !event ||
    !event.completed ||
    !gameIds.includes(event.gameId) ||
    !/^[0-9a-f-]{36}$/i.test(event.id) ||
    !Number.isInteger(event.score) ||
    event.score < 0 ||
    event.score > caps[event.gameId] ||
    !finite(event.duration) ||
    event.duration > 3600 ||
    !finite(event.accuracy) ||
    event.accuracy > 100 ||
    !Number.isFinite(Date.parse(event.date))
  )
    return false;
  for (const key of [
    "hits",
    "shots",
    "misses",
    "maxCombo",
    "recognitionFailures",
    "trackingLosses",
  ] as const)
    if (
      event[key] !== undefined &&
      (!Number.isInteger(event[key]) || !finite(event[key]))
    )
      return false;
  if (
    event.hits !== undefined &&
    event.shots !== undefined &&
    event.hits > event.shots
  )
    return false;
  if (event.fastestSuccessMs !== undefined && !finite(event.fastestSuccessMs))
    return false;
  if (
    event.rounds &&
    (!Array.isArray(event.rounds) ||
      event.rounds.length > 10 ||
      event.rounds.some(
        (r) =>
          !r ||
          typeof r.win !== "boolean" ||
          (r.choice !== undefined &&
            !["rock", "paper", "scissors"].includes(r.choice)) ||
          (r.webcam !== undefined && typeof r.webcam !== "boolean") ||
          (r.responseMs !== undefined && !finite(r.responseMs)),
      ))
  )
    return false;
  if (
    event.metadata !== undefined &&
    (!event.metadata ||
      typeof event.metadata !== "object" ||
      ["maxSafeSeconds", "maxAvoidStreak", "dodged"].some((key) => {
        const value = (event.metadata as Record<string, unknown>)[key];
        return value !== undefined && !finite(value);
      }))
  )
    return false;
  return true;
}
export function recordGameResult(event: GameResultEvent): boolean {
  if (!validResult(event)) return false;
  const old = readAchievementState();
  if (old.processedIds.includes(event.id)) return false;
  const state = structuredClone(old),
    s = state.stats,
    g = event.gameId,
    peaks: Record<string, number> = {};
  state.processedIds = [...state.processedIds, event.id].slice(-500);
  s.totalGamesCompleted++;
  s.gamePlayCount[g] = (s.gamePlayCount[g] ?? 0) + 1;
  if (!s.completedGameIds.includes(g)) s.completedGameIds.push(g);
  sessionGames.add(g);
  s.consecutiveSameGameCount =
    s.lastGame === g ? s.consecutiveSameGameCount + 1 : 1;
  s.lastGame = g;
  if (event.metadata?.passed === true)
    warmupGames = [...warmupGames, g].slice(-3);
  else warmupGames = [];
  const newBest = event.newBest ?? event.score > (s.bestScores[g] ?? 0);
  if (newBest && event.score > 0 && !s.recordGameIds.includes(g))
    s.recordGameIds.push(g);
  s.bestScores[g] = Math.max(s.bestScores[g] ?? 0, event.score);
  const day = localDay(event.date);
  s.dailyCompletedGames[day] = (s.dailyCompletedGames[day] ?? 0) + 1;
  const days = Object.keys(s.dailyCompletedGames).sort().slice(-90);
  s.dailyCompletedGames = Object.fromEntries(
    days.map((d) => [d, s.dailyCompletedGames[d]]),
  );
  const set = (key: string, value: number) => {
    s.facts[key] = Math.max(s.facts[key] ?? 0, value);
  };
  const flag = (key: string, condition: boolean) => {
    if (condition) set(key, 1);
  };
  if (g === "shoot") {
    const hits = event.hits ?? 0,
      shots = event.shots ?? 0;
    s.totalShootHits += hits;
    set("shoot.hits", hits);
    set("shoot.combo", event.maxCombo ?? 0);
    flag(
      "shoot.precise",
      shots >= 10 && hits > 0 && event.score > 0 && event.accuracy >= 90,
    );
    flag(
      "shoot.perfect",
      shots >= 10 && hits === shots && event.accuracy === 100,
    );
    flag(
      "shoot.fast",
      hits > 0 &&
        event.fastestSuccessMs !== undefined &&
        event.fastestSuccessMs <= 350,
    );
    flag("legacy.sharp", event.score > 0 && event.accuracy >= 90);
  } else if (g === "circle") {
    flag(
      "circle.complete",
      event.metadata?.drawComplete === true ||
        (event.score > 0 && event.metadata?.drawComplete !== false),
    );
    flag(
      "circle.unbroken",
      event.inputMode === "hand" &&
        event.trackingLosses === 0 &&
        event.metadata?.drawComplete === true,
    );
    flag(
      "circle.fast",
      event.score >= 800 &&
        event.duration <= 3 &&
        event.metadata?.drawComplete === true,
    );
    s.circleHighStreak = event.score >= 800 ? s.circleHighStreak + 1 : 0;
    s.facts["circle.streak"] = s.circleHighStreak;
  } else if (g === "cham" || g === "rps") {
    const rounds = event.rounds ?? [];
    for (const round of rounds) {
      const key = g === "cham" ? "chamWinStreak" : "rpsWinStreak";
      s[key] = round.win ? s[key] + 1 : 0;
      peaks[g + ".streak"] = Math.max(peaks[g + ".streak"] ?? 0, s[key]);
    }
    s.facts[g + ".streak"] = s[g === "cham" ? "chamWinStreak" : "rpsWinStreak"];
    if (g === "cham") {
      flag("cham.perfect", rounds.length === 10 && rounds.every((r) => r.win));
      flag(
        "cham.fast",
        rounds.some(
          (r) => r.win && r.responseMs !== undefined && r.responseMs <= 400,
        ),
      );
    } else {
      set("rps.wins", rounds.filter((r) => r.win).length);
      flag(
        "rps.fast",
        rounds.some(
          (r) =>
            r.webcam &&
            r.choice &&
            r.responseMs !== undefined &&
            r.responseMs <= 500,
        ),
      );
      flag(
        "rps.recognized",
        rounds.length === 5 &&
          rounds.every((r) => r.webcam && r.choice) &&
          event.recognitionFailures === 0,
      );
      flag(
        "rps.trio",
        new Set(
          rounds
            .filter((r) => r.win)
            .map((r) => r.choice)
            .filter(Boolean),
        ).size === 3,
      );
      set(
        "rps.rock",
        rounds.filter((r) => r.win && r.choice === "rock").length,
      );
      set(
        "rps.paper",
        rounds.filter((r) => r.win && r.choice === "paper").length,
      );
    }
  } else if (g === "dodge") {
    set("duration.dodge", event.duration);
    set("dodge.avoids", event.metadata?.dodged ?? 0);
    if (finite(event.metadata?.maxSafeSeconds))
      set("dodge.safe", event.metadata.maxSafeSeconds);
    if (finite(event.metadata?.maxAvoidStreak))
      set("dodge.streak", event.metadata.maxAvoidStreak);
  }
  const newlyUnlocked = apply(state, peaks, Date.parse(event.date));
  state.lastResults = {
    ...state.lastResults,
    [g]: { runId: event.id, unlockedIds: newlyUnlocked },
  };
  save(state);
  for (const id of newlyUnlocked)
    announceAchievement({ id, title: achievementTitle(id), secret: false });
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("arcade:achievements"));
  return true;
}
export function achievementSnapshot(remote?: Progress) {
  const state = readAchievementState();
  const current = metrics(state);
  const secrets = new Map(readSecrets().map((r) => [r.id, r.date]));
  return achievements.map((definition) => {
    const id = definition.id;
    const server =
      legacyIds.includes(id as (typeof legacyIds)[number]) &&
      remote?.[id as (typeof legacyIds)[number]] === true;
    const secret =
      secrets.has(id as SecretId) || remote?.secrets?.[id as SecretId] === true;
    const unlocked =
      !definition.pending && (id in state.unlockedAt || server || secret);
    const counter = ["first", "five"].includes(id)
      ? remote?.counts?.plays
      : id === "variety"
        ? remote?.counts?.games
        : 0;
    return {
      ...definition,
      unlocked,
      progress: unlocked
        ? definition.target
        : Math.min(
            definition.target,
            Math.max(
              liveMetrics.has(definition.metric)
                ? (current[definition.metric] ?? 0)
                : (state.progress[id] ?? 0),
              counter ?? 0,
            ),
          ),
      unlockedAt:
        state.unlockedAt[id] ??
        (secrets.has(id as SecretId)
          ? Date.parse(secrets.get(id as SecretId)!)
          : 0),
    };
  });
}
