import { useEffect, useRef } from "react";
import { Play } from "lucide-react";
import { IntroLogo } from "./TitleCard";
export function EntryGate({ start }: { start: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus({ preventScroll: true }), []);
  return (
    <div className="intro-entry">
      <IntroLogo />
      <button
        ref={button}
        className="arcade-button pink intro-start"
        data-sound="none"
        onClick={(event) => {
          event.stopPropagation();
          start();
        }}
      >
        <Play fill="currentColor" aria-hidden="true" /> START!
      </button>
    </div>
  );
}
