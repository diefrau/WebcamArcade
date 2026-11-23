import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CircleHelp,
  Crown,
  Dice5,
  Hand,
  Heart,
  MousePointer2,
  Pause,
  Play,
  Save,
  Star,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { Button, Sticker } from "../components/ArcadePrimitives";
import { useInputEnvironment } from "../components/InputEnvironment";
import { useGameInput } from "../vision/useGameInput";
import { useCamera } from "../vision/CameraProvider";
import { WebcamFrame } from "../components/WebcamFrame";
import { HandMenuCursor } from "../components/HandMenuCursor";
import { InputCoach } from "../components/InputCoach";
import { GameResult } from "../components/GameResult";
import { GameTimer } from "../components/GameTimer";
import { RangeScenery } from "../components/ComicArt";
import { shootTargets } from "../assets/characters/shootTargets";
import { imageHitTest } from "./imageHitTest";
import { localBest } from "../community/store";
import type { PlaySound } from "../audio/useGameSound";
import type {
  ShootRecords as Records,
  ShootResult as Result,
} from "./shootRecords";

type TargetData = { x: number; y: number; kind: 0 | 1 | 2; id: number };
type ShotFeedback = { kind: "hit"; targetId: number } | { kind: "miss" };
const initialTargets: TargetData[] = [
  { x: 23, y: 57, kind: 0, id: 1 },
  { x: 50, y: 40, kind: 1, id: 2 },
  { x: 77, y: 58, kind: 2, id: 3 },
];
function TargetCharacter({
  kind,
  hit,
}: {
  kind: TargetData["kind"];
  hit: boolean;
}) {
  const sprite = shootTargets[kind];
  return (
    <>
      <img src={sprite.idle} alt="" draggable={false} hidden={hit} />
      <img src={sprite.hit} alt="" draggable={false} hidden={!hit} />
    </>
  );
}
export function ShootGamePage({
  onFinish,
  tone,
  records,
}: {
  onFinish: (r: Result) => void;
  tone: PlaySound;
  records: Records;
}) {
  const { compactTouch } = useInputEnvironment();
  const { t } = useTranslation();
  const camera = useCamera();
  const [inputMode, setInputMode] = useGameInput();
  const [handPaused, setHandPaused] = useState(false);
  const consumedShot = useRef(camera.shotSequence);
  const canResume =
    inputMode === "mouse" ||
    (camera.hand.detected &&
      camera.state === "ready" &&
      camera.vision === "ready");
  const canResumeRef = useRef(canResume);
  canResumeRef.current = canResume;
  const [phase, setPhase] = useState<"ready" | "playing" | "paused">("ready");
  const previousPhase = useRef(phase);
  useEffect(() => {
    if (previousPhase.current === "playing" && phase === "paused")
      tone("pause");
    if (previousPhase.current === "paused" && phase === "playing")
      tone("resume");
    previousPhase.current = phase;
  }, [phase, tone]);
  const requestedMode = new URLSearchParams(useLocation().search).get("mode");
  const [wave, setWave] = useState(requestedMode === "wave");
  const [endless, setEndless] = useState(requestedMode === "endless");
  const shootMode = endless ? "endless" : wave ? "wave" : "standard";
  const [time, setTime] = useState(endless ? 0 : 30);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(5);
  const [targets, setTargets] = useState(initialTargets);
  const [feedback, setFeedback] = useState<ShotFeedback | null>(null);
  const [cursor, setCursor] = useState({ x: 50, y: 50 });
  const stats = useRef({
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    shots: 0,
    lives: 5,
  });
  const elapsed = useRef(0);
  const targetBirth = useRef(new Map<number, number>());
  const fastestHit = useRef(Infinity);
  const lastTime = useRef(0);
  const finished = useRef(false);
  const field = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const finishRef = useRef(() => {});
  const shotRef = useRef<(id?: number) => void>(() => {});
  useEffect(() => {
    if (inputMode === "hand" && camera.hand.detected) {
      setCursor({ x: camera.hand.x * 100, y: camera.hand.y * 100 });
    }
    if (consumedShot.current === camera.shotSequence) return;
    consumedShot.current = camera.shotSequence;
    if (
      inputMode !== "hand" ||
      phase !== "playing" ||
      !camera.hand.detected ||
      document.hidden ||
      document.querySelector("dialog[open]")
    )
      return;
    const fieldRect = field.current?.getBoundingClientRect();
    if (!fieldRect) return;
    const x = fieldRect.left + camera.hand.x * fieldRect.width;
    const y = fieldRect.top + camera.hand.y * fieldRect.height;
    const target = Array.from(
      field.current!.querySelectorAll<HTMLButtonElement>("[data-target-id]"),
    ).find((element) => {
      const image =
        element.querySelector<HTMLImageElement>("img:not([hidden])");
      return image ? imageHitTest(image, x, y) : false;
    });
    shotRef.current(target ? Number(target.dataset.targetId) : undefined);
  }, [camera.hand, camera.shotSequence, inputMode, phase]);
  useEffect(() => {
    if (
      inputMode !== "hand" ||
      phase !== "playing" ||
      (camera.hand.detected &&
        camera.state === "ready" &&
        camera.vision === "ready")
    )
      return;
    const timer = setTimeout(() => {
      setHandPaused(true);
      setPhase("paused");
    }, 800);
    return () => clearTimeout(timer);
  }, [inputMode, phase, camera.hand.detected, camera.state, camera.vision]);
  finishRef.current = () => {
    if (finished.current) return;
    finished.current = true;
    const s = stats.current;
    onFinish({
      score: s.score,
      combo: s.maxCombo,
      hits: s.hits,
      shots: s.shots,
      accuracy: s.shots ? Math.round((s.hits / s.shots) * 100) : 0,
      newBest: s.score > localBest("shoot", shootMode),
      evidence: {
        inputMode,
        gameMode: shootMode,
        shots: s.shots,
        hits: s.hits,
        misses: s.shots - s.hits,
        maxCombo: s.maxCombo,
        fastestSuccessMs: Number.isFinite(fastestHit.current)
          ? fastestHit.current
          : undefined,
        duration: Math.min(
          endless ? 31536000 : 30,
          (elapsed.current +
            (lastTime.current && phase === "playing"
              ? Math.max(0, performance.now() - lastTime.current)
              : 0)) /
            1000,
        ),
        newBest: s.score > localBest("shoot", shootMode),
        metadata: {
          passed: wave
            ? s.hits === 12
            : s.hits > 0 &&
              s.shots === s.hits &&
              s.lives > 0 &&
              elapsed.current >= 30000,
        },
      },
    });
    navigate("/result/shoot", { replace: true });
  };
  useEffect(() => {
    if (phase !== "playing") return;
    lastTime.current = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      elapsed.current += now - lastTime.current;
      lastTime.current = now;
      setTime(
        endless
          ? Math.floor(elapsed.current / 1000)
          : Math.max(0, Math.ceil(30 - elapsed.current / 1000)),
      );
      if (!endless && elapsed.current >= 30000) finishRef.current();
    }, 50);
    return () => clearInterval(timer);
  }, [phase, endless]);
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 550);
    return () => clearTimeout(timer);
  }, [feedback]);
  useEffect(() => {
    const handle = () => {
      if (document.hidden) setPhase((p) => (p === "playing" ? "paused" : p));
    };
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]"))
        setPhase((p) =>
          p === "playing"
            ? "paused"
            : p === "paused" && canResumeRef.current
              ? "playing"
              : p,
        );
    };
    const pause = () => setPhase((p) => (p === "playing" ? "paused" : p));
    window.addEventListener("arcade:pause", pause);
    document.addEventListener("visibilitychange", handle);
    window.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("visibilitychange", handle);
      window.removeEventListener("keydown", keys);
      window.removeEventListener("arcade:pause", pause);
    };
  }, []);
  function shot(id?: number) {
    if (phase !== "playing" || finished.current) return;
    tone("shoot.fire");
    const s = stats.current;
    s.shots++;
    if (id !== undefined) {
      const now =
        elapsed.current +
        (lastTime.current
          ? Math.max(0, performance.now() - lastTime.current)
          : 0);
      fastestHit.current = Math.min(
        fastestHit.current,
        Math.max(0, now - (targetBirth.current.get(id) ?? 0)),
      );
      targetBirth.current.set(id, now);
      s.hits++;
      s.combo++;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      s.score = Math.min(
        2147483647,
        s.score + 100 + Math.min(s.combo - 1, 10) * 20,
      );
      setScore(s.score);
      setCombo(s.combo);
      setFeedback({ kind: "hit", targetId: id });
      tone("shoot.hit");
      if (wave && s.hits >= 12) {
        finishRef.current();
        return;
      }
      if (s.combo > 1) tone("game.combo", { step: Math.min(4, s.combo - 2) });
      setTargets((prev) =>
        prev.map((target) =>
          target.id === id
            ? {
                ...target,
                x: target.kind * 29 + 15 + Math.random() * 12,
                y: 32 + Math.random() * 34,
              }
            : target,
        ),
      );
    } else {
      s.combo = 0;
      s.lives--;
      setCombo(0);
      setLives(s.lives);
      setFeedback({ kind: "miss" });
      tone("shoot.miss");
      if (s.lives <= 0) finishRef.current();
    }
  }
  shotRef.current = shot;
  return (
    <>
      <div className="play-top">
        <Link to="/games" className="back-link">
          ← {t("back")}
        </Link>
        <GameTimer seconds={time} duration={endless ? undefined : 30} />
        <Button
          color="white"
          onClick={() =>
            setPhase((p) =>
              p === "playing" ? "paused" : p === "paused" ? "playing" : p,
            )
          }
          disabled={phase === "ready" || (phase === "paused" && !canResume)}
          aria-label={t("pause")}
        >
          <Pause />
        </Button>
      </div>
      <div
        className="input-mode-switch"
        role="group"
        aria-label={t("controls")}
      >
        <button
          className={inputMode === "mouse" ? "active" : ""}
          onClick={() => {
            setInputMode("mouse");
            setHandPaused(false);
          }}
        >
          <MousePointer2 />
          {t(compactTouch ? "touchMode" : "mouseMode")}
        </button>
        <button
          className={inputMode === "hand" ? "active" : ""}
          data-sound={!camera.stream ? "none" : undefined}
          onClick={() => {
            setInputMode("hand");
            if (!camera.stream) void camera.connect();
          }}
        >
          <Hand />
          {t("handMode")}
        </button>
        <span>
          {t(
            inputMode === "hand"
              ? "handHelp"
              : compactTouch
                ? "touchAim"
                : "aim",
          )}
        </span>
      </div>
      <div className="play-layout">
        <aside className="hud">
          {[
            {
              key: "score",
              value: score.toLocaleString(),
              color: "pink",
              icon: <Star />,
            },
            { key: "combo", value: `× ${combo}`, color: "cyan", icon: <Zap /> },
            {
              key: "life",
              value: (
                <span className="hearts">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Heart
                      key={i}
                      fill={i < lives ? "var(--pink)" : "#aaa"}
                      size={25}
                    />
                  ))}
                </span>
              ),
              color: "lime",
              icon: null,
            },
            {
              key: wave ? "waveMode" : "round",
              value: wave ? `${stats.current.hits} / 12` : "1 / 1",
              color: "purple",
              icon: null,
            },
          ].map((s) => (
            <section className={`hud-panel ${s.color}`} key={s.key}>
              <h3>{t(s.key)}</h3>
              <strong>
                {s.icon}
                {s.value}
              </strong>
            </section>
          ))}
        </aside>
        <div
          className="playfield"
          ref={field}
          onPointerMove={(e) => {
            if (inputMode === "hand") return;
            const r = field.current!.getBoundingClientRect();
            setCursor({
              x: ((e.clientX - r.left) / r.width) * 100,
              y: ((e.clientY - r.top) / r.height) * 100,
            });
          }}
          onClick={() => {
            if (inputMode === "mouse") shot();
          }}
        >
          <RangeScenery />
          <div className="sun" />
          <div className="cloud cloud-one" />
          <div className="cloud cloud-two" />
          <div className="hills" />
          <div className="bunting">
            {["pink", "yellow", "cyan", "pink", "yellow", "cyan"].map(
              (c, i) => (
                <span className={c} key={i} />
              ),
            )}
          </div>
          <h1
            key={`${feedback?.kind}-${score}-${lives}`}
            className={`game-command ${feedback ? "bounce-feedback" : ""} ${feedback?.kind === "miss" ? "pink-text" : "yellow-text"}`}
          >
            {t(feedback?.kind ?? "shootCommand")}
          </h1>
          <span className="wood-sign">
            HIT THE
            <br />
            TARGET! <Star fill="var(--yellow)" />
          </span>
          <div className="fence" />
          {targets.map((target) => (
            <button
              key={target.id}
              disabled={phase !== "playing"}
              data-testid={`target-${target.id}`}
              data-target-id={target.id}
              className="target-character"
              style={{ left: `${target.x}%`, top: `${target.y}%` }}
              aria-label={`${t("fire")} ${target.id}`}
              onClick={(e) => {
                e.stopPropagation();
                if (inputMode === "mouse") {
                  const image =
                    e.currentTarget.querySelector<HTMLImageElement>(
                      "img:not([hidden])",
                    );
                  // Keyboard activation uses the target's accessible button action.
                  const hit =
                    e.detail === 0 ||
                    (image && imageHitTest(image, e.clientX, e.clientY));
                  shot(hit ? target.id : undefined);
                }
              }}
            >
              <TargetCharacter
                kind={target.kind}
                hit={
                  feedback?.kind === "hit" && feedback.targetId === target.id
                }
              />
            </button>
          ))}
          <div className="range-counter" />
          {endless && (
            <Button
              color="white"
              className="shoot-finish-run"
              data-hand-click
              disabled={phase === "ready"}
              onClick={(e) => {
                e.stopPropagation();
                finishRef.current();
              }}
            >
              <Save aria-hidden="true" size={20} />
              {t("finishRun")}
            </Button>
          )}
          <div
            className={`crosshair ${inputMode === "hand" && camera.hand.detected ? "hand-active" : ""} ${camera.hand.pinched ? "pinched" : ""}`}
            style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
          >
            <Target size={55} />
          </div>
          {phase !== "playing" && (
            <div className="game-overlay" onClick={(e) => e.stopPropagation()}>
              <HandMenuCursor active />
              <div className="game-dialog panel">
                <Sticker>{phase === "ready" ? "READY?" : "PAUSE"}</Sticker>
                <h2>
                  {t(phase === "ready" ? "readyGame" : "paused")}
                  <small className="selected-game-mode">
                    {t("gameMode")} ·{" "}
                    {t(
                      endless
                        ? "endlessMode"
                        : wave
                          ? "waveMode"
                          : "standardMode",
                    )}
                  </small>
                </h2>
                {phase === "ready" && (
                  <div
                    className="game-mode-choice"
                    role="group"
                    aria-label={t("gameMode")}
                  >
                    <button
                      data-hand-click
                      aria-pressed={!wave && !endless}
                      className={!wave && !endless ? "active" : ""}
                      onClick={() => {
                        setWave(false);
                        setEndless(false);
                        setTime(30);
                      }}
                    >
                      {t("standardMode")}
                    </button>
                    <button
                      data-hand-click
                      aria-pressed={wave}
                      className={wave ? "active" : ""}
                      onClick={() => {
                        setWave(true);
                        setEndless(false);
                        setTime(30);
                      }}
                    >
                      {t("waveMode")}
                    </button>
                    <button
                      data-hand-click
                      aria-pressed={endless}
                      className={endless ? "active" : ""}
                      onClick={() => {
                        setWave(false);
                        setEndless(true);
                        setTime(0);
                      }}
                    >
                      {t("endlessMode")}
                    </button>
                  </div>
                )}
                <p>
                  {t(
                    phase === "ready" && endless
                      ? "endlessHint"
                      : phase === "ready" && wave
                        ? "waveDesc"
                        : handPaused
                          ? "handPaused"
                          : inputMode === "hand"
                            ? "handHelp"
                            : "readyDesc",
                  )}
                </p>
                <small>{t("readyDetail")}</small>
                {phase === "ready" && (
                  <InputCoach
                    game="shoot"
                    cameraMode={inputMode === "hand"}
                    onModeChange={(value) =>
                      setInputMode(value ? "hand" : "mouse")
                    }
                  />
                )}
                <Button
                  data-hand-click
                  disabled={
                    inputMode === "hand" &&
                    (!camera.hand.detected ||
                      camera.vision !== "ready" ||
                      camera.state !== "ready")
                  }
                  onClick={() => {
                    setHandPaused(false);
                    consumedShot.current = camera.shotSequence;
                    setPhase("playing");
                    if (phase === "ready") tone("start");
                  }}
                >
                  <Play />
                  {t(phase === "ready" ? "go" : "resume")}
                </Button>
                {inputMode === "hand" && !camera.hand.detected && (
                  <small>{t("handReady")}</small>
                )}
                {inputMode === "hand" && (
                  <button
                    className="mouse-fallback"
                    onClick={() => {
                      setInputMode("mouse");
                      setHandPaused(false);
                    }}
                  >
                    {t(compactTouch ? "touchMode" : "switchMouse")}
                  </button>
                )}
                {phase === "paused" && <Link to="/games">{t("quit")}</Link>}
              </div>
            </div>
          )}
        </div>
        <aside className="play-side">
          <WebcamFrame compact />
          <h1>{t("shoot")}</h1>
          <section className="panel instructions">
            <h2>{t("controls")}</h2>
            <div>
              <MousePointer2 />
              <Target />
            </div>
            <p>
              {t(
                inputMode === "hand"
                  ? "handAim"
                  : compactTouch
                    ? "touchAim"
                    : "aim",
              )}
            </p>
            <p>
              {t(
                inputMode === "hand"
                  ? "handFire"
                  : compactTouch
                    ? "touchFire"
                    : "fire",
              )}
            </p>
            <span className="small-sticker">
              {inputMode === "hand"
                ? "PINCH & POP!"
                : compactTouch
                  ? "TAP & POP!"
                  : "CLICK & POP!"}
            </span>
          </section>
        </aside>
      </div>
      <div className="play-hint panel">
        <CircleHelp />
        <strong>{t("hint")}</strong>
        <span>✦</span>
      </div>
    </>
  );
}
export function ShootResultPage({
  records,
  tone,
  randomGames,
}: {
  records: Records;
  tone: PlaySound;
  randomGames: string[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const r = records.last;
  if (!r)
    return (
      <div className="empty-state panel">
        <Trophy size={64} />
        <h1>{t("resultEmpty")}</h1>
        <p>{t("resultEmptySub")}</p>
        <Button onClick={() => navigate("/play/shoot")}>{t("start")}</Button>
      </div>
    );
  return (
    <GameResult
      game="shoot"
      score={r.score}
      best={localBest("shoot", r.evidence?.gameMode ?? "standard")}
      stats={[
        { label: t("combo"), value: r.combo },
        { label: t("accuracy"), value: r.accuracy, unit: "%" },
      ]}
      newBest={r.newBest}
      tone={tone}
      replay={`/play/shoot?mode=${r.evidence?.gameMode ?? "standard"}`}
      camera={<WebcamFrame compact />}
      extraAction={
        <Button
          color="purple"
          onClick={() =>
            navigate(
              `/play/${randomGames[Math.floor(Math.random() * randomGames.length)]}`,
            )
          }
        >
          <Dice5 />
          {t("random")}
        </Button>
      }
    >
      <div className="result-badges">
        {[
          ...(r.accuracy >= 80 && r.hits > 0
            ? [{ key: "badgeAim", icon: Target, color: "cyan" }]
            : []),
          ...(r.combo >= 5
            ? [{ key: "badgeCombo", icon: Zap, color: "pink" }]
            : []),
          { key: "badgeTry", icon: Crown, color: "orange" },
        ].map(({ key, icon: Icon, color }) => (
          <div className={color} key={key}>
            <Icon />
            <strong>{t(key)}</strong>
            <small>{t(`${key}Desc`)}</small>
          </div>
        ))}
      </div>
    </GameResult>
  );
}
