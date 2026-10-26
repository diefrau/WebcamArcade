import type { GameId } from "../community/store";
import { type HandSample } from "../vision/gestures";
import { type FaceSample, faceDirection } from "../vision/face";
import { type BodySample, bodyTarget } from "../vision/body";
import { DrawingCursor } from "../vision/DrawingCursor";
import { classifyRps, rpsChoices, type RpsChoice } from "../games/rpsRules";
export type PracticePoint = { x: number; y: number; move?: boolean };
export type PracticeView = {
  done: number;
  total: number;
  complete: boolean;
  cursor: PracticePoint;
  path: PracticePoint[];
  pose: RpsChoice | null;
  hold: number;
  message: "try" | "tracking" | "calibrate" | "complete";
  steps: string[];
};
export class PracticeSession {
  private steps = new Set<string>();
  private cursor = { x: 0.5, y: 0.5 };
  private path: PracticePoint[] = [];
  private armed = false;
  private drawing = false;
  private consumed = -1;
  private distance = 0;
  private lastTime = -Infinity;
  private candidate: { pose: RpsChoice; since: number } | null = null;
  private hold = 0;
  private pose: RpsChoice | null = null;
  private center: { x: number; width: number } | null = null;
  private filter = new DrawingCursor();
  private message: PracticeView["message"] = "try";
  constructor(readonly game: GameId) {}
  view(): PracticeView {
    const total = this.game === "shoot" ? 2 : 3;
    const done = Math.min(total, this.steps.size);
    return {
      done,
      total,
      complete: done === total,
      cursor: this.cursor,
      path: [...this.path],
      pose: this.pose,
      hold: this.hold,
      message: done === total ? "complete" : this.message,
      steps: [...this.steps],
    };
  }
  lose() {
    this.armed = false;
    this.drawing = false;
    this.filter.reset();
    this.candidate = null;
    this.hold = 0;
    this.pose = null;
    this.center = null;
    this.message = "tracking";
  }
  private sample(time: number) {
    if (!Number.isFinite(time) || time <= this.lastTime) return false;
    if (time - this.lastTime > 500) this.lose();
    this.lastTime = time;
    this.message = "try";
    return true;
  }
  private aim(point: PracticePoint) {
    this.cursor = point;
    const hit = Math.hypot(point.x - 0.72, (point.y - 0.44) * 0.55) < 0.14;
    if (hit) this.steps.add("aim");
    return hit;
  }
  private draw(point: PracticePoint, pressed: boolean) {
    this.cursor = point;
    if (!pressed) {
      if (this.drawing && this.distance > 0.35 && this.steps.has("draw"))
        this.steps.add("release");
      this.drawing = false;
      this.armed = true;
      this.steps.add("open");
      return;
    }
    if (!this.armed) return;
    if (this.drawing) {
      const previous = this.path[this.path.length - 1];
      this.distance += Math.hypot(point.x - previous.x, point.y - previous.y);
    }
    this.path.push({ ...point, move: !this.drawing });
    this.path = this.path.slice(-400);
    this.drawing = true;
    if (this.distance > 0.35 && this.path.length >= 8) this.steps.add("draw");
  }
  hand(hand: HandSample, sequence: number, time: number, aspect = 4 / 3) {
    if (!this.sample(time)) return this.view();
    const newShot = sequence !== this.consumed;
    this.consumed = sequence;
    if (!hand.detected) {
      this.lose();
      return this.view();
    }
    if (this.game === "shoot") {
      if (!hand.pinched) this.armed = true;
      if (this.aim(hand) && hand.pinched && newShot && this.armed) {
        this.steps.add("fire");
        this.armed = false;
      }
    } else if (this.game === "circle") {
      const tip = hand.landmarks[8];
      if (!tip || ![tip.x, tip.y].every(Number.isFinite)) {
        this.lose();
        return this.view();
      }
      const clamp = (v: number) => Math.max(0, Math.min(1, v));
      const point = this.filter.update(
        clamp((1 - tip.x - 0.12) / 0.76),
        clamp((tip.y - 0.12) / 0.76),
        time,
      );
      this.draw(point, hand.pinched);
    } else if (this.game === "rps") {
      const pose = classifyRps(hand.landmarks, aspect);
      this.pose = pose;
      const target = rpsChoices[Math.min(2, this.steps.size)];
      if (!pose || pose !== target) {
        this.candidate = null;
        this.hold = 0;
      } else if (this.candidate?.pose !== pose) {
        this.candidate = { pose, since: time };
        this.hold = 0;
      } else {
        this.hold = Math.min(1, (time - this.candidate.since) / 250);
        if (this.hold >= 1) this.steps.add(pose);
      }
    }
    return this.view();
  }
  face(
    face: FaceSample,
    neutral: { x: number; y: number } | null,
    time: number,
  ) {
    if (!this.sample(time)) return this.view();
    if (!face.detected) {
      this.lose();
      return this.view();
    }
    if (!neutral) {
      this.message = "calibrate";
      return this.view();
    }
    const direction = faceDirection(face, neutral);
    this.direction(direction);
    return this.view();
  }
  body(body: BodySample, time: number) {
    if (!this.sample(time)) return this.view();
    if (!body.detected) {
      this.lose();
      return this.view();
    }
    this.center ??= { x: body.x, width: body.width };
    const x = bodyTarget(body, this.center.x, this.center.width);
    this.direction(x < 0.32 ? "left" : x > 0.68 ? "right" : "center");
    this.cursor = { x, y: 0.72 };
    return this.view();
  }
  direction(value: string) {
    this.message = "try";
    if (value === "left" || value === "right") this.steps.add(value);
    if (value === "center" && this.steps.has("left") && this.steps.has("right"))
      this.steps.add("center");
    this.cursor = {
      x: value === "left" ? 0.2 : value === "right" ? 0.8 : 0.5,
      y: 0.72,
    };
    return this.view();
  }
  pointer(point: PracticePoint, pressed: boolean, click = false) {
    this.message = "try";
    if (this.game === "shoot") {
      if (this.aim(point) && click) this.steps.add("fire");
    }
    if (this.game === "circle") {
      if (pressed) this.armed = true;
      this.draw(point, pressed);
    }
    return this.view();
  }
  shape(pose: RpsChoice) {
    this.pose = pose;
    this.hold = 1;
    this.steps.add(pose);
    this.message = "try";
    return this.view();
  }
}
