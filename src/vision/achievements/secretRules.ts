import type { Landmark } from "../gestures";
/** Three observed close-hand cover/release cycles; missing tracking never counts. */
export class LensCoverRule {
  private covers: number[] = [];
  private covered = false;
  private coveredAt = 0;
  private candidate: boolean | null = null;
  private since = 0;
  reset() {
    this.covers = [];
    this.covered = false;
    this.coveredAt = 0;
    this.candidate = null;
    this.since = 0;
  }
  update(points: Landmark[] | undefined, face: boolean, time: number) {
    if (
      !face ||
      points?.length !== 21 ||
      points.some(
        (p) =>
          !p ||
          ![p.x, p.y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1),
      )
    ) {
      this.reset();
      return false;
    }
    const xs = points.map((p) => p.x),
      ys = points.map((p) => p.y),
      w = Math.max(...xs) - Math.min(...xs),
      h = Math.max(...ys) - Math.min(...ys);
    if (w < 0.08 || h < 0.12) {
      this.reset();
      return false;
    }
    const x = (Math.max(...xs) + Math.min(...xs)) / 2,
      y = (Math.max(...ys) + Math.min(...ys)) / 2;
    const near =
      w >= 0.42 &&
      h >= 0.45 &&
      w * h >= 0.25 &&
      x > 0.32 &&
      x < 0.68 &&
      y > 0.25 &&
      y < 0.75;
    const released = w * h <= 0.2 || x < 0.2 || x > 0.8 || y < 0.15 || y > 0.85;
    const state = near ? true : released ? false : null;
    if (state === null) {
      this.candidate = null;
      return false;
    }
    if (state !== this.candidate) {
      this.candidate = state;
      this.since = time;
      return false;
    }
    if (time - this.since < 100) return false;
    this.covers = this.covers.filter((t) => time - t <= 5000);
    if (state && !this.covered) {
      this.covered = true;
      this.coveredAt = time;
    } else if (!state && this.covered) {
      this.covered = false;
      this.covers.push(this.coveredAt);
      this.covers = this.covers.filter((t) => time - t <= 5000);
      if (this.covers.length >= 3) {
        this.reset();
        return true;
      }
    }
    return false;
  }
}
