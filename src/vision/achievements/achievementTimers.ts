export class AchievementTimers {
  private starts = new Map<string, number>();
  clear() {
    this.starts.clear();
  }
  hold(id: string, condition: boolean, time: number, duration: number) {
    if (!condition) {
      this.starts.delete(id);
      return false;
    }
    if (!this.starts.has(id)) this.starts.set(id, time);
    return time - this.starts.get(id)! >= duration;
  }
}
