import { expect, test } from "@playwright/test";
import { ArcadeAudio, type SoundCue } from "../src/audio/ArcadeAudio";

class Param {
  events: { kind: string; value?: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) {
    this.events.push({ kind: "set", value, time });
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.events.push({ kind: "ramp", value, time });
  }
  cancelScheduledValues(time: number) {
    this.events.push({ kind: "cancel", time });
  }
}

class MockGain {
  gain = new Param();
  disconnected = false;
  connect() {}
  disconnect() {
    this.disconnected = true;
  }
}

class MockOscillator {
  frequency = new Param();
  type = "sine";
  onended: (() => void) | null = null;
  starts: number[] = [];
  stops: (number | undefined)[] = [];
  disconnected = false;
  connect() {}
  start(time: number) {
    this.starts.push(time);
  }
  stop(time?: number) {
    this.stops.push(time);
  }
  disconnect() {
    this.disconnected = true;
  }
}

class MockContext {
  currentTime = 10;
  state = "suspended";
  destination = {};
  gains: MockGain[] = [];
  sources: MockOscillator[] = [];
  resumes = 0;
  closed = 0;
  rejectResume = false;
  createGain() {
    const gain = new MockGain();
    this.gains.push(gain);
    return gain;
  }
  createOscillator() {
    const source = new MockOscillator();
    this.sources.push(source);
    return source;
  }
  async resume() {
    this.resumes++;
    if (this.rejectResume) throw new Error("No user activation");
    this.state = "running";
  }
  async close() {
    this.closed++;
    this.state = "closed";
  }
}

function createEngine(context = new MockContext(), enabled = true) {
  let created = 0;
  const engine = new ArcadeAudio({
    enabled,
    createContext: () => {
      created++;
      return context as unknown as AudioContext;
    },
  });
  return { engine, context, created: () => created };
}

test("sound stays locked until gesture unlock and never queues earlier cues", async () => {
  const { engine, context, created } = createEngine();
  expect(engine.play("start")).toBe(false);
  expect(created()).toBe(0);
  expect(context.sources).toHaveLength(0);
  expect(await engine.unlock()).toBe(true);
  expect(created()).toBe(1);
  expect(context.resumes).toBe(1);
  expect(context.sources).toHaveLength(0);
  expect(await engine.unlock()).toBe(true);
  expect(context.resumes).toBe(1);
  expect(engine.play("start")).toBe(true);
  expect(context.sources.length).toBeGreaterThan(0);
  engine.dispose();
});

test("all feedback cues have safe timed envelopes and rapid duplicates are bounded", async () => {
  const { engine, context } = createEngine();
  await engine.unlock();
  const cues: SoundCue[] = [
    "click",
    "start",
    "success",
    "fail",
    "combo",
    "result",
    "newBest",
    "pause",
    "resume",
  ];
  for (const cue of cues) {
    context.currentTime += 1;
    const before = context.sources.length;
    expect(engine.play(cue)).toBe(true);
    expect(context.sources.length).toBeGreaterThan(before);
    expect(engine.play(cue)).toBe(false);
  }
  for (const source of context.sources) {
    expect(source.starts).toHaveLength(1);
    expect(source.stops[0]).toBeGreaterThan(source.starts[0]);
    expect(
      source.frequency.events.every((event) => (event.value ?? 0) > 0),
    ).toBe(true);
  }
  for (const gain of context.gains.slice(1)) {
    expect(gain.gain.events[0].value).toBeLessThan(0.001);
    expect(gain.gain.events.at(-1)?.value).toBeLessThan(0.001);
    expect(gain.gain.events.every((event) => (event.value ?? 0) <= 0.3)).toBe(
      true,
    );
  }
  engine.dispose();
});

test("mute instantly stops future notes, reenable has no stale replay, disposal closes", async () => {
  const { engine, context } = createEngine();
  await engine.unlock();
  engine.play("newBest");
  const previous = context.sources.slice();
  expect(
    previous.some((source) => source.starts[0] > context.currentTime),
  ).toBe(true);
  engine.setEnabled(false);
  expect(context.gains[0].gain.events.at(-1)?.value).toBe(0);
  expect(previous.every((source) => source.stops.at(-1) === undefined)).toBe(
    true,
  );
  expect(previous.every((source) => source.disconnected)).toBe(true);
  expect(engine.play("success")).toBe(false);
  engine.setEnabled(true);
  expect(context.sources).toHaveLength(previous.length);
  expect(engine.play("success")).toBe(true);
  engine.dispose();
  engine.dispose();
  expect(context.closed).toBe(1);
  expect(context.gains[0].disconnected).toBe(true);
  expect(engine.play("start")).toBe(false);
  expect(await engine.unlock()).toBe(false);
});

test("failed activation can retry and unavailable audio remains a quiet fallback", async () => {
  const { engine, context } = createEngine();
  context.rejectResume = true;
  expect(await engine.unlock()).toBe(false);
  expect(engine.play("start")).toBe(false);
  context.rejectResume = false;
  expect(await engine.unlock()).toBe(true);
  context.state = "suspended";
  expect(engine.play("click")).toBe(false);
  expect(await engine.unlock()).toBe(true);
  engine.dispose();
  const unavailable = new ArcadeAudio({ createContext: () => null });
  expect(await unavailable.unlock()).toBe(false);
  expect(unavailable.play("result")).toBe(false);
  unavailable.dispose();
});
