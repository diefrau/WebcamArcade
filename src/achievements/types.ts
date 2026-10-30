import type { GameId } from "../community/store";
export type AchievementGameId = GameId | "pose";
export type AchievementDefinition = {
  id: string;
  category: "general" | "game" | "secret";
  gameId?: AchievementGameId;
  metric: string;
  target: number;
  pending: boolean;
};
export type RoundEvidence = {
  win: boolean;
  choice?: "rock" | "paper" | "scissors";
  responseMs?: number;
  webcam?: boolean;
};
export type GameResultDetails = {
  inputMode?: "mouse" | "hand" | "face" | "body" | "buttons" | "unknown";
  duration?: number;
  hits?: number;
  shots?: number;
  misses?: number;
  maxCombo?: number;
  fastestSuccessMs?: number;
  recognitionFailures?: number;
  trackingLosses?: number;
  rounds?: RoundEvidence[];
  newBest?: boolean;
  metadata?: {
    passed?: boolean;
    drawComplete?: boolean;
    maxSafeSeconds?: number;
    maxAvoidStreak?: number;
    dodged?: number;
  };
};
export type GameResultEvent = GameResultDetails & {
  id: string;
  gameId: GameId;
  completed: boolean;
  score: number;
  accuracy: number;
  duration: number;
  date: string;
};
export type PlayerStats = {
  totalGamesCompleted: number;
  completedGameIds: GameId[];
  gamePlayCount: Partial<Record<GameId, number>>;
  bestScores: Partial<Record<GameId, number>>;
  totalShootHits: number;
  consecutiveSameGameCount: number;
  lastGame?: GameId;
  recordGameIds: GameId[];
  dailyCompletedGames: Record<string, number>;
  rpsWinStreak: number;
  chamWinStreak: number;
  circleHighStreak: number;
  facts: Record<string, number>;
};
export type AchievementState = {
  version: 1;
  unlockedIds: string[];
  unlockedAt: Record<string, number>;
  progress: Record<string, number>;
  stats: PlayerStats;
  processedIds: string[];
};
