export type Landmark = { x: number; y: number; z?: number };
export type HandSample = {
  detected: boolean;
  x: number;
  y: number;
  pinched: boolean;
  fire: boolean;
  landmarks: Landmark[];
};
export const emptyHand: HandSample = {
  detected: false,
  x: 0.5,
  y: 0.5,
  pinched: false,
  fire: false,
  landmarks: [],
};
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** Five-frame palm average; pinch measured against palm size, independent of camera distance. */
export class GestureInterpreter {
  private positions: { x: number; y: number }[] = [];
  private armed = false;
  private pinched = false;
  private lastShot = -Infinity;
  reset() {
    this.positions = [];
    this.armed = false;
    this.pinched = false;
  }
  update(
    points: Landmark[] | undefined,
    time: number,
    aspect = 4 / 3,
  ): HandSample {
    if (
      !points ||
      points.length < 21 ||
      points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
    ) {
      this.reset();
      return { ...emptyHand };
    }
    const palm = [0, 5, 9, 13, 17].map((i) => points[i]);
    // Map the central 76% of the image to the full field so edges are reachable.
    const x = clamp(
      (1 - palm.reduce((sum, p) => sum + p.x, 0) / palm.length - 0.12) / 0.76,
    );
    const y = clamp(
      (palm.reduce((sum, p) => sum + p.y, 0) / palm.length - 0.12) / 0.76,
    );
    this.positions.push({ x, y });
    if (this.positions.length > 5) this.positions.shift();
    const distance = (a: Landmark, b: Landmark) =>
      Math.hypot((a.x - b.x) * aspect, a.y - b.y);
    const ratio =
      distance(points[4], points[8]) /
      Math.max(0.015, distance(points[5], points[17]));
    let fire = false;
    if (ratio > 0.55) {
      this.armed = true;
      this.pinched = false;
    } else if (ratio < 0.32) {
      fire = this.armed && !this.pinched && time - this.lastShot > 350;
      if (fire) this.lastShot = time;
      this.pinched = true;
      this.armed = false;
    }
    return {
      detected: true,
      x: this.positions.reduce((s, p) => s + p.x, 0) / this.positions.length,
      y: this.positions.reduce((s, p) => s + p.y, 0) / this.positions.length,
      pinched: this.pinched,
      fire,
      landmarks: points,
    };
  }
}
