import type { SupabaseClient } from "@supabase/supabase-js";
import {
  readRuns,
  writeRuns,
  validRun,
  type Run,
  type GameId,
  type Progress,
} from "./store";
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
export async function joinCommunity(nickname: string) {
  const c = await api();
  const { data, error } = await c.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    const signed = await c.auth.signInAnonymously();
    if (signed.error) throw signed.error;
  }
  const result = await c.rpc("arcade_join", { p_nickname: nickname.trim() });
  if (result.error) throw result.error;
  try {
    localStorage.setItem("arcade.community.nickname", nickname.trim());
  } catch {
    /* Optional display preference. */
  }
}
let syncing: Promise<void> | null = null;
export function syncRuns(): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    if (!(await joined())) return;
    for (const run of readRuns().filter((r) => !r.synced)) {
      const { error } = await (
        await api()
      ).rpc("arcade_submit", {
        p_id: run.id,
        p_game: run.game,
        p_score: run.score,
        p_accuracy: run.accuracy,
        p_seconds: run.seconds,
      });
      if (error) throw error;
      // Re-read so a game completed during upload cannot be overwritten.
      writeRuns(
        readRuns().map((r) => (r.id === run.id ? { ...r, synced: true } : r)),
      );
    }
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}
export function recordPlay(
  game: GameId,
  score: number,
  accuracy = 0,
  seconds = 0,
) {
  const run: Run = {
    id: crypto.randomUUID(),
    game,
    score,
    accuracy,
    seconds: Math.min(30, Math.max(0, seconds)),
    date: new Date().toISOString(),
  };
  if (!validRun(run)) return;
  writeRuns([...readRuns(), run]);
  window.dispatchEvent(new Event("arcade:community"));
  // Online participation is opt-in. No anonymous identity is created here.
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
