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
  Heart,
  MousePointer2,
  Pause,
  Play,
  Star,
  Zap,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  GameCountdown,
  countdownBeat,
  GAME_COUNTDOWN_MS,
} from "../components/GameCountdown";
import { GameResult } from "../components/GameResult";
import { GameTimer } from "../components/GameTimer";
import { HandMenuCursor } from "../components/HandMenuCursor";
import { useInputEnvironment } from "../components/InputEnvironment";
import { PreGameSequence } from "../components/PreGameSequence";
import { useReducedMotion } from "../components/useReducedMotion";
import { WebcamFrame } from "../components/WebcamFrame";
import { useGameSound, type PlaySound } from "../audio/useGameSound";
import { recordPlay } from "../community/client";
import { localBest, readRuns } from "../community/store";
import { useCamera } from "../vision/CameraProvider";
import { useGameInput } from "../vision/useGameInput";
import type { HandSample } from "../vision/gestures";
import { smoothPoint } from "../vision/shared/smoothing";
import { mirrored, toViewport } from "../vision/shared/visionCoordinate";
import type { Point2D, TimedPoint } from "../vision/visionTypes";
import {
  BOMB_BLAST_MS,
  drawSlice,
  sliceBurstDuration,
  type SliceBurst,
  type SliceTrail,
} from "./sliceCanvas";
import {
  advanceSlice,
  cutAlongPath,
  newSliceRound,
  SlashTracker,
  SLICE_HEIGHT,
  SLICE_LIVES,
  SLICE_SAMPLE_GAP_MS,
  SLICE_SECONDS,
  SLICE_WIDTH,
} from "./sliceRules";
import "./slice.css";

type Phase =
  "ready" | "countdown" | "playing" | "paused" | "ending" | "finished";
const animates = (phase: Phase) =>
  phase === "countdown" || phase === "playing" || phase === "ending";
type Feedback = { kind: "cut" | "combo" | "bomb"; count: number; at: number };
type SliceResult = {
  score: number;
  sliced: number;
  combo: number;
  cleared: boolean;
  newBest: boolean;
  saved: boolean;
};
const HAND_TIMEOUT = 250;
const HAND_GAP_GRACE = 130;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const arenaPoint = (x: number, y: number) =>
  toViewport({ x: clamp(x), y: clamp(y) }, SLICE_WIDTH, SLICE_HEIGHT);

export function SliceGamePage({
  tone,
  onFinish,
}: {
  tone: PlaySound;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const camera = useCamera();
  const { compactTouch } = useInputEnvironment();
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useGameInput({ preferCameraOnTouch: true });
  const [phase, setPhase] = useState<Phase>("ready");
  const animating = animates(phase);
  const directHandInput =
    mode === "hand" && (phase === "playing" || phase === "ending");
  const [beat, setBeat] = useState(3);
  const [seconds, setSeconds] = useState(SLICE_SECONDS);
  const [hud, setHud] = useState({ score: 0, combo: 0, lives: SLICE_LIVES });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [trackingLost, setTrackingLost] = useState(false);
  const game = useRef(newSliceRound());
  const currentPhase = useRef<Phase>("ready");
  const resumePhase = useRef<"countdown" | "playing">("playing");
  const remaining = useRef(GAME_COUNTDOWN_MS);
  const canvas = useRef<HTMLCanvasElement>(null);
  const track = useRef(new SlashTracker());
  const beginsAt = useRef(0);
  const lastHandTime = useRef(-Infinity);
  const lastHandArrival = useRef(-Infinity);
  const handTarget = useRef<{ point: Point2D; handedness?: string } | null>(
    null,
  );
  const cursor = useRef<Point2D | null>(null);
  const trail = useRef<SliceTrail | null>(null);
  const bursts = useRef<SliceBurst[]>([]);
  const bombEndsAt = useRef(0);
  const pendingResult = useRef<SliceResult | null>(null);
  const pointer = useRef<number | null>(null);
  const handReady =
    camera.state === "ready" &&
    camera.vision === "ready" &&
    camera.hand.detected;
  const canPlay =
    mode === "mouse" ||
    (handReady && performance.now() - (camera.hand.time ?? 0) <= HAND_TIMEOUT);
  const connecting =
    camera.state === "requesting" || camera.state === "connecting";
  const cameraProblem =
    camera.state === "denied" ||
    camera.state === "missing" ||
    camera.state === "busy" ||
    camera.state === "error";
  const visionProblem = camera.vision === "error";
  useGameSound(phase, beat, 0, tone);

  function resetStroke() {
    track.current.reset();
    handTarget.current = null;
    cursor.current = null;
    trail.current = null;
  }

  function transition(next: Phase) {
    currentPhase.current = next;
    setPhase(next);
    resetStroke();
    pointer.current = null;
    beginsAt.current = performance.now();
  }

  function start() {
    if (!canPlay || currentPhase.current !== "ready") return;
    setMode(mode);
    remaining.current = GAME_COUNTDOWN_MS;
    setBeat(3);
    transition("countdown");
    tone("game.ready");
  }

  function pause() {
    const previous = currentPhase.current;
    if (previous !== "countdown" && previous !== "playing") return;
    resumePhase.current = previous;
    transition("paused");
    tone("game.pause");
  }

  function resume() {
    if (!canPlay || currentPhase.current !== "paused") return;
    transition(resumePhase.current);
    tone("game.resume");
  }

  function selectCamera() {
    setMode("hand");
    if (!camera.stream) void camera.connect();
    else if (visionProblem) camera.retryVision();
  }

  function finish() {
    if (currentPhase.current !== "playing") return;
    const showBlast = performance.now() < bombEndsAt.current;
    transition(showBlast ? "ending" : "finished");
    const { score, elapsed, sliced, maxCombo, lives } = game.current;
    const cleared = lives > 0;
    const newBest = score > localBest("slice");
    const saved = recordPlay("slice", score, 0, Math.round(elapsed * 10) / 10, {
      inputMode: mode,
      hits: sliced,
      misses: SLICE_LIVES - lives,
      maxCombo,
      newBest,
    });
    const result: SliceResult = {
      score,
      sliced,
      combo: maxCombo,
      cleared,
      newBest,
      saved,
    };
    if (cleared) tone("game.success");
    onFinish();
    if (showBlast) pendingResult.current = result;
    else navigate("/result/slice", { state: { result } });
  }

  function updateHud() {
    const { score, combo, lives } = game.current;
    setHud({ score, combo, lives });
  }

  function swipe(point: TimedPoint, handedness?: string) {
    if (mode === "mouse") cursor.current = point;
    const path = track.current.add(point, handedness);
    if (!path) return;
    const now = performance.now();
    trail.current = { points: path, born: now };
    const cut = cutAlongPath(game.current, path);
    if (!cut.length) return;
    for (const item of cut) {
      if (!reduceMotion || item.kind === "bomb")
        bursts.current.push({ item, born: now });
    }
    const bomb = cut.some((item) => item.kind === "bomb");
    const combo = game.current.combo;
    const kind = bomb ? "bomb" : combo >= 2 ? "combo" : "cut";
    setFeedback({ kind, count: combo, at: now });
    if (bomb) {
      bombEndsAt.current = now + BOMB_BLAST_MS;
      tone("game.fail");
    } else if (kind === "combo")
      tone("game.combo", { step: Math.min(combo, 8) });
    else tone("game.score");
    updateHud();
    if (game.current.lives === 0) finish();
  }

  const followHand = useEffectEvent((hand: HandSample) => {
    const { time, landmarks, handedness } = hand;
    const now = performance.now();
    if (currentPhase.current !== "playing") return;
    if (
      !hand.detected ||
      time === undefined ||
      now - time > HAND_TIMEOUT ||
      !landmarks[8]
    ) {
      if (handTarget.current) {
        // Break the collision path immediately, but keep the display stable through brief gaps.
        track.current.reset();
        handTarget.current = null;
      }
      return;
    }
    if (time <= lastHandTime.current) return;
    const gap = time - lastHandTime.current;
    lastHandTime.current = time;
    lastHandArrival.current = now;
    if (time < beginsAt.current) return;
    const tip = mirrored(landmarks[8]);
    // Leave room around the hand in the camera image while still reaching the board edges.
    const x = (tip.x - 0.08) / 0.84;
    const y = (tip.y - 0.08) / 0.84;
    const point = arenaPoint(x, y);
    if (
      !handTarget.current ||
      handTarget.current.handedness !== handedness ||
      gap > SLICE_SAMPLE_GAP_MS
    ) {
      cursor.current = point;
      trail.current = null;
    }
    handTarget.current = { point, handedness };
    swipe({ ...point, time }, handedness);
  });
  const { subscribeGameHand } = camera;
  useEffect(() => {
    if (directHandInput) return subscribeGameHand((hand) => followHand(hand));
  }, [directHandInput, subscribeGameHand]);

  const tick = useEffectEvent(
    (now: number, dt: number, ctx: CanvasRenderingContext2D) => {
      const activePhase = currentPhase.current;
      if (activePhase === "countdown") {
        remaining.current = Math.max(0, remaining.current - dt);
        if (remaining.current === 0) {
          setFeedback(null);
          transition("playing");
        } else {
          const nextBeat = countdownBeat(remaining.current);
          if (nextBeat !== beat) setBeat(nextBeat);
        }
      }
      if (activePhase === "playing") {
        const target = handTarget.current?.point;
        const hadRecentHand =
          now - lastHandArrival.current <=
          (target ? HAND_TIMEOUT : HAND_GAP_GRACE);
        const lost = mode === "hand" && !hadRecentHand;
        if (lost !== trackingLost) {
          setTrackingLost(lost);
          if (lost) resetStroke();
        }
        if (!lost) {
          // Ease only the rendered cursor. Scoring still uses the unsmoothed camera samples.
          if (mode === "hand" && target && cursor.current) {
            const distance = Math.hypot(
              target.x - cursor.current.x,
              target.y - cursor.current.y,
            );
            cursor.current =
              distance < 0.08
                ? target
                : smoothPoint(
                    cursor.current,
                    target,
                    dt,
                    distance > 60 ? 15 : 33,
                  );
          }
          const combo = game.current.combo;
          advanceSlice(game.current, dt / 1000);
          if (combo !== game.current.combo) updateHud();
          const nextSeconds = Math.ceil(SLICE_SECONDS - game.current.elapsed);
          if (nextSeconds !== seconds) setSeconds(nextSeconds);
          if (game.current.elapsed >= SLICE_SECONDS) finish();
        }
      }
      if (activePhase === "ending" && now >= bombEndsAt.current) {
        const result = pendingResult.current;
        pendingResult.current = null;
        transition("finished");
        navigate("/result/slice", { state: { result } });
        return;
      }
      if (feedback && now - feedback.at >= 530) setFeedback(null);
      if (bursts.current.length)
        bursts.current = bursts.current.filter(
          ({ item, born }) => now - born < sliceBurstDuration(item.kind),
        );
      drawSlice(
        ctx,
        game.current.items,
        cursor.current,
        trail.current,
        bursts.current,
        now,
        reduceMotion,
      );
    },
  );
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !animating) return;
    const context = ctx;
    let last = performance.now();
    let frame = requestAnimationFrame(function loop(now) {
      tick(now, Math.max(0, Math.min(80, now - last)), context);
      last = now;
      if (animates(currentPhase.current)) frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [animating]);

  const pauseForMenu = useEffectEvent(() => pause());
  useEffect(() => {
    const onPause = () => pauseForMenu();
    const onVisibility = () => {
      if (document.hidden) pauseForMenu();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") pauseForMenu();
    };
    window.addEventListener("arcade:pause", onPause);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("arcade:pause", onPause);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function pointerPoint(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      ...arenaPoint(
        (event.clientX - rect.left) / rect.width,
        (event.clientY - rect.top) / rect.height,
      ),
      time: performance.now(),
    };
  }

  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (
      currentPhase.current !== "playing" ||
      mode !== "mouse" ||
      !event.isPrimary ||
      event.button !== 0
    )
      return;
    resetStroke();
    if (event.pointerType !== "mouse") {
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    swipe(pointerPoint(event));
  }

  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (
      currentPhase.current !== "playing" ||
      mode !== "mouse" ||
      !event.isPrimary
    )
      return;
    if (event.pointerType !== "mouse" && pointer.current !== event.pointerId)
      return;
    swipe(pointerPoint(event));
  }

  function endPointer(event: PointerEvent<HTMLCanvasElement>) {
    if (mode !== "mouse") return;
    if (event.pointerType !== "mouse" && pointer.current !== event.pointerId)
      return;
    pointer.current = null;
    resetStroke();
  }

  const pointerLabel = t(compactTouch ? "touchMode" : "mouseMode");
  const instruction = t(
    mode === "hand" ? "sliceHand" : compactTouch ? "sliceTouch" : "sliceMouse",
  );
  const cameraHint = cameraProblem
    ? `camera_${camera.state}`
    : connecting
      ? "permissionHint"
      : visionProblem
        ? "visionError"
        : camera.vision === "loading"
          ? "visionLoading"
          : canPlay
            ? "handDetected"
            : "showHand";
  const inputControls = (
    <>
      <div
        className="cham-mode slice-mode"
        role="group"
        aria-label={t("controls")}
      >
        <button
          className={mode === "mouse" ? "active" : ""}
          aria-pressed={mode === "mouse"}
          onClick={() => setMode("mouse")}
        >
          <MousePointer2 aria-hidden="true" />
          {pointerLabel}
        </button>
        <button
          className={mode === "hand" ? "active" : ""}
          aria-pressed={mode === "hand"}
          disabled={connecting}
          onClick={selectCamera}
        >
          <Camera aria-hidden="true" />
          {t(
            mode === "hand" && (cameraProblem || visionProblem)
              ? "cameraRetry"
              : "camera",
          )}
        </button>
      </div>
      {mode === "hand" && <small role="status">{t(cameraHint)}</small>}
    </>
  );

  return (
    <div className="cham-page slice-page">
      <div className="cham-toolbar">
        <Link to="/games">
          <ArrowLeft aria-hidden="true" />
          {t("back")}
        </Link>
        <GameTimer seconds={seconds} duration={SLICE_SECONDS} />
        <button
          aria-label={t(phase === "paused" ? "resume" : "pause")}
          onClick={phase === "paused" ? resume : pause}
          disabled={
            phase === "ready" ||
            phase === "ending" ||
            phase === "finished" ||
            (phase === "paused" && !canPlay)
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
            <h3>
              <Zap aria-hidden="true" />
              {t("combo")}
            </h3>
            <strong>×{hud.combo}</strong>
          </section>
          <section className="hud-panel lime">
            <h3>{t("life")}</h3>
            <div
              className="slice-lives"
              aria-label={`${hud.lives} / ${SLICE_LIVES}`}
            >
              {Array.from({ length: SLICE_LIVES }, (_, i) => (
                <Heart key={i} aria-hidden="true" data-filled={i < hud.lives} />
              ))}
            </div>
          </section>
        </aside>
        <section
          className="cham-stage slice-stage"
          aria-label={t("sliceField")}
          data-phase={phase}
        >
          <div className="slice-board">
            <canvas
              ref={canvas}
              width={SLICE_WIDTH}
              height={SLICE_HEIGHT}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={endPointer}
              onPointerLeave={endPointer}
              onPointerCancel={endPointer}
              onLostPointerCapture={endPointer}
              aria-label={t("sliceField")}
            />
            {phase === "playing" && trackingLost && (
              <p className="slice-tracking" role="status">
                {t("sliceTracking")}
              </p>
            )}
            {(phase === "ending" || (phase === "playing" && !trackingLost)) &&
              feedback && (
                <strong
                  key={feedback.at}
                  className={`slice-feedback ${feedback.kind}`}
                >
                  {t(
                    feedback.kind === "bomb"
                      ? "sliceOuch"
                      : feedback.kind === "combo"
                        ? "sliceCombo"
                        : "slice",
                    { count: feedback.count },
                  )}
                </strong>
              )}
          </div>
          {phase === "ready" && (
            <PreGameSequence
              title={t("slice")}
              instruction={instruction}
              area={t("sliceRules")}
              character="slice"
              ready={canPlay}
              onStart={start}
              handClick={mode === "hand"}
            >
              {inputControls}
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
                {inputControls}
                <button
                  className="arcade-button pink"
                  onClick={resume}
                  disabled={!canPlay}
                  data-hand-click="true"
                >
                  {t("resume")}
                </button>
                <Link to="/games">{t("quit")}</Link>
              </section>
            </div>
          )}
        </section>
        <aside className="cham-info">
          <h1>{t("slice")}</h1>
          <p>{instruction}</p>
          <p>{t("sliceRules")}</p>
          <WebcamFrame compact showHandLandmarks={!directHandInput} />
        </aside>
      </div>
      {mode === "hand" && (phase === "ready" || phase === "paused") && (
        <HandMenuCursor active />
      )}
    </div>
  );
}

export function SliceResultPage({ tone }: { tone: PlaySound }) {
  const { t } = useTranslation();
  const location = useLocation();
  const last = readRuns()
    .reverse()
    .find((run) => run.game === "slice");
  const result: SliceResult | undefined =
    location.state?.result ??
    (last && {
      score: last.score,
      sliced: last.details?.hits ?? 0,
      combo: last.details?.maxCombo ?? 0,
      cleared: (last.details?.misses ?? 0) < SLICE_LIVES,
      newBest: false,
      saved: true,
    });
  if (!result)
    return (
      <div className="empty-state panel">
        <h1>{t("resultEmpty")}</h1>
        <Link className="arcade-button pink" to="/play/slice">
          {t("playNow")}
        </Link>
      </div>
    );
  return (
    <GameResult
      game="slice"
      heading={result.cleared ? undefined : t("sliceFinished")}
      score={result.score}
      best={Math.max(localBest("slice"), result.score)}
      newBest={result.newBest}
      saved={result.saved}
      replay="/play/slice"
      tone={tone}
      achievements={false}
      stats={[
        { label: t("sliceCutCount"), value: result.sliced },
        { label: t("combo"), value: result.combo },
      ]}
    />
  );
}
