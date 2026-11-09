export type Obstacle = {
  id: number;
  x: number;
  y: number;
  side?: "left" | "right";
};
export type DodgeState = {
  elapsed: number;
  x: number;
  y: number;
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
    y: 0.87,
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
  Math.min(2147483647, Math.floor(s.elapsed * 10 + 0.0001) + s.dodged * 50);
export const dodgeFinished = (s: DodgeState, duration = DODGE_DURATION) =>
  s.elapsed >= duration || s.lives <= 0;
/** Fixed substeps keep collisions and difficulty independent of display frame rate. */
export function advanceDodge(
  state: DodgeState,
  seconds: number,
  target: number,
  random: () => number = Math.random,
  duration = DODGE_DURATION,
  targetY?: number,
): DodgeState {
  let s = { ...state, obstacles: state.obstacles.map((o) => ({ ...o })) };
  const endless = duration === Infinity;
  const hard = duration === DODGE_DURATION;
  const speedRamp = endless ? 0.6 : hard ? 0.42 : 0.28;
  const spawnRamp = endless ? 0.7 : hard ? 0.43 : 0.5;
  let left = Math.max(0, Math.min(0.25, seconds));
  while (left > 0.00001 && !dodgeFinished(s, duration)) {
    const dt = Math.min(left, 0.02, duration - s.elapsed);
    left -= dt;
    s.elapsed = Math.min(duration, s.elapsed + dt);
    s.safeSeconds += dt;
    s.x +=
      (Math.max(0.1, Math.min(0.9, target)) - s.x) * (1 - Math.exp(-dt / 0.09));
    if (targetY !== undefined)
      s.y +=
        (Math.max(0.5, Math.min(0.9, targetY)) - s.y) *
        (1 - Math.exp(-dt / 0.09));
    s.immune = Math.max(0, s.immune - dt);
    const difficulty = endless
      ? s.elapsed / (s.elapsed + 30)
      : hard
        ? 0.65 + s.elapsed / 90
        : Math.min(1, s.elapsed / DODGE_DURATION);
    s.spawnIn -= dt;
    if (s.spawnIn <= 0) {
      const id = s.nextId++;
      const lane = Math.max(0, Math.min(1, random()));
      // Alternate a falling obstacle with a side obstacle, switching sides each time.
      if (targetY !== undefined && id % 2 === 1) {
        const side = id % 4 === 1 ? "left" : "right";
        s.obstacles.push({
          id,
          side,
          x: side === "left" ? -0.08 : 1.08,
          y: 0.5 + lane * 0.4,
        });
      } else {
        s.obstacles.push({ id, x: 0.1 + lane * 0.8, y: -0.08 });
      }
      s.spawnIn += 1 - difficulty * spawnRamp;
    }
    const step = dt * (0.26 + difficulty * speedRamp);
    s.obstacles = s.obstacles.filter((o) => {
      if (o.side === "left") o.x += step;
      else if (o.side === "right") o.x -= step;
      else o.y += step;
      if (
        o.y >= s.y - 0.09 &&
        o.y <= s.y + 0.09 &&
        Math.abs(o.x - s.x) < 0.085 &&
        s.immune === 0
      ) {
        s.lives--;
        s.hits++;
        s.safeSeconds = 0;
        s.avoidStreak = 0;
        s.immune = 1;
        return false;
      }
      const passed =
        o.side === "left"
          ? o.x > 1.08
          : o.side === "right"
            ? o.x < -0.08
            : o.y > 1.08;
      if (passed) {
        s.dodged++;
        s.avoidStreak++;
        s.maxAvoidStreak = Math.max(s.maxAvoidStreak, s.avoidStreak);
        return false;
      }
      return true;
    });
    s.maxSafeSeconds = Math.max(s.maxSafeSeconds, s.safeSeconds);
  }
  return s;
}
