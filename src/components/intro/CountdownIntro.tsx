import type { IntroPhase } from "./timeline";
const words: Partial<Record<IntroPhase, string>> = {
  ready: "READY?",
  three: "3",
  two: "2",
  one: "1",
  go: "GO!",
};
export function CountdownIntro({ phase }: { phase: IntroPhase }) {
  const word = words[phase];
  return word ? (
    <div className="intro-countdown" aria-live="assertive" aria-atomic="true">
      <strong key={phase} className="intro-word" data-beat={phase}>
        {word}
      </strong>
    </div>
  ) : null;
}
