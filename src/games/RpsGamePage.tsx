import { useInputEnvironment } from "../components/InputEnvironment";
import { recordPlay } from "../community/client";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Hand, Pause, Play, RotateCcw, Trophy } from "lucide-react";
import { useCamera } from "../vision/CameraProvider";
import { useGameInput } from "../vision/useGameInput";
import { WebcamFrame } from "../components/WebcamFrame";
import { HandMenuCursor } from "../components/HandMenuCursor";
import { Character } from "../components/Character";
import { CountUp, ResultCelebration } from "../components/ResultCelebration";
import type { SoundCue } from "../audio/ArcadeAudio";
import {
  classifyRps,
  rpsChoices,
  rpsOutcome,
  rpsPoints,
  type RpsChoice,
  type RpsOutcome,
} from "./rpsRules";
import "./rps.css";
import { InputCoach } from "../components/InputCoach";

const symbols: Record<RpsChoice, string> = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};
const COUNTDOWN = 1500,
  RESPONSE = 3000,
  FEEDBACK = 1000,
  ROUNDS = 5;
type Phase = "ready" | "countdown" | "respond" | "feedback" | "paused";
type Round = {
  player: RpsChoice | null;
  computer: RpsChoice;
  outcome: RpsOutcome;
};
export type RpsResult = {
  score: number;
  wins: number;
  draws: number;
  rounds: Round[];
  newBest: boolean;
  saved: boolean;
};
export function readRps(): {
  best: number;
  plays: number;
  last: RpsResult | null;
} {
  try {
    const value = JSON.parse(localStorage.getItem("arcade.rps") || "null");
    if (
      value &&
      Number.isFinite(value.best) &&
      value.best >= 0 &&
      Number.isInteger(value.plays) &&
      value.plays >= 0
    ) {
      const last = value.last;
      return {
        best: value.best,
        plays: value.plays,
        last:
          last &&
          Number.isFinite(last.score) &&
          Number.isFinite(last.wins) &&
          Number.isFinite(last.draws) &&
          Array.isArray(last.rounds) &&
          last.rounds.length === ROUNDS &&
          last.rounds.every(
            (r: Round) =>
              r &&
              rpsChoices.includes(r.computer) &&
              (r.player === null || rpsChoices.includes(r.player)) &&
              r.outcome === rpsOutcome(r.player, r.computer),
          )
            ? last
            : null,
      };
    }
  } catch {
    /* Storage may be unavailable. */
  }
  return { best: 0, plays: 0, last: null };
}

export function RpsGamePage({
  onFinish,
  tone,
}: {
  onFinish: () => void;
  tone: (kind?: SoundCue) => void;
}) {
  const { t } = useTranslation();
  const camera = useCamera();
  const { compactTouch } = useInputEnvironment();
  const [mode, setMode] = useGameInput();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("ready");
  const phaseRef = useRef<Phase>("ready");
  const resumePhase = useRef<Phase>("countdown");
  const [remaining, setRemaining] = useState(COUNTDOWN);
  const remainingRef = useRef(COUNTDOWN);
  const [rounds, setRounds] = useState<Round[]>([]);
  const roundsRef = useRef<Round[]>([]);
  const computer = useRef<RpsChoice>("rock");
  const finished = useRef(false);
  const candidate = useRef<{ pose: RpsChoice | null; since: number }>({
    pose: null,
    since: 0,
  });
  const callbacks = useRef({
    tick: (_delta: number) => {},
    pause: () => {},
    answer: (_pose: RpsChoice) => {},
  });
  const handReady =
    camera.state === "ready" &&
    camera.vision === "ready" &&
    camera.hand.detected;
  const canPlay = mode === "mouse" || handReady;
  const settings = camera.stream?.getVideoTracks()[0]?.getSettings();
  const pose = handReady
    ? classifyRps(
        camera.hand.landmarks,
        settings?.width && settings.height
          ? settings.width / settings.height
          : 4 / 3,
      )
    : null;

  function transition(next: Phase, ms = remainingRef.current) {
    phaseRef.current = next;
    setPhase(next);
    remainingRef.current = ms;
    setRemaining(ms);
    candidate.current = { pose: null, since: 0 };
  }
  function pause() {
    if (!["countdown", "respond", "feedback"].includes(phaseRef.current))
      return;
    resumePhase.current = phaseRef.current;
    tone("pause");
    transition("paused");
  }
  function nextRound() {
    // Commit the computer's choice before accepting any player input.
    computer.current =
      rpsChoices[Math.floor(Math.random() * rpsChoices.length)];
    transition("countdown", COUNTDOWN);
  }
  function finish() {
    if (finished.current) return;
    finished.current = true;
    const played = roundsRef.current,
      previous = readRps();
    const score = played.reduce(
      (sum, round) => sum + rpsPoints(round.outcome),
      0,
    );
    const result: RpsResult = {
      score,
      wins: played.filter((r) => r.outcome === "win").length,
      draws: played.filter((r) => r.outcome === "draw").length,
      rounds: played,
      newBest: score > previous.best,
      saved: true,
    };
    try {
      localStorage.setItem(
        "arcade.rps",
        JSON.stringify({
          best: Math.max(previous.best, score),
          plays: previous.plays + 1,
          last: result,
        }),
      );
    } catch {
      result.saved = false;
    }
    recordPlay("rps", score);
    onFinish();
    navigate("/result/rps", { replace: true, state: result });
  }
  function answer(player: RpsChoice | null) {
    if (
      phaseRef.current !== "respond" ||
      document.hidden ||
      document.querySelector("dialog[open]")
    )
      return;
    const outcome = rpsOutcome(player, computer.current);
    const next = [
      ...roundsRef.current,
      { player, computer: computer.current, outcome },
    ];
    roundsRef.current = next;
    setRounds(next);
    tone(outcome === "win" ? "success" : outcome === "draw" ? "click" : "fail");
    transition("feedback", FEEDBACK);
  }
  callbacks.current = {
    pause,
    answer: (choice) => {
      if (mode === "mouse") answer(choice);
    },
    tick: (delta) => {
      if (
        phaseRef.current === "ready" ||
        phaseRef.current === "paused" ||
        finished.current
      )
        return;
      if (document.hidden || document.querySelector("dialog[open]")) {
        pause();
        return;
      }
      remainingRef.current = Math.max(0, remainingRef.current - delta);
      setRemaining(remainingRef.current);
      if (remainingRef.current > 0) return;
      if (phaseRef.current === "countdown") transition("respond", RESPONSE);
      else if (phaseRef.current === "respond") answer(null);
      else roundsRef.current.length >= ROUNDS ? finish() : nextRound();
    },
  };
  useEffect(() => {
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      callbacks.current.tick(now - previous);
      previous = now;
    }, 40);
    const pause = () => callbacks.current.pause();
    const hidden = () => {
      if (document.hidden) pause();
    };
    const key = (event: KeyboardEvent) => {
      if (
        document.querySelector("dialog[open]") ||
        (event.target instanceof Element &&
          event.target.closest("input,select,textarea"))
      )
        return;
      if (event.key === "Escape") pause();
      const choice = { "1": "rock", "2": "paper", "3": "scissors" }[
        event.key
      ] as RpsChoice | undefined;
      if (choice && !event.repeat) {
        event.preventDefault();
        callbacks.current.answer(choice);
      }
    };
    window.addEventListener("arcade:pause", pause);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("keydown", key);
    return () => {
      clearInterval(timer);
      window.removeEventListener("arcade:pause", pause);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("keydown", key);
    };
  }, []);
  useEffect(() => {
    if (mode !== "hand" || phase !== "respond" || !handReady || !pose) {
      candidate.current = { pose: null, since: 0 };
      return;
    }
    const now = performance.now();
    if (candidate.current.pose !== pose)
      candidate.current = { pose, since: now };
    else if (now - candidate.current.since >= 250) answer(pose);
  }, [camera.hand, mode, phase, pose, handReady]);
  useEffect(() => {
    if (mode !== "hand" || handReady || phase === "ready" || phase === "paused")
      return;
    const timer = setTimeout(() => callbacks.current.pause(), 800);
    return () => clearTimeout(timer);
  }, [mode, handReady, phase]);
  const active = phase !== "ready" && phase !== "paused";
  const effectivePhase = phase === "paused" ? resumePhase.current : phase;
  const roundNumber = Math.min(
    rounds.length + (effectivePhase === "feedback" ? 0 : 1),
    ROUNDS,
  );
  const score = rounds.reduce(
    (sum, round) => sum + rpsPoints(round.outcome),
    0,
  );
  const last = rounds.at(-1);
  return (
    <div className="rps-game">
      <div className="cham-toolbar">
        <Link to="/games">← {t("back")}</Link>
        <strong>
          {t("round")} {roundNumber} / {ROUNDS}
        </strong>
        <button
          disabled={
            (!active && phase !== "paused") || (phase === "paused" && !canPlay)
          }
          onClick={() =>
            phase === "paused"
              ? (tone("resume"), transition(resumePhase.current))
              : pause()
          }
          aria-label={t(phase === "paused" ? "resume" : "pause")}
        >
          <Pause />
        </button>
      </div>
      <div className="cham-mode">
        <button
          className={mode === "mouse" ? "active" : ""}
          onClick={() => {
            pause();
            setMode("mouse");
          }}
        >
          {t("rpsButtons")}
        </button>
        <button
          className={mode === "hand" ? "active" : ""}
          onClick={() => {
            pause();
            setMode("hand");
            if (!camera.stream) void camera.connect();
          }}
        >
          <Hand /> {t("handMode")}
        </button>
      </div>
      <div className="cham-layout">
        <aside className="cham-hud">
          <section className="hud-panel pink">
            <h3>{t("score")}</h3>
            <strong>{score}</strong>
          </section>
          <section className="hud-panel cyan">
            <h3>{t("rpsWins")}</h3>
            <strong>{rounds.filter((r) => r.outcome === "win").length}</strong>
          </section>
          <section className="hud-panel purple">
            <h3>{t("round")}</h3>
            <strong>
              {roundNumber} / {ROUNDS}
            </strong>
          </section>
        </aside>
        <section className="cham-stage panel rps-stage">
          <Character asset="rps" className="cham-rival" priority />
          <div className="rps-duel">
            <div>
              <small>{t("rpsYou")}</small>
              <b aria-hidden="true">
                {phase === "feedback" && last
                  ? last.player
                    ? symbols[last.player]
                    : "—"
                  : mode === "hand" && pose
                    ? symbols[pose]
                    : "?"}
              </b>
            </div>
            <span>VS</span>
            <div>
              <small>{t("rpsComputer")}</small>
              <b aria-hidden="true">
                {phase === "feedback" && last ? symbols[last.computer] : "?"}
              </b>
            </div>
          </div>
          <div className="rps-cue" data-phase={phase} aria-live="polite">
            <h2
              className="bounce-feedback"
              key={`${phase}-${rounds.length}-${phase === "countdown" ? Math.ceil(remaining / 500) : ""}`}
            >
              {phase === "countdown"
                ? Math.ceil(remaining / 500)
                : phase === "respond"
                  ? t("rpsShow")
                  : phase === "feedback" && last
                    ? t(`rps_${last.outcome}`)
                    : t("rpsReady")}
            </h2>
            <p>
              {phase === "respond"
                ? t(mode === "hand" ? "rpsHold" : "rpsKeyHint")
                : phase === "feedback" && last
                  ? `+${rpsPoints(last.outcome)}`
                  : t("rpsRules")}
            </p>
          </div>
          <progress
            aria-label={t("time")}
            max={
              phase === "respond"
                ? RESPONSE
                : phase === "feedback"
                  ? FEEDBACK
                  : COUNTDOWN
            }
            value={remaining}
          />
          <div className="cham-controls rps-controls">
            {rpsChoices.map((choice, index) => (
              <button
                key={choice}
                aria-label={t(`rps_${choice}`)}
                disabled={mode !== "mouse" || phase !== "respond"}
                onClick={() => answer(choice)}
              >
                <span aria-hidden="true">{symbols[choice]}</span>
                <small>
                  {t(`rps_${choice}`)} · {index + 1}
                </small>
              </button>
            ))}
          </div>
          <div className="cham-rounds">
            {Array.from({ length: ROUNDS }, (_, i) => (
              <span
                key={i}
                className={
                  rounds[i]?.outcome === "win"
                    ? "won"
                    : rounds[i]
                      ? rounds[i].outcome === "draw"
                        ? "rps-draw"
                        : "lost"
                      : ""
                }
              >
                {rounds[i]
                  ? rounds[i].outcome === "win"
                    ? "✓"
                    : rounds[i].outcome === "draw"
                      ? "="
                      : "✕"
                  : i + 1}
              </span>
            ))}
          </div>
          {!active && (
            <div className="cham-overlay">
              <HandMenuCursor active />
              <div className="cham-dialog panel">
                <h2>{t(phase === "ready" ? "rpsReady" : "paused")}</h2>
                <p>{t("rpsRules")}</p>
                <small>{t(mode === "hand" ? "rpsHold" : "rpsKeyHint")}</small>
                {mode === "hand" && !handReady && <p>{t("handReady")}</p>}
                {phase === "ready" && (
                  <InputCoach
                    game="rps"
                    cameraMode={mode === "hand"}
                    onModeChange={(value) => setMode(value ? "hand" : "mouse")}
                  />
                )}
                <button
                  data-hand-click
                  className="arcade-button pink"
                  disabled={!canPlay}
                  onClick={() => {
                    tone(phase === "ready" ? "start" : "resume");
                    phase === "ready"
                      ? nextRound()
                      : transition(resumePhase.current);
                  }}
                >
                  <Play />
                  {t(phase === "ready" ? "go" : "resume")}
                </button>
                <button
                  className="arcade-button white"
                  onClick={() => setMode("mouse")}
                >
                  {t("rpsButtons")}
                </button>
                <Link to="/games">{t("quit")}</Link>
              </div>
            </div>
          )}
        </section>
        <aside className="cham-info panel">
          <WebcamFrame compact />
          <h1>{t("rps")}</h1>
          <p>{t("rpsInstructions")}</p>
          <strong className="rps-tracking">
            {mode === "hand"
              ? pose
                ? `${symbols[pose]} ${t(`rps_${pose}`)}`
                : t(handReady ? "rpsUnknown" : "showHand")
              : t(compactTouch ? "touchRps" : "rpsKeyHint")}
          </strong>
          <p>{t("rpsRules")}</p>
        </aside>
      </div>
    </div>
  );
}

export function RpsResultPage({ tone }: { tone: (kind?: SoundCue) => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const stored = readRps();
  const result = (location.state as RpsResult | null) ?? stored.last;
  if (!result)
    return (
      <div className="empty-state panel">
        <Trophy />
        <h1>{t("resultEmpty")}</h1>
        <Link className="arcade-button pink" to="/play/rps">
          {t("start")}
        </Link>
      </div>
    );
  return (
    <div className="cham-result rps-result">
      <h1 className="result-heading yellow-text">{t("clear")}</h1>
      <ResultCelebration
        newBest={result.newBest}
        score={result.score}
        onCelebrate={(record) => tone(record ? "newBest" : "result")}
      />
      <section className="panel cham-result-panel">
        <Character asset="rps" priority />
        <div>
          <h2>{t("rps")}</h2>
          <div className="result-stats">
            {[
              ["score", result.score],
              ["rpsWins", result.wins],
              ["rpsDraws", result.draws],
            ].map(([key, value]) => (
              <div key={key}>
                <span className="pink">{t(key as string)}</span>
                <b>
                  <CountUp value={value as number} />
                </b>
              </div>
            ))}
          </div>
          <p className="best-comparison">
            <Trophy />
            {t("best")} <b>{Math.max(stored.best, result.score)}</b>
          </p>
          <ol className="rps-round-results">
            {result.rounds.map((round, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                <span>
                  {t("rpsYou")} {round.player ? symbols[round.player] : "—"} ·{" "}
                  {t("rpsComputer")} {symbols[round.computer]}
                </span>
                <strong>{t(`rps_${round.outcome}`)}</strong>
              </li>
            ))}
          </ol>
          {!result.saved && <p role="alert">{t("recordError")}</p>}
        </div>
      </section>
      <div className="result-actions">
        <Link className="arcade-button pink" to="/play/rps">
          <RotateCcw />
          {t("replay")}
        </Link>
        <Link className="arcade-button cyan" to="/games">
          {t("next")}
        </Link>
        <Link className="arcade-button white" to="/">
          {t("toHome")}
        </Link>
      </div>
    </div>
  );
}
