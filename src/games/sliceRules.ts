import { lineCircle } from "../vision/shared/collision";
import { recentPoints, trajectory } from "../vision/shared/trajectory";
import type { TimedPoint } from "../vision/visionTypes";

export const SLICE_WIDTH = 960;
export const SLICE_HEIGHT = 540;
export const SLICE_SECONDS = 30;
export const SLICE_LIVES = 3;
export const SLICE_SAMPLE_GAP_MS = 180;

const fruitKinds = [
  "apple",
  "orange",
  "lime",
  "banana",
  "strawberry",
  "grapes",
] as const;
export type SliceItem = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kind: (typeof fruitKinds)[number] | "bomb";
};

export type SliceRound = {
  elapsed: number;
  score: number;
  lives: number;
  sliced: number;
  combo: number;
  maxCombo: number;
  lastCut: number;
  nextWave: number;
  wave: number;
  items: SliceItem[];
};

export function newSliceRound(): SliceRound {
  return {
    elapsed: 0,
    score: 0,
    lives: SLICE_LIVES,
    sliced: 0,
    combo: 0,
    maxCombo: 0,
    lastCut: -Infinity,
    nextWave: 0,
    wave: 0,
    items: [],
  };
}

const gravity = 760;
export function advanceSlice(
  round: SliceRound,
  dt: number,
  random = Math.random,
) {
  round.elapsed = Math.min(SLICE_SECONDS, round.elapsed + dt);
  if (round.elapsed - round.lastCut > 0.65) round.combo = 0;
  if (round.elapsed >= round.nextWave) {
    round.wave++;
    round.nextWave += round.elapsed > 16 ? 0.9 : 1.12;
    const center = 205 + random() * 550;
    const count = round.wave > 2 && round.wave % 2 === 0 ? 3 : 2;
    const hasBomb = round.wave > 2 && round.wave % 3 === 0;
    const bombSlot = hasBomb ? Math.floor(random() * count) : -1;
    for (let i = 0; i < count; i++) {
      const offset = i - (count - 1) / 2;
      round.items.push({
        x: center + offset * 89,
        y: SLICE_HEIGHT + 47,
        vx: offset * 29 + (random() - 0.5) * 85,
        vy: -(660 + random() * 185),
        radius: i === bombSlot ? 29 : 33 + random() * 5,
        kind:
          i === bombSlot
            ? "bomb"
            : fruitKinds[Math.floor(random() * fruitKinds.length)],
      });
    }
  }
  for (const item of round.items) {
    item.x += item.vx * dt;
    item.y += item.vy * dt + (gravity * dt * dt) / 2;
    item.vy += gravity * dt;
  }
  round.items = round.items.filter(
    (item) => item.vy < 0 || item.y - item.radius < SLICE_HEIGHT,
  );
}

export class SlashTracker {
  private points: TimedPoint[] = [];
  private hand?: string;
  private cutThrough = -Infinity;

  reset() {
    this.points = [];
    this.hand = undefined;
    this.cutThrough = -Infinity;
  }

  canBridge(point: TimedPoint, hand?: string) {
    const last = this.points.at(-1);
    if (!last || !hand || hand !== this.hand) return false;
    const gap = point.time - last.time;
    const dx = point.x - last.x;
    const dy = point.y - last.y;
    const distance = Math.hypot(dx, dy);
    if (gap <= 0 || gap > 100 || distance > Math.min(220, gap * 3.5))
      return false;
    const before = this.points.at(-2);
    if (!before || distance < 12) return true;
    return dx * (last.x - before.x) + dy * (last.y - before.y) >= 0;
  }

  add(point: TimedPoint, hand?: string): TimedPoint[] | null {
    const previous = this.points.at(-1);
    if (previous && point.time <= previous.time) return null;
    if (
      hand !== this.hand ||
      (previous && point.time - previous.time > SLICE_SAMPLE_GAP_MS)
    )
      this.reset();
    this.hand = hand;
    this.points = recentPoints(this.points, point.time, SLICE_SAMPLE_GAP_MS);
    const start = this.points.at(-1);
    if (start && trajectory([start, point]).velocity < 620) this.points = [];
    this.points.push(point);
    const { length, linearity } = trajectory(this.points);
    if (length < 26 || linearity < 0.72) return null;
    const path = this.points.filter((sample) => sample.time >= this.cutThrough);
    this.cutThrough = point.time;
    return path.length > 1 ? path : null;
  }
}

export function cutAlongPath(round: SliceRound, path: TimedPoint[]) {
  const cut: SliceItem[] = [];
  for (let i = 1; i < path.length && round.lives > 0; i++) {
    const start = path[i - 1];
    const end = path[i];
    const hits = round.items
      .filter((item) => lineCircle(start, end, item, item.radius))
      .sort(
        (a, b) =>
          (a.x - b.x) * (end.x - start.x) + (a.y - b.y) * (end.y - start.y),
      );
    for (const item of hits) {
      round.items.splice(round.items.indexOf(item), 1);
      cut.push(item);
      if (item.kind === "bomb") {
        round.lives--;
        round.combo = 0;
        if (!round.lives) break;
      } else {
        round.sliced++;
        round.lastCut = round.elapsed;
        round.combo++;
        round.maxCombo = Math.max(round.combo, round.maxCombo);
        round.score += 10 + Math.min(5, round.combo - 1) * 2;
      }
    }
  }
  return cut;
}
