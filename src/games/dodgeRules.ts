export type Obstacle = { id: number; x: number; y: number };
export type DodgeState = {
  elapsed: number;
  x: number;
  lives: number;
  dodged: number;
  hits: number;
  immune: number;
  spawnIn: number;
  nextId: number;
  obstacles: Obstacle[];
  safeSeconds: number;
  maxSafeSeconds: number;
  avoidStreak: number;
  maxAvoidStreak: number;
};
export const DODGE_DURATION = 30;
export function newDodge(): DodgeState {
  return {
    elapsed: 0,
    x: 0.5,
    lives: 3,
    dodged: 0,
    hits: 0,
    immune: 0,
    spawnIn: 0.7,
    nextId: 0,
    obstacles: [],
    safeSeconds: 0,
    maxSafeSeconds: 0,
    avoidStreak: 0,
    maxAvoidStreak: 0,
  };
}
export const dodgeScore = (s: DodgeState) =>
  Math.floor(s.elapsed * 10 + 0.0001) + s.dodged * 50;
export const dodgeFinished = (s: DodgeState) =>
  s.elapsed >= DODGE_DURATION || s.lives <= 0;
/** Fixed substeps keep collisions and difficulty independent of display frame rate. */
export function advanceDodge(
  state: DodgeState,
  seconds: number,
  target: number,
  random: () => number = Math.random,
): DodgeState {
  let s = { ...state, obstacles: state.obstacles.map((o) => ({ ...o })) };
  let left = Math.max(0, Math.min(0.25, seconds));
  while (left > 0.00001 && !dodgeFinished(s)) {
    const dt = Math.min(left, 0.02, DODGE_DURATION - s.elapsed);
    left -= dt;
    s.elapsed = Math.min(DODGE_DURATION, s.elapsed + dt);
    s.safeSeconds += dt;
    s.x +=
      (Math.max(0.1, Math.min(0.9, target)) - s.x) * (1 - Math.exp(-dt / 0.09));
    s.immune = Math.max(0, s.immune - dt);
    const difficulty = s.elapsed / DODGE_DURATION;
    s.spawnIn -= dt;
    if (s.spawnIn <= 0) {
      s.obstacles.push({
        id: s.nextId++,
        x: 0.1 + Math.max(0, Math.min(1, random())) * 0.8,
        y: -0.08,
      });
      s.spawnIn += 1 - difficulty * 0.5;
    }
    for (const o of s.obstacles) {
      o.y += dt * (0.26 + difficulty * 0.28);
      if (
        o.y >= 0.78 &&
        o.y <= 0.96 &&
        Math.abs(o.x - s.x) < 0.085 &&
        s.immune === 0
      ) {
        s.lives--;
        s.hits++;
        s.safeSeconds = 0;
        s.avoidStreak = 0;
        s.immune = 1;
        o.y = 2;
      } else if (o.y > 1.08 && o.y < 2) {
        s.dodged++;
        s.avoidStreak++;
        s.maxAvoidStreak = Math.max(s.maxAvoidStreak, s.avoidStreak);
        o.y = 2;
      }
    }
    s.obstacles = s.obstacles.filter((o) => o.y < 2);
    s.maxSafeSeconds = Math.max(s.maxSafeSeconds, s.safeSeconds);
  }
  return s;
}
