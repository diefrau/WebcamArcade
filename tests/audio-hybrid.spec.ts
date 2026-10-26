import { test, expect } from "@playwright/test";
import { SoundManager } from "../src/audio/soundManager";
import { sampleFiles, sounds, type SoundName } from "../src/audio/sounds";

class Param {
  value = 0;
  events: { value: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) {
    this.events.push({ value, time });
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.events.push({ value, time });
  }
  cancelScheduledValues() {}
}
class Node {
  gain = new Param();
  frequency = new Param();
  playbackRate = new Param();
  buffer: AudioBuffer | null = null;
  type = "sine";
  onended: (() => void) | null = null;
  starts: number[] = [];
  stops: (number | undefined)[] = [];
  disconnected = false;
  connect() {}
  disconnect() {
    this.disconnected = true;
  }
  start(time: number) {
    this.starts.push(time);
  }
  stop(time?: number) {
    this.stops.push(time);
  }
}
class Context {
  state = "suspended";
  currentTime = 10;
  destination = {};
  samples: Node[] = [];
  oscillators: Node[] = [];
  gains: Node[] = [];
  decoded = 0;
  createGain() {
    const n = new Node();
    this.gains.push(n);
    return n;
  }
  createBufferSource() {
    const n = new Node();
    this.samples.push(n);
    return n;
  }
  createOscillator() {
    const n = new Node();
    this.oscillators.push(n);
    return n;
  }
  async decodeAudioData() {
    this.decoded++;
    return { duration: 0.2 } as AudioBuffer;
  }
  async resume() {
    this.state = "running";
  }
  async close() {
    this.state = "closed";
  }
}
function setup(
  loadSample: () => Promise<ArrayBuffer> = async () => new ArrayBuffer(8),
) {
  const context = new Context();
  let fetched = 0;
  const sound = new SoundManager({
    createContext: () => context as unknown as AudioContext,
    loadSample: () => {
      fetched++;
      return loadSample();
    },
  });
  return { context, sound, fetched: () => fetched };
}
test("samples and synth share play, cache, master volume, pitch steps and aliases", async () => {
  const { context, sound, fetched } = setup();
  expect(sound.play("ui.click")).toBe(false);
  await sound.unlock();
  await sound.preload();
  await sound.preload();
  expect(fetched()).toBe(Object.keys(sampleFiles).length);
  expect(context.decoded).toBe(Object.keys(sampleFiles).length);
  expect(context.samples).toHaveLength(0);
  expect(sound.play("ui.click")).toBe(true);
  expect(context.samples).toHaveLength(2);
  expect(context.oscillators).toHaveLength(0);
  expect(sound.play("click")).toBe(false);
  for (let step = 0; step < 5; step++) {
    context.currentTime++;
    expect(sound.play("game.combo", { step })).toBe(true);
  }
  const pitches = context.oscillators.map(
    (n) => n.frequency.events.at(-1)!.value,
  );
  expect(new Set(pitches).size).toBe(5);
  expect(pitches).toEqual([...pitches].sort((a, b) => a - b));
  sound.setVolume(2);
  expect(context.gains[0].gain.events.at(-1)!.value).toBe(1);
  sound.setVolume(-1);
  expect(context.gains[0].gain.events.at(-1)!.value).toBe(0);
  sound.dispose();
});
test("every canonical cue schedules short bounded sources and mute stops both backends", async () => {
  const { context, sound } = setup();
  await sound.unlock();
  await sound.preload();
  for (const name of Object.keys(sounds) as SoundName[]) {
    context.currentTime += 2;
    expect(sound.play(name)).toBe(true);
  }
  const sources = [...context.samples, ...context.oscillators];
  expect(context.samples.length).toBeGreaterThan(20);
  expect(context.oscillators.length).toBeGreaterThan(4);
  for (const n of sources) {
    expect(n.starts[0]).toBeLessThan(n.stops[0]!);
    expect(n.stops[0]! - n.starts[0]).toBeLessThan(1.3);
  }
  sound.setEnabled(false);
  expect(sources.every((n) => n.disconnected)).toBe(true);
  expect(sound.play("shoot.fire")).toBe(false);
  sound.setEnabled(true);
  expect(context.samples.length + context.oscillators.length).toBe(
    sources.length,
  );
  sound.dispose();
});
test("slow or failed downloads never replay an old event, even across mute or disposal", async () => {
  let release!: (bytes: ArrayBuffer) => void;
  const waiting = new Promise<ArrayBuffer>((resolve) => (release = resolve));
  const { context, sound } = setup(() => waiting);
  await sound.unlock();
  expect(sound.play("shoot.fire")).toBe(true);
  expect(context.oscillators.length).toBeGreaterThan(0);
  expect(context.samples).toHaveLength(0);
  sound.setEnabled(false);
  release(new ArrayBuffer(8));
  await sound.preload();
  expect(context.samples).toHaveLength(0);
  sound.setEnabled(true);
  context.currentTime++;
  expect(sound.play("shoot.fire")).toBe(true);
  expect(context.samples).toHaveLength(2);
  sound.dispose();
  const failed = setup(async () => {
    throw Error("offline");
  });
  await failed.sound.unlock();
  await failed.sound.preload();
  expect(failed.sound.play("game.success")).toBe(true);
  expect(failed.context.samples).toHaveLength(0);
  failed.sound.dispose();
  const late = setup(() => waiting);
  late.sound.dispose();
  await late.sound.preload();
  expect(late.context.decoded).toBe(0);
});
