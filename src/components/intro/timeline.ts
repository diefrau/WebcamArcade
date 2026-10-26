export const INTRO_SEEN_KEY = "arcade.intro.seen.v1";
export type IntroPhase =
  | "entry"
  | "blank"
  | "ready"
  | "three"
  | "two"
  | "one"
  | "go"
  | "flash"
  | "title"
  | "fade"
  | "reveal"
  | "complete";
export const introTimeline: readonly { at: number; phase: IntroPhase }[] = [
  { at: 0, phase: "blank" },
  { at: 200, phase: "ready" },
  { at: 900, phase: "three" },
  { at: 1450, phase: "two" },
  { at: 2000, phase: "one" },
  { at: 2550, phase: "go" },
  { at: 2900, phase: "flash" },
  { at: 3000, phase: "title" },
  { at: 4500, phase: "fade" },
  { at: 5100, phase: "reveal" },
  { at: 5800, phase: "complete" },
];
export function introPhaseAt(elapsed: number): IntroPhase {
  return (
    introTimeline.filter((beat) => beat.at <= elapsed).at(-1)?.phase ?? "blank"
  );
}
export const titleVisible = (phase: IntroPhase) =>
  ["title", "fade", "reveal"].includes(phase);
