import {
  Check,
  LockKeyhole,
  Sparkles,
  Trophy,
  Target,
  Hand,
  Smile,
  Circle,
  PersonStanding,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { achievementSnapshot } from "./achievementManager";
export function AchievementCard({
  item,
}: {
  item: ReturnType<typeof achievementSnapshot>[number];
}) {
  const { t, i18n } = useTranslation();
  const ko = i18n.language.startsWith("ko"),
    secret = item.category === "secret",
    hidden = secret && !item.unlocked;
  const title = hidden ? "???" : t("achievements.items." + item.id + ".title");
  const Icon = hidden
    ? LockKeyhole
    : secret
      ? Sparkles
      : item.unlocked
        ? Trophy
        : item.gameId === "shoot"
          ? Target
          : item.gameId === "rps"
            ? Hand
            : item.gameId === "cham"
              ? Smile
              : item.gameId === "circle"
                ? Circle
                : PersonStanding;
  return (
    <article
      data-achievement={item.id}
      className={
        "panel achievement " +
        (item.unlocked ? "unlocked " : "") +
        (secret ? "secret-achievement " : "") +
        (hidden ? "secret-locked " : "") +
        (item.pending ? "achievement-pending" : "")
      }
    >
      <div className="achievement-card-top">
        <Icon aria-hidden="true" />
        <span>
          {hidden
            ? "???"
            : secret
              ? ko
                ? "비밀"
                : "Secret"
              : item.category === "general"
                ? ko
                  ? "공통"
                  : "General"
                : t(item.gameId === "pose" ? "futurePose" : item.gameId!)}
        </span>
      </div>
      <h2>{title}</h2>
      <p>
        {hidden ? "???" : t("achievements.items." + item.id + ".description")}
      </p>
      <div className="achievement-status">
        {!hidden && !secret && !item.pending && (
          <div className="achievement-meter">
            <span>
              {item.progress.toLocaleString()} / {item.target.toLocaleString()}
            </span>
            <progress
              aria-label={title}
              value={item.progress}
              max={item.target}
            />
          </div>
        )}
        <strong>
          {item.pending ? (
            ko ? (
              "준비 중"
            ) : (
              "Coming soon"
            )
          ) : item.unlocked ? (
            <>
              <Check aria-hidden="true" />
              {secret
                ? ko
                  ? "비밀 발견!"
                  : "Secret found!"
                : ko
                  ? "달성!"
                  : "Unlocked!"}
            </>
          ) : hidden ? (
            ko ? (
              "미발견"
            ) : (
              "Undiscovered"
            )
          ) : ko ? (
            "도전 중"
          ) : (
            "In progress"
          )}
        </strong>
        {item.unlocked && (
          <time
            dateTime={
              item.unlockedAt
                ? new Date(item.unlockedAt).toISOString()
                : undefined
            }
          >
            {item.unlockedAt
              ? new Intl.DateTimeFormat(ko ? "ko-KR" : "en-US").format(
                  item.unlockedAt,
                )
              : ko
                ? "이전 기록"
                : "Previous record"}
          </time>
        )}
      </div>
    </article>
  );
}
