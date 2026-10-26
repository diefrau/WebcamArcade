import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Sparkles, Trophy } from "lucide-react";
import type { AchievementNotice } from "./achievementNotices";
import "./secrets.css";
import type { PlaySound } from "../audio/useGameSound";
export function AchievementToasts({ play }: { play?: PlaySound }) {
  const { i18n } = useTranslation();
  const [queue, setQueue] = useState<AchievementNotice[]>([]);
  const [leaving, setLeaving] = useState(false);
  const active = queue[0];
  useEffect(() => {
    const receive = (event: Event) => {
      const notice = (event as CustomEvent<AchievementNotice>).detail;
      setQueue((current) =>
        current.some((item) => item.id === notice.id)
          ? current
          : [...current, notice],
      );
    };
    window.addEventListener("arcade:achievement", receive);
    return () => window.removeEventListener("arcade:achievement", receive);
  }, []);
  useEffect(() => {
    if (!active) return;
    play?.("sticker.appear");
    setLeaving(false);
    const hide = setTimeout(() => setLeaving(true), 3000);
    const remove = setTimeout(() => {
      setLeaving(false);
      setQueue((current) => current.slice(1));
    }, 3350);
    return () => {
      clearTimeout(hide);
      clearTimeout(remove);
    };
  }, [active, play]);
  if (!active) return null;
  const ko = i18n.language.startsWith("ko");
  return createPortal(
    <aside
      key={active.id}
      className={`achievement-toast ${active.secret ? "secret-reward" : ""} ${leaving ? "is-leaving" : ""}`}
      role="status"
      data-state={leaving ? "leaving" : "visible"}
    >
      {active.secret ? (
        <Sparkles aria-hidden="true" />
      ) : (
        <Trophy aria-hidden="true" />
      )}
      <div>
        <small>{ko ? "도전과제 달성!" : "Achievement unlocked!"}</small>
        <strong>{active.title[ko ? 0 : 1]}</strong>
      </div>
    </aside>,
    document.body,
  );
}
