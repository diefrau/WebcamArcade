import { ResultAchievements } from "../achievements/ResultAchievements";
import { useInputEnvironment } from "../components/InputEnvironment";
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Check,
  CircleHelp,
  Hand,
  Home,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Target,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { useCamera } from "../vision/CameraProvider";
import { WebcamFrame } from "../components/WebcamFrame";
import { HandMenuCursor } from "../components/HandMenuCursor";
import { Character } from "../components/Character";
import "./circle.css";
import { useGameInput } from "../vision/useGameInput";
import { CountUp, ResultCelebration } from "../components/ResultCelebration";
import type { SoundCue } from "../audio/ArcadeAudio";
import { DrawingCursor } from "../vision/DrawingCursor";
import { InputCoach } from "../components/InputCoach";
import { isCircleClosed } from "./circleClosure";

type Point = { x: number; y: number; move?: boolean };
export type CircleResult = {
  score: number;
  accuracy: number;
  duration: number;
  points: number;
  newBest: boolean;
  evidence?: import("../achievements/types").GameResultDetails;
};
const read = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};
const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function ArcadeButton({
  children,
  color = "pink",
  ...props
}: {
  children: React.ReactNode;
  color?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`arcade-button ${color} circle-button ${props.className || ""}`}
    >
      {children}
    </button>
  );
}
function CircleCanvas({
  path,
  cursor,
  reference,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  path: Point[];
  cursor: (Point & { pinched: boolean }) | null;
  reference: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLCanvasElement>) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const width = 1000,
      height = 650;
    element.width = width;
    element.height = height;
    const context = element.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    context.lineCap = "round";
    context.lineJoin = "round";
    if (reference) {
      context.save();
      context.setLineDash([12, 12]);
      context.lineWidth = 5;
      context.strokeStyle = "#ffffff80";
      context.beginPath();
      context.arc(width / 2, height / 2, 190, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    if (path.length) {
      context.beginPath();
      context.moveTo(path[0].x * width, path[0].y * height);
      for (const point of path.slice(1)) {
        if (point.move) context.moveTo(point.x * width, point.y * height);
        else context.lineTo(point.x * width, point.y * height);
      }
      context.strokeStyle = "#ff4fa3";
      context.lineWidth = 15;
      context.shadowColor = "#111";
      context.shadowBlur = 0;
      context.stroke();
      context.strokeStyle = "#fff3a2";
      context.lineWidth = 6;
      context.stroke();
    }
    if (cursor) {
      context.beginPath();
      context.arc(
        cursor.x * width,
        cursor.y * height,
        cursor.pinched ? 12 : 18,
        0,
        Math.PI * 2,
      );
      context.fillStyle = cursor.pinched ? "#ff4fa3" : "#a8ea39";
      context.fill();
      context.strokeStyle = "#111";
      context.lineWidth = 4;
      context.stroke();
    }
  }, [path, reference, cursor]);
  return (
    <canvas
      ref={canvas}
      className="circle-canvas"
      data-drawing={cursor?.pinched ?? false}
      data-strokes={path.filter((point) => point.move).length}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label="Circle drawing canvas"
    />
  );
}

function evaluateCircle(
  points: Point[],
): { score: number; accuracy: number } | null {
  if (points.length < 18) return null;
  const start = points[0],
    end = points[points.length - 1];
  const closure = distance(start, end);
  const center = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  center.x /= points.length;
  center.y /= points.length;
  const radii = points.map((point) => distance(point, center));
  const mean =
    radii.reduce((sum, radius) => sum + radius, 0) / radii.length || 1;
  const variance = Math.sqrt(
    radii.reduce((sum, radius) => sum + ((radius - mean) / mean) ** 2, 0) /
      radii.length,
  );
  const angles = points.map((point) =>
    Math.atan2(point.y - center.y, point.x - center.x),
  );
  let coverage = 0;
  for (let index = 1; index < angles.length; index++) {
    if (points[index].move) continue;
    let delta = Math.abs(angles[index] - angles[index - 1]);
    if (delta > Math.PI) delta = 2 * Math.PI - delta;
    coverage += delta;
  }
  const coverageScore = clamp((coverage / (Math.PI * 2)) * 100);
  const value = clamp(
    100 - closure * 130 - variance * 120 + Math.min(coverageScore, 100) * 0.2,
  );
  return { score: Math.round(value * 10), accuracy: Math.round(value) };
}

export function CircleGamePage({
  onFinish,
  tone,
}: {
  onFinish: (result: CircleResult) => void;
  tone: (kind?: SoundCue) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const camera = useCamera();
  const { compactTouch } = useInputEnvironment();
  const [mode, setMode] = useGameInput();
  const [phase, setPhase] = useState<"ready" | "playing" | "paused">("ready");
  const previousPhase = useRef(phase);
  useEffect(() => {
    if (previousPhase.current === "playing" && phase === "paused")
      tone("pause");
    if (previousPhase.current === "paused" && phase === "playing")
      tone("resume");
    previousPhase.current = phase;
  }, [phase, tone]);
  const [time, setTime] = useState(20);
  const [path, setPath] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<(Point & { pinched: boolean }) | null>(
    null,
  );
  const cursorFilter = useRef(new DrawingCursor());
  const [feedback, setFeedback] = useState("");
  const [reference, setReference] = useState(true);
  const drawing = useRef(false);
  const waitForRelease = useRef(false);
  const pathRef = useRef<Point[]>([]);
  const elapsed = useRef(0);
  const finished = useRef(false);
  const trackingLosses = useRef(0),
    previousTracking = useRef(true),
    usedMouse = useRef(false),
    hadRetry = useRef(false);
  useEffect(() => {
    if (phase !== "playing") return;
    if (mode !== "hand") {
      usedMouse.current = true;
      return;
    }
    const present =
      camera.hand.detected &&
      camera.state === "ready" &&
      camera.vision === "ready";
    if (!present && previousTracking.current) trackingLosses.current++;
    previousTracking.current = present;
  }, [phase, mode, camera.hand.detected, camera.state, camera.vision]);
  const progressSound = useRef(false);
  useEffect(() => {
    if (phase !== "playing" || progressSound.current || path.length < 28)
      return;
    let length = 0;
    for (let i = 1; i < path.length; i++) {
      if (!path[i].move) length += distance(path[i - 1], path[i]);
    }
    if (length > 0.9 && distance(path[0], path[path.length - 1]) < 0.12) {
      progressSound.current = true;
      tone("circle.progress");
    }
  }, [path, phase, tone]);
  const updatePath = useCallback((next: Point[]) => {
    pathRef.current = next;
    setPath(next);
  }, []);
  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  };
  const finish = useCallback(
    (points = pathRef.current, force = false) => {
      if (finished.current) return;
      const result = evaluateCircle(points);
      if (!result) {
        if (force) {
          finished.current = true;
          const best = read<number>("arcade.circle.best", 0);
          const next: CircleResult = {
            score: 0,
            accuracy: 0,
            duration: 20,
            points: points.length,
            newBest: false,
            evidence: {
              inputMode: mode,
              duration: 20,
              trackingLosses: trackingLosses.current,
              metadata: { drawComplete: false, passed: false },
            },
          };
          save("arcade.circle.last", next);
          save("arcade.circle.best", best);
          const plays = Number(read("arcade.circle.plays", 0)) + 1;
          save("arcade.circle.plays", plays);
          onFinish(next);
          navigate("/result/circle", { replace: true });
          return;
        }
        setFeedback("circleTooShort");
        hadRetry.current = true;
        tone("fail");
        updatePath([]);
        setTimeout(() => setFeedback(""), 800);
        return;
      }
      finished.current = true;
      tone("circle.complete");
      const best = read<number>("arcade.circle.best", 0);
      const next: CircleResult = {
        ...result,
        duration: Math.max(1, Math.round(elapsed.current / 1000)),
        points: points.length,
        newBest: result.score > best,
        evidence: {
          inputMode:
            mode === "hand" && !usedMouse.current
              ? "hand"
              : mode === "mouse"
                ? "mouse"
                : "unknown",
          duration: elapsed.current / 1000,
          trackingLosses: trackingLosses.current,
          newBest: result.score > best,
          metadata: {
            drawComplete: true,
            passed: result.score > 0 && !hadRetry.current,
          },
        },
      };
      save("arcade.circle.last", next);
      save("arcade.circle.best", Math.max(best, result.score));
      const plays = Number(read("arcade.circle.plays", 0)) + 1;
      save("arcade.circle.plays", plays);
      onFinish(next);
      navigate("/result/circle", { replace: true });
    },
    [navigate, onFinish, updatePath, tone, mode],
  );
  useEffect(() => {
    if (phase !== "playing") return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      elapsed.current += now - previous;
      previous = now;
      setTime(Math.max(0, Math.ceil(20 - elapsed.current / 1000)));
      if (elapsed.current >= 20000) finish(pathRef.current, true);
    }, 80);
    return () => clearInterval(timer);
  }, [finish, phase]);
  useEffect(() => {
    if (
      mode !== "hand" ||
      phase !== "playing" ||
      !camera.hand.detected ||
      camera.state !== "ready" ||
      camera.vision !== "ready"
    ) {
      drawing.current = false;
      cursorFilter.current.reset();
      setCursor(null);
      return;
    }
    const tip = camera.hand.landmarks[8];
    if (!tip) return;
    const point = cursorFilter.current.update(
      clamp((1 - tip.x - 0.12) / 0.76, 0, 1),
      clamp((tip.y - 0.12) / 0.76, 0, 1),
      performance.now(),
    );
    setCursor({ ...point, pinched: camera.hand.pinched });
    if (waitForRelease.current) {
      if (camera.hand.pinched) return;
      waitForRelease.current = false;
    }
    if (!camera.hand.pinched) {
      drawing.current = false;
      return;
    }
    const newStroke = !drawing.current;
    if (newStroke) tone("circle.start");
    drawing.current = true;
    if (
      newStroke ||
      !pathRef.current.length ||
      distance(pathRef.current[pathRef.current.length - 1], point) > 0.003
    ) {
      const next = [...pathRef.current, { ...point, move: newStroke }];
      updatePath(next);
      if (isCircleClosed(next)) {
        drawing.current = false;
        finish(next);
      }
    }
  }, [
    camera.hand,
    camera.state,
    camera.vision,
    mode,
    phase,
    updatePath,
    finish,
    tone,
  ]);
  useEffect(() => {
    if (mode !== "hand" || phase !== "playing") return;
    if (
      camera.hand.detected &&
      camera.state === "ready" &&
      camera.vision === "ready"
    )
      return;
    const timer = setTimeout(() => {
      drawing.current = false;
      setPhase("paused");
    }, 800);
    return () => clearTimeout(timer);
  }, [camera.hand.detected, camera.state, camera.vision, mode, phase]);
  useEffect(() => {
    const pause = () => setPhase((p) => (p === "playing" ? "paused" : p));
    const hidden = () => {
      if (document.hidden) pause();
    };
    window.addEventListener("arcade:pause", pause);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("arcade:pause", pause);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  const start = () => {
    tone("start");
    finished.current = false;
    trackingLosses.current = 0;
    previousTracking.current = true;
    usedMouse.current = mode !== "hand";
    hadRetry.current = false;
    progressSound.current = false;
    drawing.current = false;
    updatePath([]);
    setFeedback("");
    setTime(20);
    elapsed.current = 0;
    setPhase("playing");
  };
  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== "mouse" || phase !== "playing") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    tone("circle.start");
    drawing.current = true;
    updatePath([getPoint(event)]);
  };
  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== "mouse" || !drawing.current || phase !== "playing") return;
    const point = getPoint(event);
    if (
      distance(pathRef.current[pathRef.current.length - 1] || point, point) >
      0.003
    )
      updatePath([...pathRef.current, point]);
  };
  const pointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== "mouse" || phase !== "playing" || !drawing.current) return;
    drawing.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
    finish();
  };
  const usable =
    mode === "mouse" ||
    (camera.state === "ready" &&
      camera.vision === "ready" &&
      camera.hand.detected);
  return (
    <>
      <div className="circle-top">
        <button className="circle-back" onClick={() => navigate("/games")}>
          <ArrowLeft /> {t("back")}
        </button>
        <div className="circle-timer">
          <span>◷ {t("time")}</span>
          <progress max="20" value={time} />
          <b>
            {time}
            <small>s</small>
          </b>
        </div>
        <ArcadeButton
          color="white"
          onClick={() =>
            setPhase((current) =>
              current === "playing"
                ? "paused"
                : current === "paused" && usable
                  ? "playing"
                  : current,
            )
          }
          disabled={phase === "ready" || (phase === "paused" && !usable)}
          aria-label={t("pause")}
        >
          <Pause />
        </ArcadeButton>
      </div>
      <div className="circle-mode">
        <button
          className={mode === "mouse" ? "active" : ""}
          onClick={() => setMode("mouse")}
        >
          <MousePointer2 />
          {t(compactTouch ? "touchMode" : "circleMouse")}
        </button>
        <button
          className={mode === "hand" ? "active" : ""}
          data-sound={!camera.stream ? "none" : undefined}
          onClick={() => {
            setMode("hand");
            if (!camera.stream) void camera.connect();
          }}
        >
          <Hand />
          {t("circleHand")}
        </button>
        <span>{t(mode === "hand" ? "circleHandHint" : "circleMouseHint")}</span>
      </div>
      <div className="circle-layout">
        <aside className="circle-guide panel">
          <span className="circle-sticker">NEW!</span>
          <h1>{t("circle")}</h1>
          <p>{t("circleInstruction")}</p>
          <div className="circle-rule">
            <Target />
            <strong>{t("circleTarget")}</strong>
            <small>{t("circleTargetHint")}</small>
          </div>
          <WebcamFrame compact />
          <Character asset="circle" className="circle-character" />
        </aside>
        <main className="circle-stage panel">
          <div className="circle-stage-heading">
            <div>
              <span
                key={feedback}
                className={`circle-command ${feedback ? "bounce-feedback" : ""}`}
              >
                {t(feedback || "circleDraw")}
              </span>
              <p>{t("circleStageHint")}</p>
            </div>
            <button
              onClick={() => {
                setReference(!reference);
              }}
              aria-label={t("circleGuideToggle")}
            >
              {reference ? <Check /> : <X />}
              {t("circleGuideToggle")}
            </button>
          </div>
          <CircleCanvas
            path={path}
            cursor={cursor}
            reference={reference}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
          />
          <div className="circle-stage-footer">
            <span>
              <CircleHelp />
              {t(mode === "hand" ? "circleAutoFinish" : "circleFooterHint")}
            </span>
            <span>{path.length} pts</span>
          </div>
          {phase !== "playing" && (
            <div className="circle-overlay">
              <HandMenuCursor active />
              <section className="circle-dialog panel">
                <span className="circle-sticker">
                  {phase === "ready" ? "READY?" : "PAUSE"}
                </span>
                <h2>{t(phase === "ready" ? "circleReadyTitle" : "paused")}</h2>
                <p>{t("circleReadyDesc")}</p>
                <small>
                  {t(
                    mode === "hand"
                      ? "circleHandReady"
                      : compactTouch
                        ? "touchCircle"
                        : "circleMouseReady",
                  )}
                </small>
                {phase === "ready" && (
                  <InputCoach
                    game="circle"
                    cameraMode={mode === "hand"}
                    onModeChange={(value) => setMode(value ? "hand" : "mouse")}
                  />
                )}
                <ArcadeButton
                  data-hand-click
                  onClick={() => {
                    waitForRelease.current = camera.hand.pinched;
                    phase === "ready" ? start() : setPhase("playing");
                  }}
                  disabled={!usable}
                >
                  <Play />
                  {t(phase === "ready" ? "go" : "resume")}
                </ArcadeButton>
                {mode === "hand" && !camera.hand.detected && (
                  <small>{t("handReady")}</small>
                )}
                <button
                  className="circle-fallback"
                  onClick={() => setMode("mouse")}
                >
                  {t(compactTouch ? "touchMode" : "switchMouse")}
                </button>
                {phase === "paused" && (
                  <button
                    className="circle-quit"
                    onClick={() => navigate("/games")}
                  >
                    {t("quit")}
                  </button>
                )}
              </section>
            </div>
          )}
        </main>
        <aside className="circle-side">
          <section className="circle-score panel">
            <h3>
              <Zap />
              {t("circleScore")}
            </h3>
            <b>{path.length.toLocaleString()}</b>
            <span>{t("circlePoints")}</span>
          </section>
          <section className="circle-side-note panel">
            <Character asset="landing" size="sm" />
            <strong>{t("circleHintTitle")}</strong>
            <p>{t("circleHint")}</p>
          </section>
        </aside>
      </div>
      <div className="circle-bottom panel">
        <span>
          <Target />
          {t("circleEvaluation")}
        </span>
        <span>{t("circleEvaluationHint")}</span>
      </div>
    </>
  );
}

export function CircleResultPage({
  tone,
}: {
  tone: (kind?: SoundCue) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const result = read<CircleResult | null>("arcade.circle.last", null);
  const best = read<number>("arcade.circle.best", 0);
  if (!result)
    return (
      <div className="empty-state panel">
        <Trophy />
        <h1>{t("resultEmpty")}</h1>
        <ArcadeButton onClick={() => navigate("/play/circle")}>
          {t("start")}
        </ArcadeButton>
      </div>
    );
  return (
    <div className="circle-result">
      <h1 className="result-heading">
        <span className="yellow-text">{t("circleClear")}</span>
        <span>✦</span>
      </h1>
      <ResultCelebration
        newBest={result.newBest}
        score={result.score}
        onCelebrate={(record) => tone(record ? "newBest" : "result")}
      />
      <div className="circle-result-grid result-achievement-layout">
        <section className="circle-result-art panel">
          <Character asset="circle" />
          <span className="circle-art-badge">
            {result.newBest ? t("newBest") : t("keepGoing")}
          </span>
          <p>{t("circleResultSub")}</p>
        </section>
        <section className="result-panel panel">
          <div className="result-game">
            <div className="result-thumbnail cyan">
              <Character asset="circle" />
            </div>
            <div>
              <span className="circle-sticker">{t("circle")}</span>
              <h2>{t("circle")}</h2>
              <p>{t("circleDesc")}</p>
            </div>
          </div>
          <div className="result-stats">
            <div>
              <span className="pink">{t("circleScore")}</span>
              <b>
                <CountUp value={result.score} />
              </b>
            </div>
            <div>
              <span className="cyan">{t("accuracy")}</span>
              <b>
                <CountUp value={result.accuracy} />
                <small>%</small>
              </b>
            </div>
            <div>
              <span className="lime">{t("points")}</span>
              <b>
                <CountUp value={result.points} />
              </b>
            </div>
          </div>
          <div className="best-comparison">
            <Trophy fill="var(--yellow)" />
            <strong>{t("best")}</strong>
            <b>{best.toLocaleString()}</b>
          </div>
        </section>
        <ResultAchievements gameId="circle" />
      </div>
      <div className="result-actions">
        <ArcadeButton onClick={() => navigate("/play/circle")}>
          <RotateCcw />
          {t("replay")}
        </ArcadeButton>
        <ArcadeButton color="cyan" onClick={() => navigate("/games")}>
          <Play />
          {t("next")}
        </ArcadeButton>
        <ArcadeButton color="white" onClick={() => navigate("/")}>
          <Home />
          {t("toHome")}
        </ArcadeButton>
      </div>
    </div>
  );
}
