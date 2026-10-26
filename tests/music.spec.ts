import { test, expect } from "@playwright/test";
import { MusicChannel } from "../src/audio/MusicChannel";
import { musicForPath, musicTracks } from "../src/audio/music";
class Param {
  value = 0;
  events: { value: number; time: number }[] = [];
  cancelScheduledValues() {}
  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ value, time });
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ value, time });
  }
}
class Node {
  gain = new Param();
  disconnected = false;
  connect() {}
  disconnect() {
    this.disconnected = true;
  }
}
class Media {
  src = "";
  preload = "";
  loop = false;
  paused = true;
  currentTime = 0;
  plays = 0;
  loaded = 0;
  wait: Promise<void> | null = null;
  play() {
    this.plays++;
    this.paused = false;
    return this.wait ?? Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  removeAttribute() {
    this.src = "";
  }
  load() {
    this.loaded++;
  }
}
function setup() {
  const nodes: Node[] = [],
    gains: Node[] = [],
    media: Media[] = [];
  const context = {
    currentTime: 10,
    createGain: () => {
      const n = new Node();
      gains.push(n);
      return n;
    },
    createMediaElementSource: () => {
      const n = new Node();
      nodes.push(n);
      return n;
    },
  };
  const channel = new MusicChannel(
    context as unknown as AudioContext,
    {} as AudioNode,
    () => {
      const m = new Media();
      media.push(m);
      return m as unknown as HTMLAudioElement;
    },
  );
  return { channel, nodes, gains, media };
}
test("music roles follow games and result pages while menus share the title", () => {
  for (const path of ["/", "/games", "/ranking", "/achievements"])
    expect(musicForPath(path)).toBe("title");
  for (const prefix of ["/play/", "/result/"]) {
    expect(musicForPath(prefix + "shoot")).toBe("bounce");
    expect(musicForPath(prefix + "rps")).toBe("bounce");
    expect(musicForPath(prefix + "cham")).toBe("quick");
    expect(musicForPath(prefix + "dodge")).toBe("quick");
    expect(musicForPath(prefix + "circle")).toBe("leisure");
  }
});
test("music streams, preserves position on same tracks and pause, and crossfades without restarting", async () => {
  const { channel, media, gains, nodes } = setup();
  channel.play("title");
  await Promise.resolve();
  expect(media[0].src).toBe(musicTracks.title.url);
  expect(media[0].loop).toBe(true);
  media[0].currentTime = 17;
  channel.play("title");
  expect(media).toHaveLength(1);
  expect(media[0].plays).toBe(1);
  channel.pause();
  expect(media[0].paused).toBe(true);
  channel.play("title");
  channel.play("title"); // A second gesture while resume is pending must not cancel it.
  await Promise.resolve();
  expect(media[0].paused).toBe(false);
  expect(media[0].currentTime).toBe(17);
  expect(media[0].plays).toBe(2);
  channel.play("quick");
  await Promise.resolve();
  expect(gains[0].gain.events.at(-1)).toEqual({ value: 0, time: 10.7 });
  expect(gains[1].gain.events.at(-1)!.value).toBeCloseTo(0.65 * 0.7);
  channel.setVolume(0.2);
  expect(gains[1].gain.events.at(-1)!.value).toBeCloseTo(0.2 * 0.7);
  channel.dispose();
  expect(media.every((m) => m.paused && m.src === "")).toBe(true);
  expect(nodes.every((n) => n.disconnected)).toBe(true);
});
test("late loads cannot play after replacement, mute or disposal; rejected playback can retry", async () => {
  const { channel, media } = setup();
  // Start a delayed media element before play() observes it.
  let release!: () => void;
  const original = Media.prototype.play;
  Media.prototype.play = function () {
    this.wait = new Promise<void>((resolve) => (release = resolve));
    return original.call(this);
  };
  channel.play("title");
  const finish = release;
  channel.pause();
  finish();
  await Promise.resolve();
  expect(media[0].paused).toBe(true);
  expect(media[0].src).toBe("");
  Media.prototype.play = function () {
    return Promise.reject(Error("autoplay blocked"));
  };
  channel.play("bounce");
  await Promise.resolve();
  await Promise.resolve();
  expect(media[1].src).toBe("");
  Media.prototype.play = original;
  channel.play("bounce");
  await Promise.resolve();
  expect(media[2].paused).toBe(false);
  channel.dispose();
  channel.play("quick");
  expect(media).toHaveLength(3);
});
