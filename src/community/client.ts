import type { SupabaseClient } from "@supabase/supabase-js";
import { readPlayer, savePlayer } from "./player";
import {
  readSecrets,
  writeSecrets,
  storeSecret,
  type SecretId,
} from "./secrets";
import {
  readRuns,
  readProgress,
  achievementIds,
  writeRuns,
  validRun,
  type Run,
  type GameId,
  type Progress,
} from "./store";
import { announceAchievement } from "./achievementNotices";
import { secretDescriptions } from "./secrets";
import {
  readAchievementState,
  recordGameResult,
  syncSecretAchievement,
} from "../achievements/achievementManager";
import type { GameResultDetails, GameResultEvent } from "../achievements/types";
// Vite replaces only these public build variables. Never use server secret keys.
const env = (import.meta as unknown as { env: Record<string, string> }).env;
export const communityConfigured = !!(
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY
);
let client: SupabaseClient | null;
async function api() {
  if (!communityConfigured) throw new Error("Community not configured");
  if (!client) {
    const { createClient } = await import("@supabase/supabase-js");
    client ??= createClient(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
    );
  }
  return client;
}
export async function joined() {
  if (!communityConfigured) return false;
  const { data, error } = await (await api()).auth.getSession();
  if (error) throw error;
  if (!data.session) return false;
  const result = await (
    await api()
  )
    .from("arcade_profiles")
    .select("nickname")
    .eq("user_id", data.session.user.id)
    .maybeSingle();
  if (result.error) throw result.error;
  return !!result.data;
}
export type SyncState = "idle" | "syncing" | "synced" | "offline";
let syncState: SyncState = "idle";
export const getSyncState = () => syncState;
function setSyncState(value: SyncState) {
  syncState = value;
  window.dispatchEvent(new Event("arcade:sync"));
}
let appliedNickname: string | null = null;
export async function joinCommunity(nickname: string) {
  const c = await api();
  const { data, error } = await c.auth.getSession();
  if (error) throw error;
  let userId = data.session?.user.id;
  if (!data.session) {
    const signed = await c.auth.signInAnonymously();
    if (signed.error) throw signed.error;
    userId = signed.data.user?.id;
  }
  if (!userId) throw new Error("Missing player identity");
  const result = await c.rpc("arcade_join", { p_nickname: nickname.trim() });
  if (result.error) throw result.error;
  const profile = await c
    .from("arcade_profiles")
    .select("nickname,anonymous_name")
    .eq("user_id", userId)
    .single();
  if (profile.error) throw profile.error;
  const previous = readPlayer();
  appliedNickname = nickname.trim();
  savePlayer({
    nickname: profile.data.nickname,
    anonymousName:
      profile.data.anonymous_name || previous?.anonymousName || "익명",
  });
}
let syncing: Promise<void> | null = null;
let resumeRequested = false;
export function syncRuns(resumeAfterCurrent = false): Promise<void> {
  if (syncing) {
    resumeRequested ||= resumeAfterCurrent;
    return syncing;
  }
  syncing = (async () => {
    if (!communityConfigured) return;
    const player = readPlayer();
    if (player) setSyncState("syncing");
    if (player && appliedNickname !== player.nickname)
      await joinCommunity(player.nickname);
    else if (!(await joined())) return;
    setSyncState("syncing");
    // Drain again after every upload: a second completed game can arrive mid-sync.
    while (true) {
      const run = readRuns().find((r) => !r.synced);
      const secret = readSecrets().find((r) => !r.synced);
      if (!run && !secret) break;
      if (!run && secret) {
        const { error } = await (
          await api()
        ).rpc("arcade_unlock_secret", { p_secret: secret.id });
        if (error) throw error;
        writeSecrets(
          readSecrets().map((r) =>
            r.id === secret.id ? { ...r, synced: true } : r,
          ),
        );
        continue;
      }
      const { error } = await (
        await api()
      ).rpc("arcade_submit", {
        p_id: run!.id,
        p_game: run!.game,
        p_score: run!.score,
        p_accuracy: run!.accuracy,
        p_seconds: run!.seconds,
      });
      if (error) throw error;
      // Re-read so a game completed during upload cannot be overwritten.
      writeRuns(
        readRuns().map((r) => (r.id === run!.id ? { ...r, synced: true } : r)),
      );
    }
    setSyncState("synced");
    window.dispatchEvent(new Event("arcade:synced"));
  })()
    .catch((error) => {
      setSyncState("offline");
      throw error;
    })
    .finally(() => {
      syncing = null;
      if (resumeRequested) {
        resumeRequested = false;
        void syncRuns().catch(() => {});
      }
    });
  return syncing;
}
export function unlockSecret(id: SecretId) {
  if (!storeSecret(id)) return false;
  syncSecretAchievement(id, readSecrets().find((r) => r.id === id)!.date);
  announceAchievement({ id, title: secretDescriptions[id].name, secret: true });
  window.dispatchEvent(new Event("arcade:community"));
  if (communityConfigured) void syncRuns().catch(() => {});
  return true;
}
export function recordPlay(
  game: GameId,
  score: number,
  accuracy = 0,
  seconds = 0,
  details: GameResultDetails = {},
) {
  const run: Run = {
    id: crypto.randomUUID(),
    game,
    score,
    accuracy,
    seconds: Math.min(30, Math.max(0, seconds)),
    date: new Date().toISOString(),
    details,
  };
  if (!validRun(run)) return;
  readAchievementState();
  writeRuns([...readRuns(), run]);
  const event: GameResultEvent = {
    ...details,
    id: run.id,
    gameId: game,
    completed: true,
    score,
    accuracy,
    duration: details.duration ?? seconds,
    date: run.date,
  };
  recordGameResult(event);
  window.dispatchEvent(
    new CustomEvent("arcade:game-result", { detail: event }),
  );
  window.dispatchEvent(new Event("arcade:community"));
  // The first-visit name choice opts this device into automatic result sync.
  if (communityConfigured) void syncRuns().catch(() => {});
}
export type BoardRow = { place: number; nickname: string; score: number };
export async function loadBoard(game: GameId): Promise<BoardRow[]> {
  const { data, error } = await (
    await api()
  ).rpc("arcade_board", { p_game: game });
  if (error) throw error;
  return data ?? [];
}
export async function loadProgress(): Promise<Progress> {
  const { data, error } = await (await api()).rpc("arcade_progress");
  if (error) throw error;
  return data;
}
