import { useEffect, useRef } from "react";
import type { SoundCue, PlayOptions } from "./sounds";
export type PlaySound = (cue?: SoundCue, options?: PlayOptions) => void;
/** Follow the same rendered beat as the typography, never an independent timer. */
export function useGameSound(
  phase: string,
  beat: number,
  round: number,
  play: PlaySound,
) {
  const lastBeat = useRef("");
  const lastCommand = useRef("");
  useEffect(() => {
    if (phase === "countdown" && beat > 0) {
      const key = `${round}:${beat}`;
      if (lastBeat.current !== key) {
        lastBeat.current = key;
        play("game.countdown", { step: Math.max(0, 3 - beat) });
      }
    }
    if (phase === "respond" || phase === "playing") {
      const key = `${round}:${phase}`;
      if (lastCommand.current !== key) {
        lastCommand.current = key;
        play("game.start");
      }
    }
    if (phase === "ready") {
      lastBeat.current = "";
      lastCommand.current = "";
    }
  }, [phase, beat, round, play]);
}
