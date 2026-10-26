export const sampleFiles = {
  click: new URL("../assets/audio/ui/click.wav", import.meta.url).href,
  back: new URL("../assets/audio/ui/back.wav", import.meta.url).href,
  toggleOn: new URL("../assets/audio/ui/toggle-on.wav", import.meta.url).href,
  toggleOff: new URL("../assets/audio/ui/toggle-off.wav", import.meta.url).href,
  navigation: new URL(
    "../assets/audio/navigation/transition.wav",
    import.meta.url,
  ).href,
  success: new URL("../assets/audio/game/success.wav", import.meta.url).href,
  fail: new URL("../assets/audio/game/fail.wav", import.meta.url).href,
  ready: new URL("../assets/audio/game/ready.wav", import.meta.url).href,
  start: new URL("../assets/audio/game/start.wav", import.meta.url).href,
  bell: new URL("../assets/audio/game/bell.wav", import.meta.url).href,
  result: new URL("../assets/audio/game/result.wav", import.meta.url).href,
  detect: new URL("../assets/audio/camera/detect.wav", import.meta.url).href,
  fire: new URL("../assets/audio/shoot/fire.wav", import.meta.url).href,
  hit: new URL("../assets/audio/shoot/hit.wav", import.meta.url).href,
  miss: new URL("../assets/audio/shoot/miss.wav", import.meta.url).href,
  draw: new URL("../assets/audio/circle/start.wav", import.meta.url).href,
  character: new URL("../assets/audio/character/pop.wav", import.meta.url).href,
  sticker: new URL("../assets/audio/game/sticker.wav", import.meta.url).href,
};
export type Layer = {
  file: keyof typeof sampleFiles;
  gain: number;
  at?: number;
  rate?: number;
};
export type SoundDefinition = {
  cooldown: number;
  group?: string;
  layers: readonly Layer[];
  synth?: "tick" | "countdown" | "combo" | "score" | "progress";
};
const sample = (
  file: Layer["file"],
  gain: number,
  cooldown = 0.08,
): SoundDefinition => ({ cooldown, layers: [{ file, gain }] });
export const sounds = {
  "ui.hover": { cooldown: 0.1, group: "hover", layers: [], synth: "tick" },
  "ui.tick": { cooldown: 0.08, layers: [], synth: "tick" },
  "ui.click": {
    cooldown: 0.055,
    layers: [
      { file: "click", gain: 0.35 },
      { file: "ready", gain: 0.16, rate: 1.3 },
    ],
  },
  "ui.back": sample("back", 0.3),
  "ui.toggleOn": {
    cooldown: 0.1,
    layers: [
      { file: "toggleOn", gain: 0.32 },
      { file: "bell", gain: 0.1, at: 0.04, rate: 1.4 },
    ],
  },
  "ui.toggleOff": sample("toggleOff", 0.3),
  "navigation.transition": {
    ...sample("navigation", 0.22, 0.14),
    group: "navigation",
  },
  "game.ready": sample("ready", 0.32, 0.2),
  "game.countdown": { cooldown: 0.12, layers: [], synth: "countdown" },
  "game.start": {
    cooldown: 0.12,
    layers: [
      { file: "start", gain: 0.36 },
      { file: "bell", gain: 0.22, at: 0.04, rate: 1.25 },
    ],
  },
  "game.score": { cooldown: 0.1, layers: [], synth: "score" },
  "game.combo": { cooldown: 0.12, layers: [], synth: "combo" },
  "game.success": sample("success", 0.42, 0.12),
  "game.fail": sample("fail", 0.34, 0.12),
  "game.record": {
    cooldown: 1,
    layers: [
      { file: "success", gain: 0.3 },
      { file: "bell", gain: 0.25, at: 0.24, rate: 1 },
      { file: "bell", gain: 0.22, at: 0.4, rate: 1.25 },
      { file: "bell", gain: 0.2, at: 0.58, rate: 1.5 },
    ],
  },
  "game.result": {
    cooldown: 0.5,
    layers: [
      { file: "result", gain: 0.25 },
      { file: "sticker", gain: 0.2, at: 0.04 },
    ],
  },
  "game.pause": sample("back", 0.25),
  "game.resume": sample("start", 0.28),
  "camera.ready": {
    cooldown: 1,
    group: "camera",
    layers: [
      { file: "bell", gain: 0.18, rate: 1.1 },
      { file: "bell", gain: 0.2, at: 0.12, rate: 1.4 },
    ],
  },
  "camera.handDetected": { ...sample("detect", 0.18, 1.5), group: "detection" },
  "camera.faceDetected": { ...sample("hit", 0.18, 1.5), group: "detection" },
  "camera.bodyDetected": { ...sample("detect", 0.18, 1.5), group: "detection" },
  "shoot.fire": {
    cooldown: 0.07,
    layers: [
      { file: "fire", gain: 0.32 },
      { file: "ready", gain: 0.25, rate: 1.5 },
    ],
  },
  "shoot.hit": {
    cooldown: 0.07,
    layers: [
      { file: "hit", gain: 0.3 },
      { file: "bell", gain: 0.12, at: 0.025, rate: 1.35 },
    ],
  },
  "shoot.miss": sample("miss", 0.24),
  "circle.start": sample("draw", 0.16, 0.25),
  "circle.progress": { cooldown: 2, layers: [], synth: "progress" },
  "circle.complete": {
    cooldown: 0.4,
    layers: [
      { file: "hit", gain: 0.22 },
      { file: "success", gain: 0.32, at: 0.04 },
    ],
  },
  "cham.move": sample("navigation", 0.16, 0.14),
  "cham.success": sample("success", 0.32, 0.12),
  "cham.fail": sample("fail", 0.3, 0.12),
  "sticker.appear": { ...sample("sticker", 0.22, 0.6), group: "sticker" },
  "character.aki": sample("character", 0.18, 1),
  "character.dog": sample("hit", 0.22, 1),
  "character.chick": {
    ...sample("detect", 0.18, 1),
    layers: [{ file: "detect", gain: 0.18, rate: 1.4 }],
  },
} satisfies Record<string, SoundDefinition>;
export type SoundName = keyof typeof sounds;
export const aliases = {
  click: "ui.click",
  start: "game.start",
  success: "game.success",
  fail: "game.fail",
  combo: "game.combo",
  result: "game.result",
  newBest: "game.record",
  pause: "game.pause",
  resume: "game.resume",
} as const satisfies Record<string, SoundName>;
export type SoundCue = SoundName | keyof typeof aliases;
export type PlayOptions = { /** Pitch steps, bounded to 0–4. */ step?: number };
export function soundName(cue: SoundCue): SoundName {
  return cue in aliases
    ? aliases[cue as keyof typeof aliases]
    : (cue as SoundName);
}
