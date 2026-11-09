import type { ReactNode } from "react";
import { Home, Play, RotateCcw, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ResultAchievements } from "../achievements/ResultAchievements";
import type { PlaySound } from "../audio/useGameSound";
import type { CharacterAsset } from "../assets/characters";
import type { GameId } from "../community/store";
import { Character } from "./Character";
import { CountUp, ResultCelebration } from "./ResultCelebration";
import "./game-result.css";

const games = {
  shoot: { art: "shoot", color: "lime", description: "shootDesc" },
  circle: { art: "circle", color: "cyan", description: "circleResultSub" },
  cham: { art: "chamCenter", color: "pink", description: "chamDesc" },
  rps: { art: "rps", color: "purple", description: "rpsDesc" },
  dodge: {
    art: "dodgePlayer",
    color: "orange",
    description: "futureDodgeDesc",
  },
  gate: { art: "pose", color: "purple", description: "gate.prototype" },
} as const satisfies Record<
  GameId | "gate",
  { art: CharacterAsset; color: string; description: string }
>;

type Stat = { label: string; value: number | string; unit?: string };
const statColors = ["pink", "cyan", "lime"];

export function GameResult({
  game,
  heading,
  score,
  scoreLabel,
  stats = [],
  best,
  newBest,
  saved = true,
  replay,
  tone,
  children,
  camera,
  extraAction,
}: {
  game: keyof typeof games;
  heading?: string;
  score: number;
  scoreLabel?: string;
  stats?: Stat[];
  best: number;
  newBest: boolean;
  saved?: boolean;
  replay: string;
  tone: PlaySound;
  children?: ReactNode;
  camera?: ReactNode;
  extraAction?: ReactNode;
}) {
  const { t } = useTranslation();
  const { art, color, description } = games[game];
  const title = t(game === "gate" ? "gate.title" : game);
  const headline = heading ?? t("clear");
  return (
    <div className="game-result">
      <h1 className="result-heading">
        <span className="yellow-text">{headline}</span>
        <span aria-hidden="true">✦</span>
      </h1>
      <ResultCelebration
        score={score}
        newBest={newBest}
        onCelebrate={(record) => tone(record ? "newBest" : "result")}
      />
      <div className="game-result-layout" data-solo={game === "gate"}>
        <section className="result-panel panel">
          <div className="result-game">
            <div className={`result-thumbnail ${color}`}>
              <Character asset={art} priority />
            </div>
            <div>
              <h2>{title}</h2>
              <p>{t(description)}</p>
            </div>
          </div>
          <div className="result-stats">
            {[{ label: scoreLabel ?? t("score"), value: score }, ...stats].map(
              (stat, index) => (
                <div key={stat.label}>
                  <span className={statColors[index]}>{stat.label}</span>
                  <b>
                    {typeof stat.value === "number" ? (
                      <CountUp value={stat.value} />
                    ) : (
                      stat.value
                    )}
                    {stat.unit && <small>{stat.unit}</small>}
                  </b>
                </div>
              ),
            )}
          </div>
          <div className="best-comparison">
            <Trophy fill="var(--yellow)" aria-hidden="true" />
            <strong>{t("best")}</strong>
            <b>{best.toLocaleString()}</b>
          </div>
          {children}
          {!saved && <p role="alert">{t("recordError")}</p>}
        </section>
        {game !== "gate" && (
          <div className="game-result-side">
            <ResultAchievements gameId={game} />
            {camera && (
              <details className="panel game-result-camera">
                <summary>{t("camera")}</summary>
                {camera}
              </details>
            )}
          </div>
        )}
      </div>
      <nav className="result-actions" aria-label={title}>
        <Link className="arcade-button pink" to={replay}>
          <RotateCcw aria-hidden="true" /> {t("replay")}
        </Link>
        <Link className="arcade-button cyan" to="/games">
          <Play aria-hidden="true" /> {t("next")}
        </Link>
        <Link className="arcade-button white" to="/">
          <Home aria-hidden="true" /> {t("toHome")}
        </Link>
        {extraAction}
      </nav>
    </div>
  );
}
