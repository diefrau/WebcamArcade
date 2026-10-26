import { Star, Sparkles } from "lucide-react";
import { Character } from "../Character";
export function IntroLogo() {
  return (
    <div className="logo intro-logo" aria-label="WEBCAM ARCADE">
      <span className="logo-webcam">WEBCAM</span>
      <span className="logo-arcade">
        {"ARCADE".split("").map((letter, i) => (
          <b key={i}>{letter}</b>
        ))}
      </span>
      <Star className="logo-star" fill="currentColor" aria-hidden="true" />
    </div>
  );
}
export function TitleCard({ fading }: { fading: boolean }) {
  return (
    <div className={"intro-title-card" + (fading ? " is-fading" : "")}>
      <div className="intro-title-logo">
        <IntroLogo />
      </div>
      <Character asset="landing" size="hero" className="intro-aki" priority />
      <Star className="intro-star intro-star-left" aria-hidden="true" />
      <Sparkles className="intro-star intro-star-right" aria-hidden="true" />
    </div>
  );
}
