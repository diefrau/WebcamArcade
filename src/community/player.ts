export type PlayerChoice = { nickname: string; anonymousName: string };
const key = "arcade.player.choice";
let fallback: PlayerChoice | null = null;
export function readPlayer(): PlayerChoice | null {
  if (fallback) return fallback;
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value &&
      typeof value.nickname === "string" &&
      typeof value.anonymousName === "string"
      ? value
      : null;
  } catch {
    return fallback;
  }
}
export function savePlayer(player: PlayerChoice) {
  fallback = player;
  try {
    localStorage.setItem(key, JSON.stringify(player));
    localStorage.setItem("arcade.community.nickname", player.nickname);
  } catch {
    /* This session can still play. */
  }
  window.dispatchEvent(new Event("arcade:player"));
}
export function selectPlayer(nickname: string) {
  const previous = readPlayer();
  const digits = crypto.getRandomValues(new Uint32Array(2));
  savePlayer({
    nickname: nickname.trim().slice(0, 16),
    anonymousName:
      previous?.anonymousName || `익명${digits[0]}${digits[1]}`.slice(0, 16),
  });
}
export function playerName(player: PlayerChoice) {
  return player.nickname || player.anonymousName;
}
