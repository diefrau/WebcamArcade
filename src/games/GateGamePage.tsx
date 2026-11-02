import { useEffect, useId, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw, Trophy } from "lucide-react";
import { useGatePose } from "../input/useGatePose";
import { WebcamFrame } from "../components/WebcamFrame";
import { upperBodyIds } from "../vision/shared/poseNormalization";
import { PreGameSequence } from "../components/PreGameSequence";
import { Character } from "../components/Character";
import { ResultCelebration } from "../components/ResultCelebration";
import type { PlaySound } from "../audio/useGameSound";
import { useGameSound } from "../audio/useGameSound";
import { adaptGameInput } from "../input/GameInputAdapter";
import { mockPose, mockVision, gateTargets } from "../input/mockPose";
import { poseSimilarity } from "../vision/shared/poseNormalization";
import {
  advanceGate,
  newGate,
  gateScore,
  GATE_APPROACH,
  type GateState,
  type GateOutcome,
} from "./gateRules";
import type { PosePoint } from "../vision/visionTypes";
import "./gate.css";
export type GateResult = {
  source?: "mock" | "vision";
  score: number;
  outcomes: GateOutcome[];
  newBest: boolean;
  saved: boolean;
};
export function readGate(source: "mock" | "vision" = "mock") {
  try {
    const v = JSON.parse(
      localStorage.getItem(
        source === "vision" ? "arcade.gate.vision" : "arcade.gate.prototype",
      ) || "null",
    );
    if (!v || !Number.isInteger(v.best) || v.best < 0 || v.best > 1500)
      return { best: 0, last: null };
    const r = v.last;
    return {
      best: v.best,
      last:
        r &&
        Array.isArray(r.outcomes) &&
        r.outcomes.length === 5 &&
        r.outcomes.every(
          (x: GateOutcome) =>
            x &&
            ["perfect", "pass", "close", "fail"].includes(x.grade) &&
            Number.isFinite(x.similarity) &&
            x.similarity >= 0 &&
            x.similarity <= 100 &&
            [0, 150, 300].includes(x.points),
        ) &&
        gateScore(r) === r.score
          ? (r as GateResult)
          : null,
    };
  } catch {
    return { best: 0, last: null };
  }
}
function PoseDrawing({
  points,
  color = "var(--pink)",
  hole = false,
}: {
  points: PosePoint[];
  color?: string;
  hole?: boolean;
}) {
  const path = (ids: number[]) =>
    ids
      .map(
        (id, i) =>
          `${i ? "L" : "M"}${500 + (points[id].x - 0.5) * 600},${points[id].y * 600}`,
      )
      .join(" ");
  return (
    <g fill={color} stroke={color} strokeLinecap="round" strokeLinejoin="round">
      <circle
        cx={500 + (points[0].x - 0.5) * 600}
        cy={points[0].y * 600}
        r={hole ? 41 : 31}
      />
      <path
        d={path([15, 13, 11, 12, 14, 16])}
        fill="none"
        strokeWidth={hole ? 68 : 24}
      />
      <path
        d="M410 270 L500 380 L590 270 M500 300 L500 420 M500 420 L420 520 M500 420 L580 520"
        fill="none"
        strokeWidth={hole ? 80 : 28}
      />
    </g>
  );
}
export function GateGamePage({ tone }: { tone: PlaySound }) {
  const { t } = useTranslation(),
    navigate = useNavigate(),
    mask = useId();
  const [params, setParams] = useSearchParams();
  const source = params.get("input") === "mock" ? "mock" : "vision";
  const pose = useGatePose(source === "vision");
  const lostAt = useRef<number | null>(null);
  const pauseReason = useRef<"manual" | "tracking">("manual");
  const recoveryHold = useRef(0);
  const loweredArms = useRef(false);
  const [phase, setPhase] = useState<"ready" | "countdown" | "playing">(
      "ready",
    ),
    phaseRef = useRef(phase);
  const [paused, setPaused] = useState(false),
    pausedRef = useRef(false),
    finished = useRef(false);
  const [beat, setBeat] = useState(3),
    count = useRef(3);
  const [state, setState] = useState(newGate),
    game = useRef(state);
  const [angles, setAngles] = useState({ left: -60, right: -60 });
  const mockInput = adaptGameInput(
    mockVision(angles.left, angles.right),
    "mock",
  );
  const input = source === "mock" ? mockInput : pose.input;
  const canPlay = source === "mock" || pose.ready;
  const readyRef = useRef(canPlay);
  readyRef.current = canPlay;
  const displayPose = mockPose(angles.left, angles.right);
  if (source === "vision" && input.poseVector)
    upperBodyIds.forEach((id, i) => {
      displayPose[id] = {
        x: 0.5 + input.poseVector![i].x * 0.3,
        y: 0.45 + input.poseVector![i].y * 0.3,
        visibility: 1,
      };
    });
  useEffect(() => {
    game.current = newGate();
    setState(game.current);
    phaseRef.current = "ready";
    setPhase("ready");
    pausedRef.current = false;
    setPaused(false);
    finished.current = false;
    lostAt.current = null;
    recoveryHold.current = 0;
    loweredArms.current = false;
    pauseReason.current = "manual";
  }, [source]);
  const inputRef = useRef(input);
  inputRef.current = input;
  const mockModeRef = useRef(source === "mock");
  mockModeRef.current = source === "mock";
  const tick = useRef((_dt: number) => {}),
    pauseRef = useRef(() => {});
  useGameSound(phase, beat, state.round, tone);
  const target = gateTargets[state.round] ?? gateTargets[0],
    targetInput = adaptGameInput(mockVision(target.left, target.right), "mock");
  const similarity =
    poseSimilarity(input.poseVector, targetInput.poseVector) ?? 0;
  function pause(reason: "manual" | "tracking" = "manual") {
    if (phaseRef.current === "ready" || finished.current) return;
    pauseReason.current = reason;
    recoveryHold.current = 0;
    loweredArms.current = false;
    if (pausedRef.current) return;
    pausedRef.current = true;
    setPaused(true);
    tone("pause");
  }
  pauseRef.current = pause;
  function start() {
    if (!canPlay) return;
    count.current = 3;
    setBeat(3);
    phaseRef.current = "countdown";
    setPhase("countdown");
    tone("game.ready");
  }
  tick.current = (dt) => {
    if (finished.current) return;
    if (document.hidden || document.querySelector("dialog[open]")) {
      recoveryHold.current = 0;
      if (phaseRef.current !== "ready") pause();
      return;
    }
    if (source === "vision") {
      const fresh =
        readyRef.current &&
        inputRef.current.poseVector &&
        performance.now() - inputRef.current.timestamp < 900;
      if (phaseRef.current === "ready") {
        if (fresh && document.hasFocus()) start();
        return;
      }
      if (pausedRef.current) {
        const p = inputRef.current.poseVector;
        if (fresh && p && p[5].y - p[1].y > 0.15 && p[6].y - p[2].y > 0.15)
          loweredArms.current = true;
        const intent =
          pauseReason.current === "tracking" ||
          (loweredArms.current &&
            p &&
            p[5].y - p[1].y < -0.15 &&
            p[6].y - p[2].y < -0.15);
        recoveryHold.current =
          fresh && intent && document.hasFocus()
            ? recoveryHold.current + dt
            : 0;
        if (recoveryHold.current >= 1) {
          pausedRef.current = false;
          setPaused(false);
          lostAt.current = null;
          recoveryHold.current = 0;
          loweredArms.current = false;
          count.current = 3;
          setBeat(3);
          phaseRef.current = "countdown";
          setPhase("countdown");
          tone("resume");
        }
        return;
      }
      if (!fresh) {
        lostAt.current ??= performance.now();
        if (
          performance.now() - lostAt.current >= 800 ||
          (game.current.phase === "approach" &&
            game.current.elapsed + dt >= GATE_APPROACH)
        ) {
          pause("tracking");
          return;
        }
        inputRef.current = { ...inputRef.current, poseVector: null };
      } else lostAt.current = null;
    }
    if (phaseRef.current === "ready" || pausedRef.current) return;
    if (phaseRef.current === "countdown") {
      count.current = Math.max(0, count.current - dt);
      setBeat(Math.ceil(count.current));
      if (count.current === 0) {
        phaseRef.current = "playing";
        setPhase("playing");
      }
      return;
    }
    const next = advanceGate(game.current, dt, inputRef.current);
    if (next.outcomes.length > game.current.outcomes.length)
      tone(next.outcomes.at(-1)!.points > 0 ? "success" : "fail");
    game.current = next;
    setState(next);
    if (next.phase === "finished") {
      finished.current = true;
      const previous = readGate(source),
        score = gateScore(next),
        result: GateResult = {
          source,
          score,
          outcomes: next.outcomes,
          newBest: score > previous.best,
          saved: true,
        };
      try {
        localStorage.setItem(
          source === "vision" ? "arcade.gate.vision" : "arcade.gate.prototype",
          JSON.stringify({
            best: Math.max(previous.best, score),
            last: result,
          }),
        );
      } catch {
        result.saved = false;
      }
      navigate(`/result/gate?input=${source}`, {
        replace: true,
        state: result,
      });
    }
  };
  useEffect(() => {
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      tick.current(Math.min(0.25, (now - previous) / 1000));
      previous = now;
    }, 40);
    const pause = () => pauseRef.current();
    const hidden = () => {
      if (document.hidden) pause();
    };
    const key = (e: KeyboardEvent) => {
      if (
        document.querySelector("dialog[open]") ||
        (e.target instanceof Element &&
          e.target.closest("input,textarea,select"))
      )
        return;
      if (e.key === "Escape") pause();
      if (!mockModeRef.current) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < gateTargets.length) {
        setAngles(gateTargets[i]);
        return;
      }
      const delta: Record<string, [string, number]> = {
        a: ["left", 10],
        z: ["left", -10],
        k: ["right", 10],
        m: ["right", -10],
      };
      const change = delta[e.key.toLowerCase()];
      if (change) {
        e.preventDefault();
        setAngles((v) => ({
          ...v,
          [change[0]]: Math.max(
            -60,
            Math.min(120, v[change[0] as "left" | "right"] + change[1]),
          ),
        }));
      }
    };
    window.addEventListener("keydown", key);
    window.addEventListener("blur", pause);
    window.addEventListener("arcade:pause", pause);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", pause);
      window.removeEventListener("arcade:pause", pause);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  const progress = Math.min(1, state.elapsed / GATE_APPROACH),
    last = state.outcomes.at(-1);
  return (
    <div className={`gate-page gate-${source}`}>
      <div className="cham-toolbar">
        <Link to="/games">← {t("back")}</Link>
        <strong>
          {t("round")} {state.round + 1} / 5
        </strong>
        <button
          disabled={phase === "ready" || (paused && !canPlay)}
          aria-label={t(paused ? "resume" : "pause")}
          onClick={() => {
            if (paused && canPlay) {
              pausedRef.current = false;
              setPaused(false);
              tone("resume");
            } else pause();
          }}
        >
          {paused ? <Play /> : <Pause />}
        </button>
      </div>
      <div className="game-mode-choice" role="group" aria-label={t("controls")}>
        {(["vision", "mock"] as const).map((value) => (
          <button
            key={value}
            disabled={phase !== "ready"}
            className={source === value ? "active" : ""}
            aria-pressed={source === value}
            onClick={() => setParams(value === "mock" ? { input: "mock" } : {})}
          >
            {t(value === "mock" ? "gate.mockMode" : "bodyMode")}
          </button>
        ))}
      </div>
      <div className="gate-layout">
        <aside className="gate-hud">
          <section className="hud-panel pink">
            <h3>{t("score")}</h3>
            <strong>{gateScore(state)}</strong>
          </section>
          <section className="hud-panel cyan">
            <h3>{t("gate.similarity")}</h3>
            <strong>{similarity}%</strong>
          </section>
          <div className="panel gate-demo">
            <Character asset="pose" size="sm" />
            <b>{t("gate.prototype")}</b>
            <p>
              {t(source === "mock" ? "gate.mockNotice" : "gate.visionNotice")}
            </p>
          </div>
        </aside>
        <section className="panel gate-stage">
          <div className="gate-caption">
            <h1>{t("gate.title")}</h1>
            <strong role="status">
              {phase === "countdown"
                ? beat
                : state.phase === "feedback" && last
                  ? t(`gate.${last.grade}`)
                  : t("gate.command")}
            </strong>
          </div>
          <svg
            className="gate-world"
            viewBox="0 0 1000 600"
            aria-label={t("gate.field")}
          >
            <defs>
              <mask id={mask}>
                <rect width="1000" height="600" fill="white" />
                <PoseDrawing
                  points={mockPose(target.left, target.right)}
                  color="black"
                  hole
                />
              </mask>
            </defs>
            <path d="M0 600 L500 220 L1000 600" fill="#a5e957" />
            {(source === "mock" || input.poseVector) && (
              <PoseDrawing points={displayPose} />
            )}
            <g
              className="gate-wall"
              style={{
                transform: `scale(${state.phase === "feedback" ? 1.1 : 0.35 + progress * 0.75})`,
              }}
            >
              <rect
                x="5"
                y="5"
                width="990"
                height="590"
                rx="24"
                fill="var(--cyan)"
                stroke="#111"
                strokeWidth="12"
                mask={`url(#${mask})`}
              />
              <text x="80" y="100" fontSize="46" fontWeight="900">
                {state.round + 1}
              </text>
            </g>
          </svg>
          <div className="gate-rounds">
            {gateTargets.map((_, i) => (
              <span key={i} className={state.outcomes[i] ? "settled" : ""}>
                {state.outcomes[i]
                  ? t(`gate.${state.outcomes[i].grade}`)
                  : i + 1}
              </span>
            ))}
          </div>
          {phase === "ready" && (
            <PreGameSequence
              title={t("gate.title")}
              character="pose"
              instruction={t("gate.instruction")}
              area={
                source === "mock"
                  ? t("gate.mockNotice")
                  : canPlay
                    ? t("gate.poseReady")
                    : pose.camera.stream
                      ? t("gate.showUpperBody", { progress: pose.progress })
                      : t("gate.connectHint")
              }
              ready={canPlay}
              autoStartLabel={
                source === "vision" ? t("gate.autoStart") : undefined
              }
              onStart={start}
            >
              {source === "vision" && !pose.camera.stream && (
                <button
                  className="arcade-button cyan"
                  disabled={
                    pose.camera.state === "requesting" ||
                    pose.camera.state === "connecting"
                  }
                  onClick={() => void pose.camera.connect()}
                >
                  {t("cameraConnect")}
                </button>
              )}
            </PreGameSequence>
          )}
          {paused && (
            <div className="game-overlay">
              <section className="panel game-dialog">
                <h2>{t("paused")}</h2>
                {source === "vision" && (
                  <p role="status">
                    {t(
                      pauseReason.current === "tracking"
                        ? "gate.autoResume"
                        : "gate.poseResume",
                    )}
                  </p>
                )}
                {source === "vision" && !canPlay && (
                  <p>{t("gate.showUpperBody", { progress: pose.progress })}</p>
                )}
                <button
                  className="arcade-button pink"
                  disabled={!canPlay}
                  onClick={() => {
                    pausedRef.current = false;
                    setPaused(false);
                    tone("resume");
                  }}
                >
                  {t("resume")}
                </button>
              </section>
            </div>
          )}
        </section>
        {source === "vision" ? (
          <aside className="panel gate-input">
            <h2>{t("bodyMode")}</h2>
            <WebcamFrame compact />
            <p role="status">
              {canPlay
                ? t("gate.poseReady")
                : t("gate.showUpperBody", { progress: pose.progress })}
            </p>
            <progress
              aria-label={t("gate.preparation")}
              max={100}
              value={pose.progress}
            />
            <p>{t("gate.poseHelp")}</p>
            <button
              className="arcade-button white"
              disabled={phase !== "ready" && !paused}
              onClick={pose.reset}
            >
              {t("gate.recalibrate")}
            </button>
          </aside>
        ) : (
          <aside className="panel gate-input">
            <h2>{t("gate.adjust")}</h2>
            <p>{t("gate.mockHelp")}</p>
            {(["left", "right"] as const).map((side) => (
              <label key={side}>
                {t(`gate.${side}`)}
                <input
                  type="range"
                  min="-60"
                  max="120"
                  step="5"
                  value={angles[side]}
                  onChange={(e) =>
                    setAngles((v) => ({ ...v, [side]: Number(e.target.value) }))
                  }
                />
                <output>{angles[side]}°</output>
              </label>
            ))}
            <div className="gate-presets">
              {gateTargets.map((pose, i) => (
                <button key={i} onClick={() => setAngles(pose)}>
                  {i + 1}. {t(`gate.pose${i}`)}
                </button>
              ))}
            </div>
            <p>{t("gate.keyboard")}</p>
          </aside>
        )}
      </div>
    </div>
  );
}
export function GateResultPage({ tone }: { tone: PlaySound }) {
  const { t } = useTranslation(),
    location = useLocation(),
    result =
      (location.state as GateResult | null) ??
      readGate(
        new URLSearchParams(location.search).get("input") === "vision"
          ? "vision"
          : "mock",
      ).last;
  if (!result)
    return (
      <section className="panel empty-state">
        <Trophy />
        <h1>{t("resultEmpty")}</h1>
        <Link to="/play/gate">{t("start")}</Link>
      </section>
    );
  return (
    <div className="gate-result">
      <h1 className="result-heading yellow-text">
        {t("gate.title")} · {t("clear")}
      </h1>
      <ResultCelebration
        score={result.score}
        newBest={result.newBest}
        onCelebrate={(best) => tone(best ? "newBest" : "result")}
      />
      <section className="panel gate-result-card">
        <Character asset="pose" size="sm" />
        <h2>
          {result.score.toLocaleString()} {t("points")}
        </h2>
        <p>{t("gate.prototype")}</p>
        <ol>
          {result.outcomes.map((r, i) => (
            <li key={i}>
              <b>
                {t("round")} {i + 1}
              </b>
              <span>{t(`gate.${r.grade}`)}</span>
              <span>
                {r.similarity}% · +{r.points}
              </span>
            </li>
          ))}
        </ol>
        {!result.saved && <p role="alert">{t("recordError")}</p>}
      </section>
      <div className="result-actions">
        <Link
          className="arcade-button pink"
          to={`/play/gate?input=${result.source ?? "mock"}`}
        >
          <RotateCcw />
          {t("replay")}
        </Link>
        <Link className="arcade-button cyan" to="/games">
          {t("next")}
        </Link>
      </div>
    </div>
  );
}
