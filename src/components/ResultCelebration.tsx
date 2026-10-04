import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Crown, Star } from "lucide-react";
import { useArcadeReady } from "./ArcadeLoading";
import { useReducedMotion } from "./useReducedMotion";
import "./result-celebration.css";

export function CountUp({ value }: { value: number }) {
  const ready = useArcadeReady();
  const reduced = useReducedMotion();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!ready || reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 850);
      setCount(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, reduced, value]);
  return (
    <span className="count-up" aria-label={value.toLocaleString()}>
      <span aria-hidden="true">
        {(reduced ? value : count).toLocaleString()}
      </span>
    </span>
  );
}

export function ResultCelebration({
  newBest,
  score,
  onCelebrate,
}: {
  newBest: boolean;
  score: number;
  onCelebrate: (record: boolean) => void;
}) {
  const { t } = useTranslation();
  const ready = useArcadeReady();
  const reduced = useReducedMotion();
  const played = useRef(false);
  const celebrate = useRef(onCelebrate);
  celebrate.current = onCelebrate;
  useEffect(() => {
    if (!ready || played.current) return;
    played.current = true;
    celebrate.current(newBest && score > 0);
  }, [ready, newBest, score]);
  return (
    <>
      <div
        className={`reward-sticker ${newBest && score > 0 ? "is-record" : ""}`}
        role="status"
      >
        {newBest && score > 0 ? <Crown /> : <Star />}
        <strong>
          {t(
            newBest && score > 0 ? "newBest" : score > 0 ? "nice" : "keepGoing",
          )}
        </strong>
        <span aria-hidden="true">✦</span>
      </div>
      {ready && score > 0 && !reduced && (
        <div className="reward-confetti" aria-hidden="true">
          {Array.from({ length: newBest ? 40 : 24 }, (_, index) => (
            <i
              key={index}
              style={
                {
                  "--piece-x": `${(index * 37 + 7) % 100}%`,
                  "--piece-drift": `${(index % 2 ? 1 : -1) * (30 + (index % 90))}px`,
                  "--piece-delay": `${(index % 8) * 0.07}s`,
                  "--piece-color": [
                    "#ff4fa3",
                    "#34c8ff",
                    "#a8ea39",
                    "#ffd927",
                    "#b478ff",
                  ][index % 5],
                  "--piece-turn": `${360 + (index % 5) * 90}deg`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
