import {
  sounds,
  aliases,
  sampleFiles,
  soundName,
  type SoundDefinition,
  type SoundCue,
  type PlayOptions,
} from "./sounds";
export type { SoundCue, PlayOptions } from "./sounds";
type LegacyCue =
  | "click"
  | "start"
  | "success"
  | "fail"
  | "combo"
  | "result"
  | "newBest"
  | "pause"
  | "resume";

type Note = {
  pitch: number;
  at: number;
  duration: number;
  volume?: number;
  wave?: OscillatorType;
  bend?: number;
};

// Short, upward pitch bends give the same springy feel as the comic animations.
const cues: Record<LegacyCue, readonly Note[]> = {
  click: [{ pitch: 740, at: 0, duration: 0.07, wave: "sine", bend: 0.75 }],
  start: [
    { pitch: 392, at: 0, duration: 0.13 },
    { pitch: 494, at: 0.1, duration: 0.13 },
    { pitch: 587, at: 0.2, duration: 0.13 },
    { pitch: 784, at: 0.3, duration: 0.23 },
  ],
  success: [
    { pitch: 659, at: 0, duration: 0.12 },
    { pitch: 880, at: 0.08, duration: 0.2 },
  ],
  fail: [
    { pitch: 294, at: 0, duration: 0.13, bend: 1.2, volume: 0.2 },
    { pitch: 196, at: 0.09, duration: 0.2, bend: 1.12, volume: 0.2 },
  ],
  combo: [
    { pitch: 740, at: 0, duration: 0.12 },
    { pitch: 988, at: 0.075, duration: 0.13 },
    { pitch: 1175, at: 0.15, duration: 0.22 },
  ],
  result: [
    { pitch: 523, at: 0, duration: 0.18 },
    { pitch: 659, at: 0.12, duration: 0.18 },
    { pitch: 784, at: 0.24, duration: 0.18 },
    { pitch: 1047, at: 0.4, duration: 0.32 },
  ],
  newBest: [
    { pitch: 440, at: 0, duration: 0.16 },
    { pitch: 659, at: 0.1, duration: 0.16 },
    { pitch: 880, at: 0.2, duration: 0.2 },
    { pitch: 1109, at: 0.35, duration: 0.2 },
    { pitch: 1319, at: 0.5, duration: 0.35 },
  ],
  pause: [
    { pitch: 392, at: 0, duration: 0.13, wave: "sine" },
    { pitch: 294, at: 0.1, duration: 0.16, wave: "sine" },
  ],
  resume: [
    { pitch: 294, at: 0, duration: 0.13, wave: "sine" },
    { pitch: 392, at: 0.1, duration: 0.16, wave: "sine" },
  ],
};

type Voice = { source: OscillatorNode | AudioBufferSourceNode; gain: GainNode };

export type ArcadeAudioOptions = {
  enabled?: boolean;
  /** Allows deterministic tests and browsers with a prefixed AudioContext. */
  createContext?: () => AudioContext | null;
  loadSample?: (url: string) => Promise<ArrayBuffer>;
};

function createBrowserContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const browser = window as Window &
    typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    };
  const Constructor = browser.AudioContext ?? browser.webkitAudioContext;
  return Constructor ? new Constructor() : null;
}

export class ArcadeAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private decoder: OfflineAudioContext | null = null;
  private unlocked = false;
  private disposed = false;
  private enabled: boolean;
  private pendingUnlock: Promise<boolean> | null = null;
  private readonly createContext: () => AudioContext | null;
  private readonly voices = new Set<Voice>();
  private readonly lastPlayed = new Map<string, number>();
  private readonly bytes = new Map<string, Promise<ArrayBuffer | null>>();
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly decodes = new Map<string, Promise<void>>();
  private readonly abort = new AbortController();
  private readonly loadSample: (url: string) => Promise<ArrayBuffer>;
  private volume = 0.65;

  constructor(options: ArcadeAudioOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.createContext = options.createContext ?? createBrowserContext;
    this.loadSample =
      options.loadSample ??
      (async (url) => {
        const response = await fetch(url, { signal: this.abort.signal });
        if (!response.ok) throw new Error("Audio asset unavailable");
        return response.arrayBuffer();
      });
    void this.preload();
  }

  /** Offline decoding warms samples without opening an audible output device. */
  async preload(): Promise<void> {
    if (this.disposed) return;
    await Promise.all(
      Object.values(sampleFiles).map(async (url) => {
        if (!this.bytes.has(url))
          this.bytes.set(
            url,
            Promise.resolve()
              .then(() => this.loadSample(url))
              .catch(() => null),
          );
        const bytes = await this.bytes.get(url);
        if (this.disposed) return;
        if (
          !this.context &&
          !this.decoder &&
          typeof OfflineAudioContext !== "undefined"
        ) {
          try {
            this.decoder = new OfflineAudioContext(1, 1, 44100);
          } catch {}
        }
        const context = this.context ?? this.decoder;
        if (!bytes || !context || this.disposed || this.buffers.has(url))
          return;
        if (!this.decodes.has(url))
          this.decodes.set(
            url,
            context
              .decodeAudioData(bytes.slice(0))
              .then((buffer) => {
                if (!this.disposed) this.buffers.set(url, buffer);
              })
              .catch(() => {}),
          );
        await this.decodes.get(url);
      }),
    );
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(1, volume));
    this.updateVolume();
  }

  get isReady(): boolean {
    return !this.disposed && this.unlocked && this.context?.state === "running";
  }

  /** Call directly in a pointer/key gesture. No earlier cue is queued for later. */
  unlock(): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    if (this.pendingUnlock) return this.pendingUnlock;
    if (this.unlocked && this.context?.state === "running") {
      return Promise.resolve(true);
    }
    this.pendingUnlock = this.resumeContext().finally(() => {
      this.pendingUnlock = null;
    });
    return this.pendingUnlock;
  }

  private async resumeContext(): Promise<boolean> {
    try {
      if (!this.context) {
        this.context = this.createContext();
        if (!this.context) return false;
        this.master = this.context.createGain();
        this.master.gain.setValueAtTime(0, this.context.currentTime);
        if (typeof this.context.createDynamicsCompressor === "function") {
          this.limiter = this.context.createDynamicsCompressor();
          this.limiter.threshold.value = -12;
          this.limiter.knee.value = 12;
          this.limiter.ratio.value = 8;
          this.limiter.attack.value = 0.003;
          this.limiter.release.value = 0.1;
          this.master.connect(this.limiter);
          this.limiter.connect(this.context.destination);
        } else this.master.connect(this.context.destination);
      }
      // Invoke resume before the first await to retain the gesture activation.
      if (this.context.state !== "running") await this.context.resume();
      if (this.disposed || this.context.state !== "running") return false;
      this.unlocked = true;
      this.updateVolume();
      void this.preload();
      return true;
    } catch {
      return false;
    }
  }

  setEnabled(enabled: boolean): void {
    if (this.disposed || this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.stop();
    this.updateVolume();
  }

  private updateVolume(): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(
      this.enabled && this.unlocked ? this.volume : 0,
      now,
    );
  }

  /** Returns false when muted, locked, suspended, or burst-limited. */
  play(cue: SoundCue, options: PlayOptions = {}): boolean {
    const context = this.context;
    if (
      this.disposed ||
      !this.enabled ||
      !this.unlocked ||
      !context ||
      !this.master ||
      context.state !== "running"
    ) {
      return false;
    }
    const now = context.currentTime;
    const name = soundName(cue);
    const definition: SoundDefinition = sounds[name];
    const key = definition.group ?? name;
    const cooldown = definition.cooldown;
    const previous = this.lastPlayed.get(key);
    if (previous !== undefined && now - previous < cooldown) return false;
    this.lastPlayed.set(key, now);
    this.updateVolume();

    // Never queue an interaction behind a download. A cold/failed sample uses
    // the existing quiet synth immediately; late decoding cannot replay it.
    if (
      definition.layers.length &&
      definition.layers.every((layer) =>
        this.buffers.has(sampleFiles[layer.file]),
      )
    ) {
      for (const layer of definition.layers) {
        this.limitVoices();
        const source = context.createBufferSource();
        source.buffer = this.buffers.get(sampleFiles[layer.file])!;
        source.playbackRate.setValueAtTime(layer.rate ?? 1, now);
        const gain = context.createGain();
        const start = now + (layer.at ?? 0);
        const end = start + source.buffer.duration / (layer.rate ?? 1);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(layer.gain, start + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        this.attach(source, gain);
        source.start(start);
        source.stop(end + 0.01);
      }
      return true;
    }
    const step = Math.max(
      0,
      Math.min(4, Number.isFinite(options.step) ? options.step! : 0),
    );
    const legacy =
      cue in aliases
        ? (cue as LegacyCue)
        : name.includes("fail") || name.includes("miss")
          ? "fail"
          : name === "game.record"
            ? "newBest"
            : name === "game.result"
              ? "result"
              : name.includes("success") ||
                  name === "circle.complete" ||
                  name === "shoot.hit" ||
                  name === "camera.ready"
                ? "success"
                : name === "game.start"
                  ? "start"
                  : "click";
    const notes: readonly Note[] = definition.synth
      ? [
          {
            pitch:
              definition.synth === "countdown"
                ? 340 * (1 + step * 0.1)
                : definition.synth === "combo"
                  ? [523, 587, 659, 784, 880][Math.round(step)]
                  : definition.synth === "progress"
                    ? 620
                    : definition.synth === "score"
                      ? 660
                      : 1100,
            at: 0,
            duration:
              definition.synth === "tick"
                ? 0.035
                : definition.synth === "progress"
                  ? 0.18
                  : 0.09,
            volume: definition.synth === "tick" ? 0.035 : 0.1,
            wave: "sine",
            bend: definition.synth === "countdown" ? 1.3 : 0.85,
          },
        ]
      : cues[legacy];

    for (const note of notes) {
      // Bound rapid game feedback without allowing voices to accumulate forever.
      this.limitVoices();
      const source = context.createOscillator();
      const gain = context.createGain();
      const start = now + note.at;
      const end = start + note.duration;
      source.type = note.wave ?? "triangle";
      source.frequency.setValueAtTime(note.pitch * (note.bend ?? 0.9), start);
      source.frequency.exponentialRampToValueAtTime(note.pitch, start + 0.035);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        (note.volume ?? 0.3) * 0.34,
        start + 0.008,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      this.attach(source, gain);
      source.start(start);
      source.stop(end + 0.015);
    }
    return true;
  }

  private limitVoices() {
    if (this.voices.size >= 16) {
      const oldest = this.voices.values().next().value;
      if (oldest) this.release(oldest, true);
    }
  }
  private attach(source: Voice["source"], gain: GainNode) {
    source.connect(gain);
    gain.connect(this.master!);
    const voice = { source, gain };
    this.voices.add(voice);
    source.onended = () => this.release(voice, false);
  }

  /** Cancels live and future notes. Useful before page transitions or muting. */
  stop(): void {
    if (this.context && this.master) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(0, now);
    }
    for (const voice of this.voices) this.release(voice, true);
    this.lastPlayed.clear();
  }

  private release(voice: Voice, stop: boolean): void {
    if (!this.voices.delete(voice)) return;
    voice.source.onended = null;
    if (stop) {
      try {
        voice.source.stop();
      } catch {
        // An oscillator may have just ended between scheduling and cancellation.
      }
    }
    voice.source.disconnect();
    voice.gain.disconnect();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.buffers.clear();
    this.bytes.clear();
    this.decodes.clear();
    this.unlocked = false;
    this.stop();
    this.master?.disconnect();
    this.limiter?.disconnect();
    this.decoder = null;
    if (this.context) void this.context.close().catch(() => {});
  }
}
