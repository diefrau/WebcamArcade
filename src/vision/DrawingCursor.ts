/** Time-based low-pass filter: suppress finger jitter without frame-rate-dependent lag. */
export class DrawingCursor {
  private point: { x: number; y: number } | null = null;
  private time = 0;
  reset() {
    this.point = null;
  }
  update(x: number, y: number, time: number) {
    const dt = Math.max(0, time - this.time);
    const alpha = 1 - Math.exp(-dt / 65);
    this.point =
      this.point && dt < 250
        ? {
            x: this.point.x + alpha * (x - this.point.x),
            y: this.point.y + alpha * (y - this.point.y),
          }
        : { x, y };
    this.time = time;
    return this.point;
  }
}
