import { handPose } from "./handRules";
import { faceVisible, oneEyeWink, faceExpression } from "./faceRules";
import { LensCoverRule } from "./secretRules";
import { AchievementTimers } from "./achievementTimers";
import type { HomeMotionFrame } from "./types";
import type { SecretId } from "../../community/secrets";
export class SecretAchievementDetector {
  private last = -Infinity;
  private holds = new AchievementTimers();
  private cover = new LensCoverRule();
  private awarded = new Set<SecretId>();
  reset() {
    this.last = -Infinity;
    this.holds.clear();
    this.cover.reset();
  }
  update(
    frame: HomeMotionFrame,
    alreadyUnlocked: ReadonlySet<SecretId> = new Set(),
  ): SecretId[] {
    const skip = (id: SecretId) =>
      alreadyUnlocked.has(id) || this.awarded.has(id);
    if (
      [
        "manners",
        "mystery",
        "jazz",
        "doublePeace",
        "winkPeace",
        "surprise",
      ].every((id) => skip(id as SecretId))
    )
      return [];
    if (
      !Number.isFinite(frame.time) ||
      !Number.isFinite(frame.aspect) ||
      frame.aspect <= 0
    ) {
      this.reset();
      return [];
    }
    if (frame.time <= this.last) return [];
    if (frame.time - this.last > 450) {
      this.holds.clear();
      this.cover.reset();
    }
    this.last = frame.time;
    const hands = frame.hands
      .map((h) => handPose(h, frame.aspect))
      .filter((h) => h !== null);
    const face = faceVisible(frame);
    const two =
      hands.length === 2 &&
      Math.hypot(
        hands[0].wrist.x - hands[1].wrist.x,
        hands[0].wrist.y - hands[1].wrist.y,
      ) > 0.12;
    const conditions: [SecretId, boolean, number][] = [
      ["manners", hands.some((h) => h.middle), 1200],
      ["jazz", face && two && hands.every((h) => h.open), 2000],
      ["doublePeace", face && two && hands.every((h) => h.peace), 1500],
      [
        "winkPeace",
        face && oneEyeWink(frame) && hands.some((h) => h.peace),
        1000,
      ],
      [
        "surprise",
        face &&
          two &&
          hands.every((h) => h.open) &&
          faceExpression(frame, "jawOpen") > 0.6,
        1000,
      ],
    ];
    const unlocked: SecretId[] = [];
    for (const [id, condition, duration] of conditions)
      if (!skip(id) && this.holds.hold(id, condition, frame.time, duration))
        unlocked.push(id);
    if (
      !skip("mystery") &&
      this.cover.update(
        frame.hands.length === 1 ? frame.hands[0] : undefined,
        face,
        frame.time,
      )
    )
      unlocked.push("mystery");
    for (const id of unlocked) this.awarded.add(id);
    return unlocked;
  }
}
