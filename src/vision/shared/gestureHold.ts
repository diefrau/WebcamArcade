export class GestureHold<T> {
  private value: T | undefined;
  private since = 0;
  reset() {
    this.value = undefined;
    this.since = 0;
  }
  update(value: T | undefined, time: number, holdMs = 120) {
    if (value === undefined || !Number.isFinite(time)) {
      this.reset();
      return false;
    }
    if (value !== this.value || time < this.since) {
      this.value = value;
      this.since = time;
      return false;
    }
    return time - this.since >= holdMs;
  }
}
