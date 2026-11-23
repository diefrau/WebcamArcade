import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  ArrowLeft,
  Camera,
  MousePointer2,
  Pause,
  Play,
  Star,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGameSound, type PlaySound } from "../audio/useGameSound";
import { recordPlay } from "../community/client";
import { localBest, readRuns } from "../community/store";
import {
  countdownBeat,
  GAME_COUNTDOWN_MS,
  GameCountdown,
} from "../components/GameCountdown";
import { GameResult } from "../components/GameResult";
import { useInputEnvironment } from "../components/InputEnvironment";
import { PreGameSequence } from "../components/PreGameSequence";
import { useReducedMotion } from "../components/useReducedMotion";
import { WebcamFrame } from "../components/WebcamFrame";
import { useCamera } from "../vision/CameraProvider";
import type { FaceMotionFrame } from "../vision/face";
import {
  BubbleCanvas,
  BUBBLE_ENTRY_MS,
  BUBBLE_PALETTE,
  POP_MS,
  type TimedBubbleBurst,
} from "./bubbleCanvas";
import {
  BUBBLE_ROW_SECONDS,
  BUBBLE_SHOTS,
  bubbleModeLabels,
  type BubbleMode,
} from "./bubbleConfig";
import {
  BUBBLE_HEIGHT,
  BUBBLE_WIDTH,
  LAUNCHER,
  advanceBubble,
  advanceBubbleRowClock,
  clampBubbleAngle,
  launchBubble,
  newBubbleRound,
  type BubbleColor,
} from "./bubbleRules";
import { BubbleFaceInput } from "./bubbleFace";
import "./bubble.css";

type Phase = "ready" | "countdown" | "playing" | "paused" | "finished";
type Mode = "mouse" | "face";
type Result = {
  gameMode?: BubbleMode;
  score: number;
  popped: number;
  shots: number;
  cleared: boolean;
  newBest: boolean;
  saved: boolean;
};
const id = "bubble-shooter";
const FACE_TIMEOUT = 260;
const bubbleModes = Object.keys(bubbleModeLabels) as BubbleMode[];

export function BubbleGamePage({
  tone,
  onFinish,
}: {
  tone: PlaySound;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  const camera = useCamera();
  const { compactTouch } = useInputEnvironment();
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const { search } = useLocation();
  const requestedMode = new URLSearchParams(search).get("mode");
  const [choice, setChoice] = useState<Mode | null>(null);
  const mode = choice ?? (camera.stream ? "face" : "mouse");
  const [phase, setPhase] = useState<Phase>("ready");
  const [beat, setBeat] = useState(3);
  const [faceStatus, setFaceStatus] = useState<
    "missing" | "calibrating" | "ready"
  >("missing");
  const [lost, setLost] = useState(false);
  const [game] = useState(() =>
    newBubbleRound(bubbleModes.find((option) => option === requestedMode)),
  );
  const [rowSeconds, setRowSeconds] = useState(game.secondsUntilRow);
  const [hud, setHud] = useState(() => ({
    score: game.score,
    shots: game.shotsLeft,
    shotsUntilRow: game.shotsUntilRow,
    color: game.color,
    next: game.next,
  }));
  const [feedback, setFeedback] = useState(0);
  const feedbackUntil = useRef(0);
  const phaseRef = useRef<Phase>("ready");
  const resumePhase = useRef<"countdown" | "playing">("playing");
  const clock = useRef(GAME_COUNTDOWN_MS);
  const elapsed = useRef(0);
  const endsAt = useRef(Infinity);
  const entryReadyAt = useRef(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const painter = useRef<BubbleCanvas | null>(null);
  const face = useRef(new BubbleFaceInput());
  const faceAt = useRef(-Infinity);
  const aim = useRef(0);
  const bursts = useRef<TimedBubbleBurst[]>([]);
  const connecting =
    camera.state === "requesting" || camera.state === "connecting";
  const cameraError =
    camera.state === "denied" ||
    camera.state === "missing" ||
    camera.state === "busy" ||
    camera.state === "error";
  const visionError = camera.vision === "error";
  const ready =
    mode === "mouse" ||
    (camera.state === "ready" &&
      camera.vision === "ready" &&
      faceStatus === "ready");
  useGameSound(phase, beat, 0, tone);

  function updateHud() {
    setHud({
      score: game.score,
      shots: game.shotsLeft,
      shotsUntilRow: game.shotsUntilRow,
      color: game.color,
      next: game.next,
    });
  }

  function transition(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
    face.current.stop();
  }

  function selectGameMode(next: BubbleMode) {
    if (phaseRef.current !== "ready" || next === game.mode) return;
    Object.assign(game, newBubbleRound(next));
    setRowSeconds(game.secondsUntilRow);
    updateHud();
  }

  function selectFace() {
    setChoice("face");
    if (!camera.stream) void camera.connect();
    else if (visionError) camera.retryVision();
  }

  function resetCalibration() {
    face.current.recalibrate();
    faceAt.current = -Infinity;
    setFaceStatus("missing");
  }

  useEffect(() => {
    face.current.recalibrate();
    faceAt.current = -Infinity;
    setFaceStatus("missing");
  }, [camera.stream]);

  function start() {
    if (
      phaseRef.current !== "ready" ||
      !ready ||
      (mode === "face" && performance.now() - faceAt.current > FACE_TIMEOUT)
    )
      return;
    setChoice(mode);
    clock.current = GAME_COUNTDOWN_MS;
    setBeat(3);
    transition("countdown");
    tone("game.ready");
  }

  function pause() {
    const previous = phaseRef.current;
    if ((previous !== "countdown" && previous !== "playing") || game.outcome)
      return;
    resumePhase.current = previous;
    transition("paused");
    tone("game.pause");
  }

  function resume() {
    if (!ready || phaseRef.current !== "paused") return;
    transition(resumePhase.current);
    tone("game.resume");
  }

  function fire(angle: number, manual: boolean) {
    if (
      phaseRef.current !== "playing" ||
      performance.now() < entryReadyAt.current ||
      !launchBubble(game, angle)
    )
      return;
    if (manual) face.current.stop();
    setFeedback(0);
    updateHud();
    tone("bubble.launch");
  }

  const receiveFace = useEffectEvent((frame: FaceMotionFrame | null) => {
    const inMenu =
      phaseRef.current === "ready" || phaseRef.current === "paused";
    if (!frame?.aim || performance.now() - frame.time > FACE_TIMEOUT) {
      face.current.stop();
      faceAt.current = -Infinity;
      if (inMenu && faceStatus !== "missing") setFaceStatus("missing");
      return;
    }
    faceAt.current = performance.now();
    const playing = phaseRef.current === "playing";
    const shot = face.current.update(frame.aim, frame.time, playing);
    if (playing) {
      aim.current = face.current.angle;
      if (shot !== null) fire(shot, false);
    } else if (inMenu) {
      const status = face.current.neutral !== null ? "ready" : "calibrating";
      if (status !== faceStatus) setFaceStatus(status);
    }
  });
  const { subscribeFaceMotion } = camera;
  useEffect(() => {
    if (mode === "face")
      return subscribeFaceMotion((frame) => receiveFace(frame));
  }, [mode, subscribeFaceMotion]);

  function finish() {
    if (phaseRef.current !== "playing" || !game.outcome) return;
    transition("finished");
    const shots = game.shotsFired;
    const cleared = game.outcome === "clear";
    const newBest = game.score > localBest(id, game.mode);
    const accuracy = shots ? Math.round((game.matches / shots) * 100) : 0;
    const saved = recordPlay(
      id,
      game.score,
      accuracy,
      Math.round(elapsed.current * 10) / 10,
      {
        hits: game.matches,
        gameMode: game.mode,
        shots,
        inputMode: mode,
        newBest,
        metadata: { bubblePopped: game.popped, bubbleCleared: cleared },
      },
    );
    tone(cleared ? "game.success" : "game.fail");
    onFinish();
    navigate(`/result/${id}`, {
      state: {
        result: {
          gameMode: game.mode,
          score: game.score,
          popped: game.popped,
          shots,
          cleared,
          newBest,
          saved,
        } satisfies Result,
      },
    });
  }

  const tick = useEffectEvent(
    (
      now: number,
      dt: number,
      ctx: CanvasRenderingContext2D,
      draw: BubbleCanvas,
    ) => {
      if (phaseRef.current === "countdown") {
        clock.current = Math.max(0, clock.current - dt);
        if (!clock.current) transition("playing");
        else {
          const next = countdownBeat(clock.current);
          if (next !== beat) setBeat(next);
        }
      } else if (phaseRef.current === "playing") {
        const missing = mode === "face" && now - faceAt.current > FACE_TIMEOUT;
        if (missing !== lost) setLost(missing);
        if (missing && face.current.hold) face.current.stop();
        if (!game.outcome) elapsed.current += dt / 1000;
        const popped = advanceBubble(game, dt / 1000);
        const rowLowered = advanceBubbleRowClock(game, dt / 1000);
        if (game.mode === "time-attack") {
          const remaining = Math.max(0, Math.ceil(game.secondsUntilRow));
          if (rowSeconds !== remaining) setRowSeconds(remaining);
        }
        if (popped || rowLowered) {
          const entryTime = game.lowered && !reduceMotion ? BUBBLE_ENTRY_MS : 0;
          entryReadyAt.current = now + entryTime;
          updateHud();
          if (popped?.length) {
            setFeedback(popped.length);
            feedbackUntil.current = now + 570;
            if (!reduceMotion)
              bursts.current.push(
                ...popped.map((burst) => ({ ...burst, born: now })),
              );
            tone("bubble.pop");
            if (!game.outcome && popped.length >= 5)
              tone("game.combo", { step: 2 });
          }
          if (game.outcome)
            endsAt.current =
              now + Math.max(popped?.length ? POP_MS : 160, entryTime);
        }
        if (now >= endsAt.current) finish();
      }
      if (feedback && now >= feedbackUntil.current) setFeedback(0);
      if (bursts.current.length)
        bursts.current = bursts.current.filter(
          ({ born }) => now - born < POP_MS,
        );
      draw.draw(
        ctx,
        game,
        aim.current,
        lost ? 0 : face.current.hold,
        bursts.current,
        now,
        phaseRef.current === "playing" && now >= entryReadyAt.current,
        1 - Math.max(0, (entryReadyAt.current - now) / BUBBLE_ENTRY_MS),
      );
    },
  );

  const animating = phase === "countdown" || phase === "playing";
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const draw = (painter.current ??= new BubbleCanvas());
    if (!animating) {
      draw.draw(ctx, game, aim.current, 0, [], performance.now(), false);
      return;
    }
    let last = performance.now();
    let frame = requestAnimationFrame(function loop(now) {
      tick(now, Math.max(0, Math.min(85, now - last)), ctx!, draw);
      last = now;
      if (phaseRef.current === "countdown" || phaseRef.current === "playing")
        frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [animating, game, game.mode]);

  const onPause = useEffectEvent(() => pause());
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      pause();
      return;
    }
    if (
      phaseRef.current !== "playing" ||
      (event.target instanceof Element &&
        event.target.closest("button, a, input, select, textarea, dialog"))
    )
      return;
    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) fire(aim.current, true);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      aim.current = clampBubbleAngle(
        aim.current + (event.key === "ArrowLeft" ? -0.075 : 0.075),
      );
    }
  });
  useEffect(() => {
    const pauseHandler = () => onPause();
    const keyHandler = (event: KeyboardEvent) => onKey(event);
    const visibility = () => {
      if (document.hidden) onPause();
    };
    window.addEventListener("arcade:pause", pauseHandler);
    window.addEventListener("keydown", keyHandler);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("arcade:pause", pauseHandler);
      window.removeEventListener("keydown", keyHandler);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  function pointerAim(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * BUBBLE_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * BUBBLE_HEIGHT;
    aim.current = clampBubbleAngle(
      Math.atan2(x - LAUNCHER.x, Math.max(20, LAUNCHER.y - y)),
    );
  }

  function pointerFire(event: PointerEvent<HTMLCanvasElement>) {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      phaseRef.current !== "playing"
    )
      return;
    if (mode === "mouse" || lost) pointerAim(event);
    fire(aim.current, true);
  }

  const rules =
    game.mode === "standard"
      ? t("bubbleRules", { count: BUBBLE_SHOTS })
      : game.mode === "endless"
        ? t("bubbleEndlessRules")
        : t("bubbleTimedRules", { seconds: BUBBLE_ROW_SECONDS });
  const instruction = t(
    mode === "face"
      ? "bubbleFace"
      : compactTouch
        ? "bubbleTouch"
        : "bubblePointer",
  );
  const status = cameraError
    ? `camera_${camera.state}`
    : connecting
      ? "permissionHint"
      : visionError
        ? "faceError"
        : camera.vision === "loading"
          ? "faceLoading"
          : faceStatus === "ready"
            ? "bubbleCalibrated"
            : faceStatus === "calibrating"
              ? "bubbleCenter"
              : "showFace";
  const controls = (
    <>
      <div
        className="cham-mode bubble-mode"
        role="group"
        aria-label={t("controls")}
      >
        <button
          aria-pressed={mode === "mouse"}
          className={mode === "mouse" ? "active" : ""}
          onClick={() => setChoice("mouse")}
        >
          <MousePointer2 aria-hidden="true" />
          {t(compactTouch ? "touchMode" : "mouseMode")}
        </button>
        <button
          aria-pressed={mode === "face"}
          className={mode === "face" ? "active" : ""}
          disabled={connecting}
          onClick={selectFace}
        >
          <Camera aria-hidden="true" />
          {t(
            mode === "face" && (cameraError || visionError)
              ? "cameraRetry"
              : "camera",
          )}
        </button>
      </div>
      {mode === "face" && (
        <div className="bubble-calibration">
          <small role="status">{t(status)}</small>
          {faceStatus === "ready" && (
            <button onClick={resetCalibration}>{t("hockeyRecenter")}</button>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="cham-page bubble-page">
      <div className="cham-toolbar">
        <Link to="/games">
          <ArrowLeft aria-hidden="true" />
          {t("back")}
        </Link>
        <strong className="bubble-heading">{t(id)}</strong>
        <button
          aria-label={t(phase === "paused" ? "resume" : "pause")}
          onClick={phase === "paused" ? resume : pause}
          disabled={
            phase === "ready" ||
            phase === "finished" ||
            (phase === "paused" && !ready)
          }
        >
          {phase === "paused" ? (
            <Play aria-hidden="true" />
          ) : (
            <Pause aria-hidden="true" />
          )}
        </button>
      </div>
      <div className="cham-layout">
        <aside className="cham-hud">
          <section className="hud-panel pink">
            <h3>
              <Star aria-hidden="true" />
              {t("score")}
            </h3>
            <strong>{hud.score}</strong>
          </section>
          <section className="hud-panel cyan">
            <h3>{t("bubbleRemaining")}</h3>
            <strong>{Number.isFinite(hud.shots) ? hud.shots : "∞"}</strong>
            <p>
              {game.mode === "time-attack"
                ? t("bubbleRowTimer", { seconds: rowSeconds })
                : t("bubbleRowCounter", { count: hud.shotsUntilRow })}
            </p>
          </section>
          <div className="bubble-queue panel">
            <span>
              {t("bubbleCurrent")} <Swatch color={hud.color} />
            </span>
            <span>
              {t("bubbleNext")} <Swatch color={hud.next} />
            </span>
          </div>
        </aside>
        <section
          className="cham-stage bubble-stage"
          aria-label={t("bubbleField")}
          data-phase={phase}
        >
          <div className="bubble-board">
            <canvas
              ref={canvas}
              width={BUBBLE_WIDTH}
              height={BUBBLE_HEIGHT}
              aria-label={t("bubbleField")}
              tabIndex={phase === "playing" ? 0 : -1}
              onPointerDown={pointerFire}
              onPointerMove={(event) => {
                if (
                  (mode === "mouse" || lost) &&
                  phaseRef.current === "playing"
                )
                  pointerAim(event);
              }}
            />
            {phase === "playing" && lost && (
              <p className="bubble-tracking" role="status">
                {t("bubbleTracking")}
              </p>
            )}
            {phase === "playing" && feedback > 0 && (
              <p className="bubble-pop" role="status">
                {t("bubblePop", { count: feedback })}
              </p>
            )}
          </div>
          {phase === "ready" && (
            <PreGameSequence
              title={t(id)}
              instruction={instruction}
              area={rules}
              character="bubble"
              ready={ready}
              onStart={start}
            >
              <div className="game-mode-choice" role="group" aria-label={t("gameMode")}>
                {bubbleModes.map((option) => (
                  <button
                    type="button"
                    key={option}
                    aria-pressed={game.mode === option}
                    className={game.mode === option ? "active" : ""}
                    onClick={() => selectGameMode(option)}
                  >
                    {t(bubbleModeLabels[option])}
                  </button>
                ))}
              </div>
              {controls}
            </PreGameSequence>
          )}
          {phase === "countdown" && (
            <div className="game-overlay" aria-live="polite">
              <GameCountdown beat={beat} />
            </div>
          )}
          {phase === "paused" && (
            <div className="game-overlay">
              <section className="game-dialog panel">
                <h2>{t("paused")}</h2>
                {controls}
                <button
                  className="arcade-button pink"
                  onClick={resume}
                  disabled={!ready}
                >
                  {t("resume")}
                </button>
                <Link to="/games">{t("quit")}</Link>
              </section>
            </div>
          )}
        </section>
        <aside className="cham-info">
          <h1>{t(id)}</h1>
          <p>{instruction}</p>
          <p>{rules}</p>
          {mode === "face" && (
            <div className="bubble-camera-preview">
              <WebcamFrame compact showHandLandmarks={false} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Swatch({ color }: { color: BubbleColor }) {
  const { fill, symbol } = BUBBLE_PALETTE[color];
  return (
    <b className="bubble-swatch" style={{ backgroundColor: fill }}>
      {symbol}
    </b>
  );
}

export function BubbleResultPage({ tone }: { tone: PlaySound }) {
  const { t } = useTranslation();
  const location = useLocation();
  const last = readRuns()
    .reverse()
    .find((run) => run.game === id);
  const result: Result | undefined =
    location.state?.result ??
    (last && {
      gameMode: bubbleModes.find((option) => option === last.details?.gameMode),
      score: last.score,
      popped: last.details?.metadata?.bubblePopped ?? 0,
      shots: last.details?.shots ?? 0,
      cleared: last.details?.metadata?.bubbleCleared ?? false,
      saved: true,
      newBest: false,
    });
  const gameMode = result?.gameMode ?? "standard";
  const replay = gameMode === "standard" ? `/play/${id}` : `/play/${id}?mode=${gameMode}`;
  if (!result)
    return (
      <div className="empty-state panel">
        <h1>{t("resultEmpty")}</h1>
        <Link className="arcade-button pink" to={replay}>
          {t("playNow")}
        </Link>
      </div>
    );
  return (
    <GameResult
      game={id}
      heading={result.cleared ? undefined : t("bubbleFinished")}
      score={result.score}
      best={Math.max(localBest(id, gameMode), result.score)}
      newBest={result.newBest}
      saved={result.saved}
      replay={replay}
      tone={tone}
      achievements={false}
      stats={[
        { label: t("bubblePopped"), value: result.popped },
        { label: t("bubbleUsed"), value: result.shots },
      ]}
    />
  );
}
