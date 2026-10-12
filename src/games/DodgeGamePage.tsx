import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  MoveHorizontal,
  Pause,
  Play,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { useCamera } from "../vision/CameraProvider";
import { bodyTarget } from "../vision/body";
import { WebcamFrame } from "../components/WebcamFrame";
import { Character } from "../components/Character";
import { CountUp, ResultCelebration } from "../components/ResultCelebration";
import type { SoundCue } from "../audio/ArcadeAudio";
import {
  advanceDodge,
  dodgeFinished,
  dodgeScore,
  newDodge,
  DODGE_DURATION,
  type DodgeState,
} from "./dodgeRules";
import "./dodge.css";

type Phase = "ready" | "countdown" | "playing" | "paused";
export type DodgeResult = {
  score: number;
  seconds: number;
  dodged: number;
  hits: number;
  cleared: boolean;
  newBest: boolean;
  saved: boolean;
};
export function readDodge(): {
  best: number;
  plays: number;
  last: DodgeResult | null;
} {
  try {
    const v = JSON.parse(localStorage.getItem("arcade.dodge") || "null");
    if (
      v &&
      Number.isFinite(v.best) &&
      v.best >= 0 &&
      Number.isInteger(v.plays) &&
      v.plays >= 0
    ) {
      const r = v.last;
      return {
        best: v.best,
        plays: v.plays,
        last:
          r &&
          Number.isFinite(r.score) &&
          r.score >= 0 &&
          Number.isFinite(r.seconds) &&
          r.seconds >= 0 &&
          r.seconds <= 30 &&
          Number.isInteger(r.dodged) &&
          r.dodged >= 0 &&
          Number.isInteger(r.hits) &&
          r.hits >= 0 &&
          r.hits <= 3 &&
          typeof r.cleared === "boolean"
            ? r
            : null,
      };
    }
  } catch {
    /* Storage can be blocked. */
  }
  return { best: 0, plays: 0, last: null };
}
export function DodgeGamePage({
  onFinish,
  tone,
}: {
  onFinish: () => void;
  tone: (cue?: SoundCue) => void;
}) {
  const { t } = useTranslation();
  const camera = useCamera();
  const navigate = useNavigate();
  const [choice, setChoice] = useState<"buttons" | "body" | null>(null);
  const mode = choice ?? (camera.stream ? "body" : "buttons");
  const [phase, setPhase] = useState<Phase>("ready");
  const phaseRef = useRef<Phase>("ready");
  const resumePhase = useRef<Phase>("playing");
  const [state, setState] = useState(newDodge);
  const game = useRef(state);
  const [countdown, setCountdown] = useState(3);
  const count = useRef(3);
  const finished = useRef(false);
  const calibration = useRef({ x: 0.5, width: 0.3 });
  const needsCalibration = useRef(false);
  const target = useRef(0.5);
  const keys = useRef(new Set<string>());
  const held = useRef(0);
  const bodyReady =
    camera.state === "ready" &&
    camera.vision === "ready" &&
    camera.body.detected;
  const canPlay = mode === "buttons" || bodyReady;
  const callbacks = useRef({ tick: (_dt: number) => {}, pause: () => {} });
  function transition(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
    keys.current.clear();
    held.current = 0;
  }
  function pause() {
    if (phaseRef.current !== "playing" && phaseRef.current !== "countdown")
      return;
    resumePhase.current = phaseRef.current;
    transition("paused");
    tone("pause");
  }
  function calibrate() {
    if (!bodyReady) return;
    calibration.current = { x: camera.body.x, width: camera.body.width };
    needsCalibration.current = false;
    target.current = 0.5;
  }
  function start() {
    if (!canPlay) return;
    calibrate();
    game.current = newDodge();
    setState(game.current);
    target.current = 0.5;
    count.current = 3;
    setCountdown(3);
    finished.current = false;
    transition("countdown");
    tone("start");
  }
  function finish(s: DodgeState) {
    if (finished.current) return;
    finished.current = true;
    const previous = readDodge();
    const result: DodgeResult = {
      score: dodgeScore(s),
      seconds: Math.round(s.elapsed * 10) / 10,
      dodged: s.dodged,
      hits: s.hits,
      cleared: s.lives > 0 && s.elapsed >= 30,
      newBest: dodgeScore(s) > previous.best,
      saved: true,
    };
    try {
      localStorage.setItem(
        "arcade.dodge",
        JSON.stringify({
          best: Math.max(previous.best, result.score),
          plays: previous.plays + 1,
          last: result,
        }),
      );
    } catch {
      result.saved = false;
    }
    onFinish();
    navigate("/result/dodge", { replace: true, state: result });
  }
  callbacks.current = {
    pause,
    tick: (dt) => {
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
      if (phaseRef.current === "countdown") {
        count.current = Math.max(0, count.current - dt);
        setCountdown(Math.ceil(count.current));
        if (count.current === 0) transition("playing");
        return;
      }
      if (mode === "body") {
        // Freeze the player during the detection grace period instead of using an old pose.
        if (bodyReady)
          target.current = bodyTarget(
            camera.body,
            calibration.current.x,
            calibration.current.width,
          );
        else target.current = game.current.x;
      } else {
        const direction =
          held.current ||
          Number(keys.current.has("ArrowRight") || keys.current.has("d")) -
            Number(keys.current.has("ArrowLeft") || keys.current.has("a"));
        target.current = Math.max(
          0.1,
          Math.min(0.9, target.current + direction * dt * 0.8),
        );
      }
      const next = advanceDodge(game.current, dt, target.current);
      if (next.hits > game.current.hits) tone("fail");
      else if (next.dodged > game.current.dodged) tone("success");
      game.current = next;
      setState(next);
      if (dodgeFinished(next)) finish(next);
    },
  };
  useEffect(() => {
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      callbacks.current.tick(Math.min(0.1, (now - previous) / 1000));
      previous = now;
    }, 40);
    const pause = () => callbacks.current.pause();
    const hidden = () => {
      if (document.hidden) pause();
    };
    const down = (e: KeyboardEvent) => {
      if (
        document.querySelector("dialog[open]") ||
        (e.target instanceof Element &&
          e.target.closest("input,select,textarea"))
      )
        return;
      if (e.key === "Escape") pause();
      if (["ArrowLeft", "ArrowRight", "a", "d"].includes(e.key)) {
        e.preventDefault();
        keys.current.add(e.key);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key);
    const release = () => {
      keys.current.clear();
      held.current = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", pause);
    window.addEventListener("arcade:pause", pause);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", pause);
      window.removeEventListener("arcade:pause", pause);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  useEffect(() => {
    if (camera.stream) setChoice((current) => current ?? "body");
  }, [camera.stream]);
  useEffect(() => {
    callbacks.current.pause();
    if (mode === "body") needsCalibration.current = true;
  }, [mode]);
  useEffect(() => {
    if (bodyReady && needsCalibration.current && mode === "body") calibrate();
  }, [bodyReady, mode]);
  useEffect(() => {
    if (mode !== "body" || bodyReady || phase === "ready" || phase === "paused")
      return;
    const timer = setTimeout(() => callbacks.current.pause(), 800);
    return () => clearTimeout(timer);
  }, [mode, bodyReady, phase]);
  const changeMode = (next: "body" | "buttons") => {
    pause();
    setChoice(next);
    target.current = game.current.x;
    if (next === "body") {
      calibrate();
      if (!camera.stream) void camera.connect();
    }
  };
  return (
    <div className="dodge-game">
      <div className="cham-toolbar">
        <Link to="/games">← {t("back")}</Link>
        <strong>
          {t("time")} {Math.ceil(DODGE_DURATION - state.elapsed)}
          {t("dodgeSeconds")}
        </strong>
        <button
          disabled={phase === "ready" || (phase === "paused" && !canPlay)}
          aria-label={t(phase === "paused" ? "resume" : "pause")}
          onClick={() =>
            phase === "paused"
              ? (transition(resumePhase.current), tone("resume"))
              : pause()
          }
        >
          {phase === "paused" ? <Play /> : <Pause />}
        </button>
      </div>
      <div className="cham-mode">
        <button
          className={mode === "buttons" ? "active" : ""}
          onClick={() => changeMode("buttons")}
        >
          {t("dodgeButtons")}
        </button>
        <button
          className={mode === "body" ? "active" : ""}
          onClick={() => changeMode("body")}
        >
          <MoveHorizontal />
          {t("bodyMode")}
        </button>
      </div>
      <div className="cham-layout">
        <aside className="cham-hud">
          <section className="hud-panel pink">
            <h3>{t("score")}</h3>
            <strong>{dodgeScore(state)}</strong>
          </section>
          <section className="hud-panel lime">
            <h3>{t("life")}</h3>
            <strong className="dodge-hearts" aria-label={`${state.lives} / 3`}>
              {"♥".repeat(state.lives)}
              {"♡".repeat(3 - state.lives)}
            </strong>
          </section>
          <section className="hud-panel cyan">
            <h3>{t("dodgeAvoided")}</h3>
            <strong>{state.dodged}</strong>
          </section>
        </aside>
        <section className="panel cham-stage dodge-stage">
          <div className="dodge-field" aria-label={t("dodgeField")}>
            <span className="dodge-banner">{t("dodge")}</span>
            <div className="dodge-floor" />
            {state.obstacles.map((o) => (
              <div
                key={o.id}
                className="dodge-obstacle"
                style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%` }}
                aria-hidden="true"
              >
                ★
              </div>
            ))}
            <div
              className={`dodge-player ${state.immune > 0 ? "is-hit" : ""}`}
              style={{ left: `${state.x * 100}%` }}
            >
              <Character asset="dodge" priority />
              <span className="dodge-hitbox" />
            </div>
            {phase === "countdown" && (
              <div className="dodge-count" key={countdown}>
                {countdown || t("start")}
              </div>
            )}
          </div>
          <div className="dodge-controls">
            {[-1, 1].map((direction) => (
              <button
                key={direction}
                disabled={mode !== "buttons" || phase !== "playing"}
                aria-label={t(direction < 0 ? "dodgeLeft" : "dodgeRight")}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  held.current = direction;
                }}
                onPointerUp={() => (held.current = 0)}
                onPointerCancel={() => (held.current = 0)}
              >
                {direction < 0 ? <ArrowLeft /> : <ArrowRight />}
              </button>
            ))}
            <p>{t(mode === "body" ? "dodgeMove" : "dodgeKeyHint")}</p>
          </div>
          {(phase === "ready" || phase === "paused") && (
            <div className="game-overlay">
              <div className="game-overlay-card game-dialog panel">
                <MoveHorizontal size={48} />
                <h2>{t(phase === "paused" ? "paused" : "dodgeReady")}</h2>
                <p>{t("dodgeInstructions")}</p>
                {mode === "body" && (
                  <p>{t(bodyReady ? "dodgeCenter" : "showBody")}</p>
                )}
                <button
                  className="arcade-button pink"
                  disabled={!canPlay}
                  onClick={() =>
                    phase === "ready"
                      ? start()
                      : (transition(resumePhase.current), tone("resume"))
                  }
                >
                  <Play />
                  {t(phase === "paused" ? "resume" : "start")}
                </button>
                {mode === "body" && (
                  <button
                    className="dodge-fallback"
                    onClick={() => changeMode("buttons")}
                  >
                    {t("dodgeButtons")}
                  </button>
                )}
                <Link to="/games">{t("quit")}</Link>
              </div>
            </div>
          )}
        </section>
        <aside className="cham-info panel">
          <WebcamFrame compact />
          <h1>{t("dodge")}</h1>
          <p>{t("dodgeInstructions")}</p>
          <strong className="dodge-tracking">
            {t(
              mode === "body"
                ? bodyReady
                  ? "bodyDetected"
                  : "showBody"
                : "dodgeKeyHint",
            )}
          </strong>
          <p>{t("dodgeRules")}</p>
          <button
            className="cham-calibrate"
            disabled={
              !bodyReady ||
              mode !== "body" ||
              (phase !== "ready" && phase !== "paused")
            }
            onClick={calibrate}
          >
            {t("dodgeCalibrate")}
          </button>
        </aside>
      </div>
    </div>
  );
}
export function DodgeResultPage({ tone }: { tone: (cue?: SoundCue) => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const stored = readDodge();
  const result = (location.state as DodgeResult | null) ?? stored.last;
  if (!result)
    return (
      <div className="empty-state panel">
        <Trophy />
        <h1>{t("resultEmpty")}</h1>
        <Link className="arcade-button pink" to="/play/dodge">
          {t("start")}
        </Link>
      </div>
    );
  return (
    <div className="cham-result dodge-result">
      <h1 className="result-heading yellow-text">
        {t(result.cleared ? "clear" : "dodgeFinished")}
      </h1>
      <ResultCelebration
        newBest={result.newBest}
        score={result.score}
        onCelebrate={(record) => tone(record ? "newBest" : "result")}
      />
      <section className="panel cham-result-panel">
        <Character asset="dodge" priority />
        <div>
          <h2>{t("dodge")}</h2>
          <div className="result-stats">
            {[
              ["score", result.score],
              ["dodgeSurvival", result.seconds],
              ["dodgeAvoided", result.dodged],
            ].map(([key, value]) => (
              <div key={key}>
                <span className="pink">{t(key as string)}</span>
                <b>
                  {key === "dodgeSurvival" ? (
                    (value as number).toFixed(1)
                  ) : (
                    <CountUp value={value as number} />
                  )}
                  {key === "dodgeSurvival" && (
                    <small>{t("dodgeSeconds")}</small>
                  )}
                </b>
              </div>
            ))}
          </div>
          <p className="best-comparison">
            <Trophy />
            {t("best")} <b>{Math.max(stored.best, result.score)}</b>
          </p>
          <p className="dodge-result-note">
            {t(result.cleared ? "dodgeClearNote" : "dodgeRetryNote")}
          </p>
          {!result.saved && <p role="alert">{t("recordError")}</p>}
        </div>
      </section>
      <div className="result-actions">
        <Link className="arcade-button pink" to="/play/dodge">
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
