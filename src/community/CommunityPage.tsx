import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Crown, Star, Trophy } from "lucide-react";
import {
  achievementIds,
  gameIds,
  localBest,
  readProgress,
  countProgress,
  type GameId,
  type Progress,
} from "./store";
import {
  communityConfigured,
  joined,
  joinCommunity,
  loadBoard,
  loadProgress,
  syncRuns,
  type BoardRow,
} from "./client";
import "./community.css";
import { achievementDescriptions as descriptions } from "./achievementNotices";
import { SecretAchievements } from "./SecretAchievements";

export function CommunityPage({
  achievements = false,
}: {
  achievements?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const text = (ko: string, en: string) =>
    i18n.language.startsWith("ko") ? ko : en;
  const [game, setGame] = useState<GameId>("shoot");
  const [online, setOnline] = useState(false);
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [progress, setProgress] = useState<Progress>(readProgress);
  const [participating, setParticipating] = useState(false);
  const [nickname, setNickname] = useState(() => {
    try {
      return localStorage.getItem("arcade.community.nickname") || "";
    } catch {
      return "";
    }
  });
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    let active = true;
    if (communityConfigured)
      void joined()
        .then((value) => {
          if (active) setParticipating(value);
        })
        .catch(() => {
          if (active) setError(true);
        });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const id = ++request.current;
    setError(false);
    setRows([]);
    setProgress(readProgress());
    if (!online) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      if (participating) await syncRuns();
      const [board, unlocks] = await Promise.all([
        loadBoard(game),
        participating ? loadProgress() : Promise.resolve(null),
      ]);
      if (id !== request.current) return;
      setRows(board);
      if (unlocks) setProgress(unlocks);
    })()
      .catch(() => {
        if (id === request.current) setError(true);
      })
      .finally(() => {
        if (id === request.current) setLoading(false);
      });
    return () => {
      request.current++;
    };
  }, [online, game, refresh, participating]);
  return (
    <div className="community-page">
      <h1>
        {achievements ? (
          <Star aria-hidden="true" />
        ) : (
          <Crown aria-hidden="true" />
        )}
        <span className="yellow-text">
          {t(achievements ? "missions" : "ranking")}
        </span>
      </h1>
      <div
        className="community-tabs"
        aria-label={text("기록 범위", "Record scope")}
      >
        <button aria-pressed={!online} onClick={() => setOnline(false)}>
          {text("이 기기", "This device")}
        </button>
        <button
          aria-pressed={online}
          disabled={!communityConfigured}
          onClick={() => setOnline(true)}
        >
          {text("온라인", "Online")}
        </button>
      </div>
      {!communityConfigured && (
        <p className="community-notice">
          {text(
            "온라인 랭킹은 준비 중이에요. 지금은 이 기기의 기록을 확인할 수 있어요.",
            "Online rankings are coming soon. You can view records on this device.",
          )}
        </p>
      )}
      {online && (
        <section className="panel community-profile">
          <h2>{text("익명으로 함께 플레이!", "Play together anonymously!")}</h2>
          <p>
            {text(
              "닉네임은 선택이에요. 참가하면 이 기기에 남은 최근 게임 기록이 공개 랭킹에 반영돼요.",
              "A nickname is optional. Joining shares recent game records from this device on the public leaderboard.",
            )}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setJoining(true);
              setError(false);
              void joinCommunity(nickname)
                .then(() => {
                  setParticipating(true);
                  setRefresh((v) => v + 1);
                })
                .catch(() => setError(true))
                .finally(() => setJoining(false));
            }}
          >
            <label>
              {text("닉네임 (최대 16자)", "Nickname (up to 16 characters)")}
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={16}
                placeholder={text("비워두면 익명", "Leave blank for anonymous")}
              />
            </label>
            <button disabled={joining} className="arcade-button pink">
              {text(
                participating ? "닉네임 저장 / 동기화" : "익명으로 참가",
                participating ? "Save name / Sync" : "Join anonymously",
              )}
            </button>
          </form>
          {participating && (
            <p>
              {text(
                "참가 중 · 브라우저 데이터를 지우면 익명 계정을 복구할 수 없어요.",
                "Joined · clearing browser data removes access to your anonymous account.",
              )}
            </p>
          )}
        </section>
      )}
      {error && (
        <div className="community-notice" role="alert">
          {text(
            "온라인 기록을 불러오지 못했어요. 기기 기록은 그대로 남아 있어요.",
            "Could not load online records. Your device records are still available.",
          )}{" "}
          <button onClick={() => setRefresh((v) => v + 1)}>
            {text("다시 시도", "Retry")}
          </button>
        </div>
      )}
      {loading && (
        <p role="status">{text("기록을 불러오는 중…", "Loading records…")}</p>
      )}
      {achievements ? (
        <>
          {online && !participating ? (
            <p>
              {text(
                "익명으로 참가하면 온라인 도전과제를 확인할 수 있어요.",
                "Join anonymously to see online achievements.",
              )}
            </p>
          ) : online && (loading || error) ? null : (
            <div className="achievement-grid">
              {achievementIds.map((id) => {
                const counter = countProgress(progress, id);
                return (
                  <article
                    className={`panel achievement ${progress[id] ? "unlocked" : ""}`}
                    key={id}
                  >
                    <Trophy />
                    <h2>{text(...descriptions[id])}</h2>
                    <div className="achievement-status">
                      {counter && (
                        <div className="achievement-meter">
                          <span>
                            {counter.value} / {counter.target}
                          </span>
                          <progress
                            aria-label={text(...descriptions[id])}
                            value={counter.value}
                            max={counter.target}
                          />
                        </div>
                      )}
                      <strong>
                        {text(
                          progress[id] ? "달성!" : "도전 중",
                          progress[id] ? "Unlocked!" : "In progress",
                        )}
                      </strong>
                    </div>
                  </article>
                );
              })}
              <SecretAchievements unlocked={progress.secrets} />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="community-games">
            {gameIds.map((id) => (
              <button
                key={id}
                aria-pressed={game === id}
                onClick={() => setGame(id)}
              >
                {t(id)}
              </button>
            ))}
          </div>
          <section className="panel community-board">
            <h2>
              {t(game)} ·{" "}
              {text(
                online ? "온라인 랭킹" : "이 기기의 최고 기록",
                online ? "Online rankings" : "Best on this device",
              )}
            </h2>
            {!online ? (
              <div className="local-score">
                <Trophy />
                <b>{localBest(game).toLocaleString()}</b>
                <span>{t("points")}</span>
              </div>
            ) : !loading && !error && rows.length === 0 ? (
              <p>
                {text(
                  "아직 등록된 기록이 없어요. 첫 기록을 남겨보세요!",
                  "No scores yet. Set the first record!",
                )}
              </p>
            ) : (
              <ol>
                {rows.map((row) => (
                  <li key={row.place}>
                    <strong>{row.place}</strong>
                    <span>
                      {row.nickname === "익명"
                        ? text("익명", "Anonymous")
                        : row.nickname}
                    </span>
                    <b>{row.score.toLocaleString()}</b>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <p className="community-disclaimer">
            {text(
              "게임마다 점수 기준이 달라 별도로 집계해요. 온라인은 참가자가 제출한 커뮤니티 기록입니다.",
              "Each game has its own leaderboard. Online scores are community submissions.",
            )}
          </p>
        </>
      )}
      <Link className="arcade-button cyan" to="/games">
        {text("게임 하러 가기", "Play a game")}
      </Link>
    </div>
  );
}
