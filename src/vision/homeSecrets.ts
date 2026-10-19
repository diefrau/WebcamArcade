import type { Landmark } from "./gestures";
import type { SecretId } from "../community/secrets";
export type HomeMotionFrame = {
  time: number;
  aspect: number;
  hands: Landmark[][];
  face: Landmark[];
  expressions: Record<string, number>;
};
export function handPose(points: Landmark[], aspect = 4 / 3) {
  if (
    points.length !== 21 ||
    points.some(
      (p) =>
        !p ||
        ![p.x, p.y].every(Number.isFinite) ||
        p.x < 0 ||
        p.x > 1 ||
        p.y < 0 ||
        p.y > 1,
    )
  )
    return null;
  const d = (a: Landmark, b: Landmark) =>
    Math.hypot((a.x - b.x) * aspect, a.y - b.y);
  const scale = d(points[5], points[17]);
  if (scale < 0.025 || scale > 0.7) return null;
  const fingers = [5, 9, 13, 17].map((i) => {
    const a = {
      x: (points[i].x - points[i + 1].x) * aspect,
      y: points[i].y - points[i + 1].y,
    };
    const b = {
      x: (points[i + 3].x - points[i + 1].x) * aspect,
      y: points[i + 3].y - points[i + 1].y,
    };
    const denominator = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (denominator < 0.00001) return { open: false, closed: false };
    const cosine = (a.x * b.x + a.y * b.y) / denominator;
    const ratio =
      d(points[i + 3], points[0]) /
      Math.max(0.001, d(points[i + 1], points[0]));
    return {
      open: cosine < -0.65 && ratio > 1.18,
      closed: cosine > -0.3 && ratio < 1.12,
    };
  });
  return {
    middle:
      fingers[1].open &&
      [0, 2, 3].every((i) => fingers[i].closed) &&
      d(points[4], points[17]) < scale * 1.35,
    peace:
      fingers[0].open &&
      fingers[1].open &&
      fingers[2].closed &&
      fingers[3].closed,
    open: fingers.every((f) => f.open) && d(points[4], points[5]) > scale * 0.5,
    wrist: points[0],
  };
}
/** Sustained fresh evidence only. Camera absence and long tracking gaps never unlock a secret. */
export class HomeSecretDetector {
  private last = -Infinity;
  private holds = new Map<SecretId, number>();
  private flicker: {
    start: number;
    lastSeen: number;
    previous: boolean;
    changes: number;
    lost: number;
    anchor: Landmark;
  } | null = null;
  reset() {
    this.last = -Infinity;
    this.holds.clear();
    this.flicker = null;
  }
  update(frame: HomeMotionFrame): SecretId[] {
    const time = frame.time;
    if (
      !Number.isFinite(time) ||
      !Number.isFinite(frame.aspect) ||
      frame.aspect <= 0
    ) {
      this.reset();
      return [];
    }
    if (time <= this.last) return [];
    const dt = time - this.last;
    if (dt > 450) {
      this.holds.clear();
      this.flicker = null;
    }
    this.last = time;
    const hands = frame.hands
      .map((p) => handPose(p, frame.aspect))
      .filter((p) => p !== null);
    const face =
      frame.face.length >= 264 &&
      [1, 33, 263].every(
        (i) =>
          frame.face[i] &&
          Number.isFinite(frame.face[i].x) &&
          Number.isFinite(frame.face[i].y),
      ) &&
      Math.hypot(
        frame.face[33].x - frame.face[263].x,
        frame.face[33].y - frame.face[263].y,
      ) > 0.02;
    const two =
      hands.length === 2 &&
      Math.hypot(
        hands[0].wrist.x - hands[1].wrist.x,
        hands[0].wrist.y - hands[1].wrist.y,
      ) > 0.12;
    const score = (key: string) =>
      Number.isFinite(frame.expressions[key]) ? frame.expressions[key] : 0;
    const wink =
      (score("eyeBlinkLeft") > 0.65 && score("eyeBlinkRight") < 0.25) ||
      (score("eyeBlinkRight") > 0.65 && score("eyeBlinkLeft") < 0.25);
    const conditions: [SecretId, boolean, number][] = [
      ["manners", hands.some((h) => h.middle), 1200],
      ["jazz", face && two && hands.every((h) => h.open), 2000],
      ["doublePeace", face && two && hands.every((h) => h.peace), 1500],
      ["winkPeace", face && wink && hands.some((h) => h.peace), 1000],
      [
        "surprise",
        face && two && hands.every((h) => h.open) && score("jawOpen") > 0.6,
        1000,
      ],
    ];
    const unlocked: SecretId[] = [];
    for (const [id, active, duration] of conditions) {
      if (!active) {
        this.holds.delete(id);
        continue;
      }
      if (!this.holds.has(id)) this.holds.set(id, time);
      if (time - this.holds.get(id)! >= duration) unlocked.push(id);
    }
    const hand = hands[0];
    const centered =
      !!hand &&
      hand.wrist.x > 0.08 &&
      hand.wrist.x < 0.92 &&
      hand.wrist.y > 0.08 &&
      hand.wrist.y < 0.92;
    if (
      !face ||
      (hand && !centered) ||
      (this.flicker && time - this.flicker.lastSeen > 700)
    )
      this.flicker = null;
    if (face && centered && !this.flicker)
      this.flicker = {
        start: time,
        lastSeen: time,
        previous: true,
        changes: 0,
        lost: 0,
        anchor: hand.wrist,
      };
    const f = this.flicker;
    if (face && f) {
      if (
        hand &&
        Math.hypot(hand.wrist.x - f.anchor.x, hand.wrist.y - f.anchor.y) > 0.15
      )
        this.flicker = null;
      else {
        const present = !!hand;
        if (!f.previous && dt < 450) f.lost += dt;
        if (present !== f.previous) {
          if (f.changes === 0) f.start = time;
          f.changes++;
        }
        if (present) f.lastSeen = time;
        f.previous = present;
        if (
          time - f.start >= 5000 &&
          f.changes >= 8 &&
          f.lost >= 600 &&
          f.lost < (time - f.start) * 0.6
        )
          unlocked.push("mystery");
      }
    }
    return unlocked;
  }
}
