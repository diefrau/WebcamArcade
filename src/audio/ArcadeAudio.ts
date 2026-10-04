export type SoundCue =
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
const cues: Record<SoundCue, readonly Note[]> = {
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

type Voice = { source: OscillatorNode; gain: GainNode };

export type ArcadeAudioOptions = {
  enabled?: boolean;
  /** Allows deterministic tests and browsers with a prefixed AudioContext. */
  createContext?: () => AudioContext | null;
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
  private unlocked = false;
  private disposed = false;
  private enabled: boolean;
  private pendingUnlock: Promise<boolean> | null = null;
  private readonly createContext: () => AudioContext | null;
  private readonly voices = new Set<Voice>();
  private readonly lastPlayed = new Map<SoundCue, number>();

  constructor(options: ArcadeAudioOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.createContext = options.createContext ?? createBrowserContext;
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
        this.master.connect(this.context.destination);
      }
      // Invoke resume before the first await to retain the gesture activation.
      if (this.context.state !== "running") await this.context.resume();
      if (this.disposed || this.context.state !== "running") return false;
      this.unlocked = true;
      this.updateVolume();
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
      this.enabled && this.unlocked ? 0.22 : 0,
      now,
    );
  }

  /** Returns false when muted, locked, suspended, or burst-limited. */
  play(cue: SoundCue): boolean {
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
    const cooldown = cue === "click" ? 0.035 : cue === "fail" ? 0.09 : 0.045;
    const previous = this.lastPlayed.get(cue);
    if (previous !== undefined && now - previous < cooldown) return false;
    this.lastPlayed.set(cue, now);
    this.updateVolume();

    for (const note of cues[cue]) {
      // Bound rapid game feedback without allowing voices to accumulate forever.
      if (this.voices.size >= 32) {
        const oldest = this.voices.values().next().value;
        if (oldest) this.release(oldest, true);
      }
      const source = context.createOscillator();
      const gain = context.createGain();
      const start = now + note.at;
      const end = start + note.duration;
      source.type = note.wave ?? "triangle";
      source.frequency.setValueAtTime(note.pitch * (note.bend ?? 0.9), start);
      source.frequency.exponentialRampToValueAtTime(note.pitch, start + 0.035);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(note.volume ?? 0.3, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      source.connect(gain);
      gain.connect(this.master);
      const voice = { source, gain };
      this.voices.add(voice);
      source.onended = () => this.release(voice, false);
      source.start(start);
      source.stop(end + 0.015);
    }
    return true;
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
    this.unlocked = false;
    this.stop();
    this.master?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
  }
}
