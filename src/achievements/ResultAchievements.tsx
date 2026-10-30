import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, LockKeyhole, Sparkles, Trophy } from "lucide-react";
import type { GameId } from "../community/store";
import {
  achievementSnapshot,
  readAchievementState,
} from "./achievementManager";
import "./resultAchievements.css";

export function ResultAchievements({ gameId }: { gameId: GameId }) {
  const { t, i18n } = useTranslation();
  const ko = i18n.language.startsWith("ko");
  const [, refresh] = useState(0);
  useEffect(() => {
    const changed = () => refresh((n) => n + 1);
    window.addEventListener("arcade:achievements", changed);
    return () => window.removeEventListener("arcade:achievements", changed);
  }, []);
  const fresh = new Set(
    readAchievementState().lastResults?.[gameId]?.unlockedIds ?? [],
  );
  const items = achievementSnapshot()
    .filter((item) => item.category === "game" && item.gameId === gameId)
    .sort(
      (a, b) =>
        Number(fresh.has(b.id)) - Number(fresh.has(a.id)) ||
        Number(b.unlocked) - Number(a.unlocked) ||
        Number(a.pending) - Number(b.pending),
    );
  const active = items.filter((item) => !item.pending);
  const newCount = items.filter(
    (item) => item.unlocked && fresh.has(item.id),
  ).length;
  return (
    <aside
      className="result-achievements panel"
      data-game={gameId}
      aria-label={t(gameId) + " " + (ko ? "도전과제" : "achievements")}
    >
      <header>
        <h2>
          <Trophy aria-hidden="true" />
          {ko ? "도전과제" : "Achievements"}
        </h2>
        <span>
          {active.filter((item) => item.unlocked).length} / {active.length}
        </span>
      </header>
      {newCount > 0 && (
        <p className="result-achievement-summary">
          <Sparkles aria-hidden="true" />
          {ko ? "이번 판 달성" : "Unlocked this round"} <b>+{newCount}</b>
        </p>
      )}
      <ol
        tabIndex={0}
        aria-label={ko ? "게임 도전과제 목록" : "Game achievement list"}
      >
        {items.map((item) => {
          const isNew = item.unlocked && fresh.has(item.id);
          const title = t("achievements.items." + item.id + ".title");
          return (
            <li
              key={item.id}
              data-achievement={item.id}
              data-new={isNew}
              className={
                (isNew ? "is-new " : "") +
                (item.unlocked ? "is-unlocked " : "") +
                (item.pending ? "is-pending" : "")
              }
            >
              <div className="result-achievement-name">
                {item.unlocked ? (
                  <Check aria-hidden="true" />
                ) : (
                  <LockKeyhole aria-hidden="true" />
                )}
                <h3>{title}</h3>
                {isNew && <span className="result-achievement-new">NEW</span>}
              </div>
              <p>{t("achievements.items." + item.id + ".description")}</p>
              <div className="result-achievement-progress">
                <small>
                  {item.pending
                    ? ko
                      ? "준비 중"
                      : "Coming soon"
                    : item.unlocked
                      ? ko
                        ? "달성!"
                        : "Unlocked!"
                      : ko
                        ? "도전 중"
                        : "In progress"}
                </small>
                {!item.pending && (
                  <span>
                    {item.progress.toLocaleString()} /{" "}
                    {item.target.toLocaleString()}
                  </span>
                )}
              </div>
              {!item.pending && (
                <progress
                  aria-label={title}
                  value={item.progress}
                  max={item.target}
                />
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
