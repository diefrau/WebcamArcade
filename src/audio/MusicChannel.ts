import { musicTracks, type MusicTrack } from "./music";
type Slot = {
  id: MusicTrack;
  media: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
};
/** Stream long music through the existing context; keep at most two audible tracks. */
export class MusicChannel {
  private active: Slot | null = null;
  private pending: Slot | null = null;
  private retiring: Slot | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private generation = 0;
  private volume = 0.65;
  private mix = 1;
  private prepared: Slot | null = null;
  constructor(
    private context: AudioContext,
    private destination: AudioNode,
    private createMedia = () => new Audio(),
  ) {}
  setVolume(value: number) {
    if (this.volume === value) return;
    this.volume = value;
    if (this.active)
      this.level(
        this.active,
        value * musicTracks[this.active.id].gain * this.mix,
        0.12,
      );
  }
  setMix(value: number, seconds = 0.8) {
    if (this.mix === value) return;
    this.mix = value;
    if (this.active)
      this.level(
        this.active,
        this.volume * musicTracks[this.active.id].gain * this.mix,
        seconds,
      );
  }
  /** Prime one muted media element during START's gesture; audible gain stays zero. */
  prepare(id: MusicTrack) {
    if (this.disposed || this.active?.id === id || this.prepared?.id === id)
      return;
    if (this.prepared) this.release(this.prepared);
    const slot = this.createSlot(id);
    if (!slot) return;
    this.prepared = slot;
    slot.media.muted = true;
    void slot.media
      .play()
      .then(() => {
        if (this.prepared === slot) {
          slot.media.pause();
          slot.media.currentTime = 0;
        } else if (this.active !== slot && this.pending !== slot)
          slot.media.pause();
      })
      .catch(() => {});
  }
  private createSlot(id: MusicTrack): Slot | null {
    const media = this.createMedia();
    media.preload = "auto";
    media.loop = true;
    media.src = musicTracks[id].url;
    let source: MediaElementAudioSourceNode;
    try {
      source = this.context.createMediaElementSource(media);
    } catch {
      media.removeAttribute("src");
      return null;
    }
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, this.context.currentTime);
    source.connect(gain);
    gain.connect(this.destination);
    return { id, media, source, gain };
  }
  private level(slot: Slot, value: number, seconds: number) {
    const now = this.context.currentTime;
    slot.gain.gain.cancelScheduledValues(now);
    slot.gain.gain.setValueAtTime(slot.gain.gain.value, now);
    slot.gain.gain.linearRampToValueAtTime(value, now + seconds);
  }
  play(id: MusicTrack) {
    if (this.disposed) return;
    if (this.active?.id === id) {
      this.cancelPending();
      if (this.active.media.paused) {
        const slot = this.active;
        const generation = this.generation;
        void slot.media
          .play()
          .then(() => {
            if (
              !this.disposed &&
              this.active === slot &&
              generation === this.generation
            )
              this.level(
                slot,
                this.volume * musicTracks[id].gain * this.mix,
                0.35,
              );
            else slot.media.pause();
          })
          .catch(() => {});
      }
      return;
    }
    if (this.pending?.id === id) return;
    this.cancelPending();
    const generation = ++this.generation;
    const slot = this.prepared?.id === id ? this.prepared : this.createSlot(id);
    if (!slot) return;
    if (this.prepared === slot) {
      this.prepared = null;
      try {
        slot.media.currentTime = 0;
      } catch {}
    } else if (this.prepared) {
      this.release(this.prepared);
      this.prepared = null;
    }
    const { media } = slot;
    media.muted = false;
    this.pending = slot;
    void media
      .play()
      .then(() => {
        if (
          this.disposed ||
          this.pending !== slot ||
          generation !== this.generation
        ) {
          // A cancelled load must never start playing after a route change/mute.
          if (this.active !== slot) media.pause();
          return;
        }
        this.pending = null;
        this.releaseRetiring();
        const previous = this.active;
        this.active = slot;
        this.level(slot, this.volume * musicTracks[id].gain * this.mix, 0.7);
        if (previous) {
          this.retiring = previous;
          this.level(previous, 0, 0.7);
          this.timer = setTimeout(() => this.releaseRetiring(), 750);
        }
      })
      .catch(() => {
        if (this.pending === slot) {
          this.pending = null;
          this.release(slot);
        }
      });
  }
  /** Preserve the active song position for visibility/mute resumes. */
  pause() {
    this.generation++;
    if (this.prepared) {
      this.release(this.prepared);
      this.prepared = null;
    }
    this.cancelPending();
    this.releaseRetiring();
    if (this.active) {
      this.level(this.active, 0, 0);
      this.active.media.pause();
    }
  }
  private cancelPending() {
    if (this.pending) {
      this.generation++;
      this.release(this.pending);
      this.pending = null;
    }
  }
  private releaseRetiring() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.retiring) {
      this.release(this.retiring);
      this.retiring = null;
    }
  }
  private release(slot: Slot) {
    slot.media.pause();
    slot.media.removeAttribute("src");
    slot.media.load();
    slot.source.disconnect();
    slot.gain.disconnect();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.pause();
    if (this.active) {
      this.release(this.active);
      this.active = null;
    }
  }
}
