import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  ArrowLeft,
  Camera,
  MousePointer2,
  Pause,
  Play,
  Trophy,
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
import { GameTimer } from "../components/GameTimer";
import { useInputEnvironment } from "../components/InputEnvironment";
import { PreGameSequence } from "../components/PreGameSequence";
import { WebcamFrame } from "../components/WebcamFrame";
import { useCamera } from "../vision/CameraProvider";
import type { FaceBox, FaceMotionFrame } from "../vision/face";
import { toViewport } from "../vision/shared/visionCoordinate";
import { drawHockey, makeHockeyRink } from "./hockeyCanvas";
import { HOCKEY_SECONDS } from "./hockeyConfig";
import { HockeyCalibration, hockeyFaceTarget } from "./hockeyFace";
import {
  HOCKEY_HEIGHT,
  HOCKEY_STEP,
  HOCKEY_WIDTH,
  PLAYER_HOME,
  hockeyMalletTarget,
  newHockey,
  stepHockey,
} from "./hockeyRules";
import "./hockey.css";

type Phase = "ready" | "countdown" | "playing" | "paused" | "finished";
type Mode = "mouse" | "face";
type HockeyResult = {
  player: number;
  cpu: number;
  newBest: boolean;
  saved: boolean;
};
const HOCKEY_ID = "face-hockey";
const FACE_GRACE = 260;
const MAX_SAMPLE_AGE = 360;
const arrowKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

export function HockeyGamePage({
  tone,
  onFinish,
}: {
  tone: PlaySound;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  const camera = useCamera();
  const { compactTouch } = useInputEnvironment();
  const navigate = useNavigate();
  const [choice, setChoice] = useState<Mode | null>(null);
  const mode = choice ?? (camera.stream ? "face" : "mouse");
  const [phase, setPhase] = useState<Phase>("ready");
  const [beat, setBeat] = useState(3);
  const [seconds, setSeconds] = useState(HOCKEY_SECONDS);
  const [score, setScore] = useState({ player: 0, cpu: 0 });
  const [goal, setGoal] = useState<"player" | "cpu" | null>(null);
  const [faceStatus, setFaceStatus] = useState<
    "missing" | "calibrating" | "ready"
  >("missing");
  const [trackingLost, setTrackingLost] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const rink = useRef<HTMLCanvasElement | null>(null);
  const game = useRef(newHockey());
  const phaseRef = useRef<Phase>("ready");
  const resumePhase = useRef<"countdown" | "playing">("playing");
  const countdown = useRef(GAME_COUNTDOWN_MS);
  const accumulator = useRef(0);
  const aim = useRef(PLAYER_HOME);
  const keys = useRef(new Set<string>());
  const calibration = useRef(new HockeyCalibration());
  const neutral = useRef<FaceBox | null>(null);
  const latest = useRef<FaceMotionFrame | null>(null);
  const lastArrival = useRef(-Infinity);
  const connecting =
    camera.state === "requesting" || camera.state === "connecting";
  const cameraError =
    camera.state === "denied" ||
    camera.state === "missing" ||
    camera.state === "busy" ||
    camera.state === "error";
  const visionError = camera.vision === "error";
  const liveFace = (now: number) =>
    Boolean(
      latest.current &&
      now - latest.current.time < MAX_SAMPLE_AGE &&
      now - lastArrival.current < FACE_GRACE,
    );
  const ready =
    mode === "mouse" || (camera.vision === "ready" && faceStatus === "ready");

  useGameSound(phase, beat, 0, tone);

  function transition(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
    keys.current.clear();
    accumulator.current = 0;
  }

  function recenter() {
    calibration.current.reset();
    neutral.current = null;
    setFaceStatus(latest.current ? "calibrating" : "missing");
  }

  useEffect(() => {
    calibration.current.reset();
    neutral.current = null;
    latest.current = null;
    lastArrival.current = -Infinity;
    setFaceStatus("missing");
  }, [camera.stream]);

  const receiveFace = useEffectEvent((frame: FaceMotionFrame | null) => {
    const now = performance.now();
    const inMenu =
      phaseRef.current === "ready" || phaseRef.current === "paused";
    if (!frame || now - frame.time > MAX_SAMPLE_AGE) {
      latest.current = null;
      calibration.current.reset();
      if (inMenu && faceStatus !== "missing") setFaceStatus("missing");
      return;
    }
    latest.current = frame;
    lastArrival.current = now;
    if (inMenu) {
      neutral.current ??= calibration.current.add(frame);
      const status = neutral.current ? "ready" : "calibrating";
      if (status !== faceStatus) setFaceStatus(status);
    }
  });
  const { subscribeFaceMotion } = camera;
  useEffect(() => {
    if (mode === "face")
      return subscribeFaceMotion((frame) => receiveFace(frame));
  }, [mode, subscribeFaceMotion]);

  function selectFace() {
    setChoice("face");
    if (!camera.stream) void camera.connect();
    else if (visionError) camera.retryVision();
  }

  function allowPlay() {
    return (
      mode === "mouse" ||
      (ready && neutral.current && liveFace(performance.now()))
    );
  }

  function start() {
    if (phaseRef.current !== "ready" || !allowPlay()) return;
    setChoice(mode);
    countdown.current = GAME_COUNTDOWN_MS;
    setBeat(3);
    transition("countdown");
    tone("game.ready");
  }

  function pause() {
    const previous = phaseRef.current;
    if (previous !== "countdown" && previous !== "playing") return;
    resumePhase.current = previous;
    transition("paused");
    tone("game.pause");
  }

  function resume() {
    if (phaseRef.current !== "paused" || !allowPlay()) return;
    transition(resumePhase.current);
    tone("game.resume");
  }

  function finish() {
    if (phaseRef.current !== "playing") return;
    transition("finished");
    const { player, cpu } = game.current.score;
    const newBest = player > localBest(HOCKEY_ID);
    const saved = recordPlay(HOCKEY_ID, player, 0, HOCKEY_SECONDS, {
      hits: player,
      misses: cpu,
      inputMode: mode,
      newBest,
    });
    if (player !== cpu) tone(player > cpu ? "game.success" : "game.fail");
    onFinish();
    navigate(`/result/${HOCKEY_ID}`, {
      state: { result: { player, cpu, newBest, saved } satisfies HockeyResult },
    });
  }

  const tick = useEffectEvent(
    (
      now: number,
      dtMs: number,
      ctx: CanvasRenderingContext2D,
      background: HTMLCanvasElement,
    ) => {
      const playing = phaseRef.current === "playing";
      const webcam = mode === "face";
      const face = webcam && liveFace(now) ? latest.current : null;
      const lost = webcam && !face && now - lastArrival.current >= FACE_GRACE;
      if (phaseRef.current === "countdown") {
        countdown.current = Math.max(0, countdown.current - dtMs);
        if (!countdown.current) transition("playing");
        else {
          const next = countdownBeat(countdown.current);
          if (next !== beat) setBeat(next);
        }
      }
      if (playing) {
        if (lost !== trackingLost) setTrackingLost(lost);
        if (lost) accumulator.current = 0;
        else {
          if (face && neutral.current)
            aim.current = hockeyFaceTarget(face.box, neutral.current);
          if (mode === "mouse" && keys.current.size) {
            const axis = (negative: string, positive: string) =>
              Number(keys.current.has(positive)) -
              Number(keys.current.has(negative));
            aim.current = hockeyMalletTarget(
              {
                x:
                  aim.current.x + axis("ArrowLeft", "ArrowRight") * dtMs * 0.65,
                y: aim.current.y + axis("ArrowUp", "ArrowDown") * dtMs * 0.65,
              },
              "player",
            );
          }
          accumulator.current += dtMs / 1000;
          const state = game.current;
          while (accumulator.current >= HOCKEY_STEP) {
            accumulator.current -= HOCKEY_STEP;
            const event = stepHockey(state, aim.current);
            if (event === "hit") tone("hockey.hit");
            else if (event) {
              setGoal(event);
              setScore({ ...state.score });
              tone(event === "player" ? "game.score" : "game.fail");
            }
          }
          if (goal && !state.serveIn) setGoal(null);
          const nextSeconds = Math.ceil(HOCKEY_SECONDS - state.elapsed);
          if (nextSeconds !== seconds) setSeconds(nextSeconds);
          if (state.elapsed >= HOCKEY_SECONDS) finish();
        }
      }
      drawHockey(
        ctx,
        background,
        game.current,
        camera.sourceVideo.current,
        face?.box,
      );
    },
  );

  const animating =
    phase === "countdown" ||
    phase === "playing" ||
    (phase !== "finished" && mode === "face" && !!camera.stream);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d", { alpha: false });
    if (!ctx) return;
    const bg = (rink.current ??= makeHockeyRink());
    if (!animating) {
      drawHockey(ctx, bg, game.current);
      return;
    }
    let previous = performance.now();
    let frame = requestAnimationFrame(function loop(now) {
      tick(now, Math.max(0, Math.min(75, now - previous)), ctx!, bg);
      previous = now;
      if (phaseRef.current !== "finished") frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [animating]);

  const pauseOnEvent = useEffectEvent(() => pause());
  useEffect(() => {
    const onPause = () => pauseOnEvent();
    const visibility = () => {
      if (document.hidden) onPause();
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onPause();
    };
    window.addEventListener("arcade:pause", onPause);
    window.addEventListener("keydown", escape);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("arcade:pause", onPause);
      window.removeEventListener("keydown", escape);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (
      mode !== "mouse" ||
      !event.isPrimary ||
      (event.pointerType !== "mouse" &&
        !event.currentTarget.hasPointerCapture(event.pointerId))
    )
      return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    aim.current = toViewport(
      {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      },
      HOCKEY_WIDTH,
      HOCKEY_HEIGHT,
    );
  }

  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (mode !== "mouse" || !event.isPrimary) return;
    event.currentTarget.focus({ preventScroll: true });
    if (event.pointerType !== "mouse")
      event.currentTarget.setPointerCapture(event.pointerId);
    pointerMove(event);
  }

  function keyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    if (mode !== "mouse" || !arrowKeys.has(event.key)) return;
    event.preventDefault();
    keys.current.add(event.key);
  }

  const instruction = t(
    mode === "face"
      ? "hockeyFace"
      : compactTouch
        ? "hockeyTouch"
        : "hockeyMouse",
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
            ? "hockeyCalibrated"
            : faceStatus === "calibrating"
              ? "hockeyCenter"
              : "showFace";
  const controlOptions = (
    <>
      <div
        className="cham-mode hockey-mode"
        role="group"
        aria-label={t("controls")}
      >
        <button
          className={mode === "mouse" ? "active" : ""}
          aria-pressed={mode === "mouse"}
          onClick={() => setChoice("mouse")}
        >
          <MousePointer2 aria-hidden="true" />
          {t(compactTouch ? "touchMode" : "mouseMode")}
        </button>
        <button
          className={mode === "face" ? "active" : ""}
          aria-pressed={mode === "face"}
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
        <div className="hockey-calibration">
          <small role="status">{t(status)}</small>
          {faceStatus === "ready" && (
            <button type="button" onClick={recenter}>
              {t("hockeyRecenter")}
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="cham-page hockey-page">
      <div className="cham-toolbar">
        <Link to="/games">
          <ArrowLeft aria-hidden="true" />
          {t("back")}
        </Link>
        <GameTimer seconds={seconds} duration={HOCKEY_SECONDS} />
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
        <aside className="cham-hud hockey-scoreboard" aria-label={t("score")}>
          <section className="hud-panel cyan">
            <h3>
              <Trophy aria-hidden="true" />
              {t("hockeyYourGoals")}
            </h3>
            <strong>{score.player}</strong>
          </section>
          <section className="hud-panel pink">
            <h3>{t("hockeyCpuGoals")}</h3>
            <strong>{score.cpu}</strong>
          </section>
        </aside>
        <section
          className="cham-stage hockey-stage"
          aria-label={t("hockeyField")}
          data-phase={phase}
        >
          <div className="hockey-board">
            <canvas
              ref={canvas}
              width={HOCKEY_WIDTH}
              height={HOCKEY_HEIGHT}
              aria-label={t("hockeyField")}
              tabIndex={mode === "mouse" && phase === "playing" ? 0 : -1}
              onPointerMove={pointerMove}
              onPointerDown={pointerDown}
              onKeyDown={keyDown}
              onKeyUp={(event) => keys.current.delete(event.key)}
              onBlur={() => keys.current.clear()}
            />
            {phase === "playing" && trackingLost && (
              <p className="hockey-tracking" role="status">
                {t("hockeyTracking")}
              </p>
            )}
            {phase === "playing" && !trackingLost && goal && (
              <div className={`hockey-goal ${goal}`} role="status">
                {t(goal === "player" ? "hockeyGoal" : "hockeyOpponentGoal")}
              </div>
            )}
          </div>
          {phase === "ready" && (
            <PreGameSequence
              title={t(HOCKEY_ID)}
              instruction={instruction}
              area={t("hockeyRules", { seconds: HOCKEY_SECONDS })}
              character="hockey"
              ready={ready}
              onStart={start}
            >
              {controlOptions}
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
                {controlOptions}
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
        <aside className="cham-info hockey-guide">
          <h1>{t(HOCKEY_ID)}</h1>
          <p>{instruction}</p>
          <p>{t("hockeyRules", { seconds: HOCKEY_SECONDS })}</p>
          {(phase === "ready" || phase === "paused") && <WebcamFrame compact />}
          {phase === "playing" && (
            <div className="hockey-sides" aria-label={t("hockeyField")}>
              <span>{t("hockeyYou")}</span>
              <span>CPU</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export function HockeyResultPage({ tone }: { tone: PlaySound }) {
  const { t } = useTranslation();
  const location = useLocation();
  const last = readRuns()
    .reverse()
    .find((run) => run.game === HOCKEY_ID);
  const result: HockeyResult | undefined =
    location.state?.result ??
    (last && {
      player: last.score,
      cpu: last.details?.misses ?? 0,
      newBest: false,
      saved: true,
    });
  const replay = `/play/${HOCKEY_ID}`;
  if (!result)
    return (
      <div className="empty-state panel">
        <h1>{t("resultEmpty")}</h1>
        <Link className="arcade-button pink" to={replay}>
          {t("playNow")}
        </Link>
      </div>
    );
  const headline =
    result.player === result.cpu
      ? "hockeyDraw"
      : result.player > result.cpu
        ? "hockeyWin"
        : "hockeyLoss";
  return (
    <GameResult
      game={HOCKEY_ID}
      heading={t(headline)}
      scoreLabel={t("hockeyYourGoals")}
      score={result.player}
      best={Math.max(localBest(HOCKEY_ID), result.player)}
      newBest={result.newBest}
      saved={result.saved}
      stats={[{ label: t("hockeyCpuGoals"), value: result.cpu }]}
      replay={replay}
      tone={tone}
      achievements={false}
    />
  );
}
