// Keep the original engine/API for existing callers while exposing the shared
// manager name to new UI and game code. Both paths use one context and master.
export { ArcadeAudio as SoundManager } from "./ArcadeAudio";
export type { SoundCue, PlayOptions } from "./sounds";
