import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { achievementSnapshot } from "./achievementManager";
import { AchievementCard } from "./AchievementCard";
import type { AchievementGameId } from "./types";
import type { Progress } from "../community/store";
import "../community/secrets.css";
import "./achievements.css";
export function AchievementsPanel({
  remote,
  online,
}: {
  remote?: Progress;
  online: boolean;
}) {
  const { t, i18n } = useTranslation(),
    ko = i18n.language.startsWith("ko");
  const [filter, setFilter] = useState<"all" | AchievementGameId>("all");
  const [, refresh] = useState(0);
  useEffect(() => {
    const change = () => refresh((n) => n + 1);
    window.addEventListener("arcade:achievements", change);
    window.addEventListener("arcade:community", change);
    return () => {
      window.removeEventListener("arcade:achievements", change);
      window.removeEventListener("arcade:community", change);
    };
  }, []);
  const all = achievementSnapshot(online ? remote : undefined);
  const available = all.filter((a) => !a.pending),
    unlocked = available.filter((a) => a.unlocked).length;
  const pending = all.length - available.length,
    percent = Math.round((100 * unlocked) / available.length);
  const games = [
    "all",
    "cham",
    "circle",
    "shoot",
    "rps",
    "dodge",
    "pose",
  ] as const;
  const selected =
    filter === "all"
      ? all
      : all.filter((a) => a.category === "game" && a.gameId === filter);
  return (
    <section className="achievements-panel">
      <div className="panel achievement-summary">
        <div>
          <h2>{ko ? "도전과제 달성률" : "Achievement completion"}</h2>
          <strong>
            {unlocked} / {available.length} <b>{percent}%</b>
          </strong>
        </div>
        <progress
          aria-label={
            ko ? "전체 도전과제 진행" : "Overall achievement progress"
          }
          value={unlocked}
          max={available.length}
        />
        <p>
          {ko ? "비밀" : "Secrets"}{" "}
          {all.filter((a) => a.category === "secret" && a.unlocked).length} / 6{" "}
          <span>
            · {ko ? "준비 중" : "Coming soon"} {pending}
          </span>
        </p>
      </div>
      {online && (
        <p className="achievement-sync-note">
          {ko
            ? "기존 온라인 기록과 이 기기의 확장 도전과제를 함께 표시합니다. 추가 도전과제의 상세 진행은 이 기기에 저장됩니다."
            : "Existing online records are combined with this device’s expanded achievements. Detailed progress for new challenges is stored on this device."}
        </p>
      )}
      <div
        className="community-games achievement-filters"
        role="group"
        aria-label={ko ? "도전과제 게임" : "Achievement game"}
      >
        {games.map((id) => {
          const items =
            id === "all"
              ? all
              : all.filter((a) => a.category === "game" && a.gameId === id);
          const active = items.filter((a) => !a.pending),
            count = active.filter((a) => a.unlocked).length;
          return (
            <button
              key={id}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              <span>
                {id === "all"
                  ? ko
                    ? "전체"
                    : "All"
                  : t(id === "pose" ? "futurePose" : id)}
              </span>
              <small>
                {active.length
                  ? count + " / " + active.length
                  : ko
                    ? "준비 중"
                    : "Coming soon"}
                {items.some((a) => a.pending) && id !== "all"
                  ? " +" + items.filter((a) => a.pending).length
                  : ""}
              </small>
            </button>
          );
        })}
      </div>
      {filter !== "all" && filter !== "pose" && (
        <Link
          className="arcade-button cyan achievement-play"
          to={"/play/" + filter}
        >
          {t(filter)} {ko ? "플레이하기 →" : "Play →"}
        </Link>
      )}
      <div className="achievement-grid">
        {selected.map((item) => (
          <AchievementCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
