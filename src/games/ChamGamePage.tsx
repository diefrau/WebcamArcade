import { useInputEnvironment } from "../components/InputEnvironment";
import { recordPlay } from "../community/client";
import { localBest } from "../community/store";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Camera, Keyboard, Pause, Play, Trophy } from "lucide-react";
import { useCamera } from "../vision/CameraProvider";
import { faceDirection, type Direction } from "../vision/face";
import { Character } from "../components/Character";
import { chamPoses, characterAssets } from "../assets/characters";
import { WebcamFrame } from "../components/WebcamFrame";
import "./cham.css";
import { winsRound } from "./chamRules";
import { GameResult } from "../components/GameResult";
import type { SoundCue } from "../audio/ArcadeAudio";
import { useGameSound } from "../audio/useGameSound";

export const directions: Direction[] = ["left", "up", "down", "right"];
const arrows = { left: "←", right: "→", up: "↑", down: "↓", center: "•" };
const COUNTDOWN_MS = 1500;
const RESPONSE_MS = 900;
const SEEKER_RESPONSE_MS = 1000;
const FEEDBACK_MS = 1000;
type Round = {
  computer: Direction;
  player: Direction | null;
  win: boolean;
  responseMs?: number;
};
export type ChamResult = {
  gameMode?: "standard" | "hard" | "seeker";
  score: number;
  wins: number;
  rounds: Round[];
  newBest: boolean;
  saved: boolean;
};
export function readCham(): {
  best: number;
  plays: number;
  last: ChamResult | null;
} {
  try {
    const value = JSON.parse(localStorage.getItem("arcade.cham") || "null");
    if (value && Number.isFinite(value.best) && Number.isFinite(value.plays))
      return value;
  } catch {
    /* Storage can be disabled. */
  }
  return { best: 0, plays: 0, last: null };
}
type Phase = "ready" | "countdown" | "respond" | "feedback" | "paused";

import { pointingDirection } from "../vision/pointingDirection";
import { HandMenuCursor } from "../components/HandMenuCursor";
import { InputCoach } from "../components/InputCoach";
export function ChamGamePage({
  onFinish,
  tone,
}: {
  onFinish: () => void;
  tone: (kind?: SoundCue) => void;
}) {
  const { t, i18n } = useTranslation();
  const ko = i18n.language.startsWith("ko");
  const text = (a: string, b: string) => (ko ? a : b);
  const camera = useCamera();
  const { compactTouch } = useInputEnvironment();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const seeker = params.get("role") === "seeker";
  const [choice, setChoice] = useState<"face" | "hand" | "buttons" | null>(
    null,
  );
  const mode =
    choice ?? (camera.stream ? (seeker ? "hand" : "face") : "buttons");
  useEffect(() => {
    if (camera.stream) setChoice((v) => v ?? (seeker ? "hand" : "face"));
  }, [camera.stream, seeker]);
  const [hard, setHard] = useState(false);
  const responseMs = seeker ? SEEKER_RESPONSE_MS : hard ? 540 : RESPONSE_MS;
  const resultMode = seeker ? "seeker" : hard ? "hard" : "standard";
  const [phase, setPhase] = useState<Phase>("ready");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [computer, setComputer] = useState<Direction>("left");
  const [remaining, setRemaining] = useState(COUNTDOWN_MS);
  useGameSound(phase, Math.ceil(remaining / 500), rounds.length, tone);
  const [neutral, setNeutral] = useState<{ x: number; y: number } | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationCount, setCalibrationCount] = useState(0);
  const calibration = useRef<{ x: number; y: number }[]>([]);
  const baseline = useRef<{ x: number; y: number } | null>(null);
  const candidate = useRef<{ direction: Direction | "center"; since: number }>({
    direction: "center",
    since: 0,
  });
  const centered = useRef(false);
  const faceLostAt = useRef<number | null>(null);
  const phaseRef = useRef<Phase>(phase);
  const remainingRef = useRef(COUNTDOWN_MS);
  const resumePhase = useRef<Phase>("countdown");
  const roundsRef = useRef<Round[]>([]);
  const complete = useRef(false);
  const tickRef = useRef<(delta: number) => void>(() => {});
  const inputRef = useRef<(direction: Direction) => void>(() => {});
  const canPlay =
    mode === "buttons" ||
    (camera.state === "ready" &&
      camera.vision === "ready" &&
      (mode === "hand"
        ? camera.hand.detected
        : camera.face.detected && neutral !== null));
  const direction = neutral ? faceDirection(camera.face, neutral) : "center";
  function beginCalibration() {
    calibration.current = [];
    baseline.current = null;
    setNeutral(null);
    setCalibrationCount(0);
    setCalibrating(true);
  }
  const label = (d: Direction | "center") =>
    ko
      ? {
          left: "왼쪽",
          right: "오른쪽",
          up: "위",
          down: "아래",
          center: "정면",
        }[d]
      : d;

  function transition(next: Phase, ms = remainingRef.current) {
    phaseRef.current = next;
    setPhase(next);
    remainingRef.current = ms;
    setRemaining(ms);
  }
  function pause() {
    if (!["countdown", "respond", "feedback"].includes(phaseRef.current))
      return;
    resumePhase.current = phaseRef.current;
    tone("pause");
    transition("paused");
  }
  function nextRound() {
    // Commit the seeker target before its visual tell; never reroll at GO.
    if (seeker)
      setComputer(directions[Math.floor(Math.random() * directions.length)]);
    centered.current = mode === "buttons";
    candidate.current = { direction: "center", since: 0 };
    transition("countdown", COUNTDOWN_MS);
  }
  function finish() {
    if (complete.current) return;
    complete.current = true;
    const previous = readCham(),
      played = roundsRef.current;
    const wins = played.filter((r) => r.win).length,
      score = wins * 100;
    const result: ChamResult = {
      gameMode: resultMode,
      wins,
      score,
      rounds: played,
      newBest: score > localBest("cham", resultMode),
      saved: true,
    };
    try {
      localStorage.setItem(
        "arcade.cham",
        JSON.stringify({
          best:
            resultMode !== "standard"
              ? previous.best
              : Math.max(previous.best, score),
          plays: previous.plays + 1,
          last: result,
        }),
      );
    } catch {
      result.saved = false;
    }
    recordPlay("cham", score, 0, 0, {
      inputMode: mode,
      gameMode: resultMode,
      newBest: result.newBest,
      rounds: played.map((r) => ({ win: r.win, responseMs: r.responseMs })),
      metadata: {
        passed: played.length === 10 && played.every((r) => r.win),
        chamHard: hard,
      },
    });
    onFinish();
    navigate("/result/cham", { replace: true, state: result });
  }
  function answer(player: Direction | null) {
    if (phaseRef.current !== "respond") return;
    if (player) tone("cham.move");
    const win = seeker
      ? player !== null && player === computer
      : winsRound(computer, player);
    const next = [
      ...roundsRef.current,
      {
        computer,
        player,
        win,
        responseMs: player
          ? Math.max(0, responseMs - remainingRef.current)
          : undefined,
      },
    ];
    roundsRef.current = next;
    setRounds(next);
    const streak = next
      .slice()
      .reverse()
      .findIndex((round) => !round.win);
    tone(
      win
        ? (streak < 0 ? next.length : streak) % 3 === 0
          ? "combo"
          : "cham.success"
        : "cham.fail",
    );
    transition("feedback", FEEDBACK_MS);
  }
  inputRef.current = (d) => {
    if (
      mode === "buttons" &&
      !document.hidden &&
      !document.querySelector("dialog[open]")
    )
      answer(d);
  };
  tickRef.current = (delta) => {
    if (
      phaseRef.current === "ready" ||
      phaseRef.current === "paused" ||
      complete.current
    )
      return;
    if (mode === "hand" && !canPlay) {
      pause();
      return;
    }
    if (mode === "face") {
      const lost = !canPlay || performance.now() - camera.face.time > 900;
      if (lost) {
        faceLostAt.current ??= performance.now();
        // A turned head can briefly hide one eye. Keep the round moving;
        // never invent a direction from a missing or stale observation.
        if (
          camera.state !== "ready" ||
          camera.vision === "error" ||
          performance.now() - faceLostAt.current >= 3000
        ) {
          pause();
          return;
        }
      } else faceLostAt.current = null;
    }
    remainingRef.current = Math.max(0, remainingRef.current - delta);
    setRemaining(remainingRef.current);
    if (remainingRef.current > 0) return;
    if (phaseRef.current === "countdown") {
      if (!seeker)
        setComputer(directions[Math.floor(Math.random() * directions.length)]);
      candidate.current = { direction: "center", since: 0 };
      transition("respond", responseMs);
    } else if (phaseRef.current === "respond") answer(null);
    else if (phaseRef.current === "feedback")
      roundsRef.current.length >= 10 ? finish() : nextRound();
  };
  useEffect(() => {
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      tickRef.current(now - previous);
      previous = now;
    }, 40);
    const hidden = () => {
      if (document.hidden) pause();
    };
    const key = (event: KeyboardEvent) => {
      if (document.querySelector("dialog[open]") || event.repeat) return;
      if (event.key === "Escape") pause();
      const d = (
        {
          ArrowLeft: "left",
          ArrowRight: "right",
          ArrowUp: "up",
          ArrowDown: "down",
        } as Record<string, Direction>
      )[event.key];
      if (d) {
        event.preventDefault();
        inputRef.current(d);
      }
    };
    window.addEventListener("keydown", key);
    window.addEventListener("arcade:pause", pause);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", key);
      window.removeEventListener("arcade:pause", pause);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);

  useEffect(() => {
    if (mode !== "face") return;
    if (!camera.face.detected) {
      candidate.current = { direction: "center", since: 0 };
      if (calibrating) {
        calibration.current = [];
        setCalibrationCount(0);
      }
      return;
    }
    if (calibrating) {
      const sample = camera.face;
      const first = calibration.current[0];
      if (first && Math.hypot(sample.x - first.x, sample.y - first.y) > 0.06)
        calibration.current = [];
      calibration.current.push(sample);
      setCalibrationCount(calibration.current.length);
      if (calibration.current.length >= 24) {
        const mean = calibration.current.reduce(
          (sum, p) => ({ x: sum.x + p.x / 24, y: sum.y + p.y / 24 }),
          { x: 0, y: 0 },
        );
        baseline.current = mean;
        setNeutral(mean);
        setCalibrating(false);
      }
      return;
    }
    if (!baseline.current) return;
    const d = faceDirection(camera.face, baseline.current);
    if (d === "center") centered.current = true;
    if (phaseRef.current !== "respond" || !centered.current) return;
    if (candidate.current.direction !== d)
      candidate.current = { direction: d, since: camera.face.time };
    else if (
      d !== "center" &&
      camera.face.time - candidate.current.since >= 100
    )
      answer(d);
  }, [camera.face, mode, calibrating]);

  useEffect(() => {
    if (mode !== "hand" || phaseRef.current !== "respond" || !canPlay) {
      candidate.current = { direction: "center", since: 0 };
      return;
    }
    const d = pointingDirection(camera.hand.landmarks);
    const now = performance.now();
    if (d === "center" || candidate.current.direction !== d)
      candidate.current = { direction: d, since: now };
    else if (now - candidate.current.since >= 120) answer(d);
  }, [camera.hand, mode, canPlay]);

  function selectMode(next: "face" | "hand" | "buttons") {
    pause();
    setChoice(next);
    if (next === "buttons") setCalibrating(false);
    candidate.current = { direction: "center", since: 0 };
    if (next !== "buttons" && !camera.stream) void camera.connect();
  }
  const active =
    phase === "countdown" || phase === "respond" || phase === "feedback";
  const last = rounds[rounds.length - 1];
  const seekerTell =
    seeker &&
    ((phase === "countdown" && remaining <= 600) ||
      phase === "respond" ||
      phase === "feedback");
  const rivalDirection =
    seekerTell || (!seeker && (phase === "respond" || phase === "feedback"))
      ? computer
      : "center";
  useEffect(() => {
    for (const pose of Object.values(chamPoses)) {
      const image = new Image();
      image.src = characterAssets[pose].src;
    }
  }, []);
  return (
    <div className="cham-page">
      <div className="cham-toolbar">
        <Link to="/games">← {t("back")}</Link>
        <strong>
          {t("round")}{" "}
          {Math.min(rounds.length + (phase === "feedback" ? 0 : 1), 10)} / 10
        </strong>
        <button onClick={pause} disabled={!active} aria-label={t("pause")}>
          <Pause />
        </button>
      </div>
      <div className="cham-mode">
        <button
          className={mode !== "buttons" ? "active" : ""}
          data-sound={!camera.stream ? "none" : undefined}
          onClick={() => selectMode(seeker ? "hand" : "face")}
        >
          <Camera />
          {seeker ? t("handMode") : text("얼굴로 플레이", "Face control")}
        </button>
        <button
          className={mode === "buttons" ? "active" : ""}
          onClick={() => selectMode("buttons")}
        >
          <Keyboard />
          {compactTouch
            ? t("touchMode")
            : text("버튼 / 키보드", "Buttons / keys")}
        </button>
      </div>
      <div className="cham-layout">
        <aside className="cham-hud">
          <section className="hud-panel pink">
            <h3>{t("score")}</h3>
            <strong>{rounds.filter((r) => r.win).length * 100}</strong>
          </section>
          <section className="hud-panel cyan">
            <h3>{text("성공", "DODGED")}</h3>
            <strong>
              {rounds.filter((r) => r.win).length}
              <small> / 10</small>
            </strong>
          </section>
          <section className="hud-panel lime">
            <h3>{t("round")}</h3>
            <strong>
              {Math.min(rounds.length + (phase === "feedback" ? 0 : 1), 10)}
              <small> / 10</small>
            </strong>
          </section>
        </aside>
        <aside className="cham-info panel">
          <span className="cham-sticker">LOOK OUT!</span>
          <h1>{t("cham")}</h1>
          {seeker && <p>{t("seekerHint", { seconds: responseMs / 1000 })}</p>}
          <p hidden={seeker}>
            {text(
              "컴퓨터가 가리키는 방향을 피해 고개를 돌려요. 같은 방향이나 시간 초과는 실패!",
              "Turn away from the computer's arrow. Matching it or running out of time loses the round!",
            )}
          </p>
          <WebcamFrame compact />
          {mode === "face" && (
            <>
              <button
                className="cham-calibrate"
                disabled={!camera.face.detected || active || calibrating}
                onClick={beginCalibration}
              >
                {calibrating
                  ? `${calibrationCount} / 24`
                  : text("정면 보정", "Calibrate center")}
              </button>
              <p>
                {text(
                  "정면 보정 후 고개를 살짝 움직이세요. 매 라운드 정면으로 돌아오면 준비 완료! 잠깐 인식이 끊겨도 게임은 계속돼요.",
                  "Calibrate facing forward, then make a small head movement. Return to center each round. Brief tracking gaps do not stop play.",
                )}
              </p>
              <strong className="cham-face-direction">
                {camera.face.detected
                  ? `${arrows[direction]} ${label(direction)}`
                  : t("showFace")}
              </strong>
              {active && !camera.face.detected && (
                <p role="status">
                  {text(
                    "인식 중… 정면으로 돌아와 주세요. 이번 라운드는 계속 진행됩니다.",
                    "Finding your face… return to center. This round keeps moving.",
                  )}
                </p>
              )}
            </>
          )}
        </aside>
        <section className="cham-stage panel">
          <div className="cham-stage-top">
            <span className="cham-sticker">
              {seeker
                ? text("내가 술래!", "YOUR TURN!")
                : text("다른 방향으로!", "LOOK AWAY!")}
            </span>
            <strong>
              {t("score")} {rounds.filter((r) => r.win).length * 100}
            </strong>
          </div>
          {seeker ? (
            <div
              className="cham-rival-cue"
              data-testid="seeker-tell"
              data-direction={seekerTell ? computer : "center"}
              data-tell-phase={phase === "countdown" ? "peek" : "turn"}
            >
              <Character
                asset={chamPoses[rivalDirection]}
                className="cham-rival"
                priority
              />
              {seekerTell && (
                <>
                  <span className="cham-tell-lines" aria-hidden="true">
                    〃
                  </span>
                  <span className="cham-tell-accessible" role="status">
                    {t("seekerDirectionHint", { direction: label(computer) })}
                  </span>
                </>
              )}
            </div>
          ) : (
            <Character
              asset={chamPoses[rivalDirection]}
              className="cham-rival"
              priority
            />
          )}
          <div className="cham-cue" data-phase={phase} aria-live="polite">
            {phase === "countdown" ? (
              <>
                <b key={Math.ceil(remaining / 500)} className="bounce-feedback">
                  {Math.ceil(remaining / 500)}
                </b>
                <span>
                  {seeker
                    ? t("seekerWatch")
                    : text("정면 보고 준비!", "Face forward. Ready!")}
                </span>
              </>
            ) : phase === "respond" ? (
              <>
                <b
                  key="arrow"
                  className="bounce-feedback"
                  data-testid="cham-arrow"
                >
                  {seeker ? "?" : arrows[computer]}
                </b>
                <span>
                  {seeker
                    ? text("가리켜!", "POINT!")
                    : text("피해!", "LOOK AWAY!")}
                </span>
              </>
            ) : phase === "feedback" && last ? (
              <>
                <b key="feedback" className="bounce-feedback">
                  {last.win ? "✓" : "✕"}
                </b>
                <span>
                  {last.win
                    ? seeker
                      ? text("잡았다! +100", "CAUGHT! +100")
                      : text("피했다! +100", "DODGED! +100")
                    : last.player
                      ? seeker
                        ? text("놓쳤다!", "MISSED!")
                        : text("같은 방향!", "SAME DIRECTION!")
                      : text("시간 초과!", "TIME UP!")}
                </span>
                <small>
                  {text("컴퓨터", "Computer")} {arrows[last.computer]} ·{" "}
                  {text("나", "You")} {last.player ? arrows[last.player] : "—"}
                </small>
              </>
            ) : (
              <b>?</b>
            )}
          </div>
          <progress
            aria-label={t("time")}
            max={
              phase === "feedback"
                ? FEEDBACK_MS
                : phase === "respond"
                  ? responseMs
                  : COUNTDOWN_MS
            }
            value={remaining}
          />
          <div className="cham-controls">
            {directions.map((d) => (
              <button
                key={d}
                aria-label={label(d)}
                disabled={mode !== "buttons" || phase !== "respond"}
                onClick={() => inputRef.current(d)}
              >
                {arrows[d]}
                <small>{label(d)}</small>
              </button>
            ))}
          </div>
          <div className="cham-rounds" aria-label={t("round")}>
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={rounds[i] ? (rounds[i].win ? "won" : "lost") : ""}
              >
                {rounds[i] ? (rounds[i].win ? "✓" : "✕") : i + 1}
              </span>
            ))}
          </div>
          {(phase === "ready" || phase === "paused") && (
            <div className="cham-overlay">
              {mode === "hand" && <HandMenuCursor active />}
              <section className="panel cham-dialog">
                <h2>
                  {phase === "ready" ? t("readyGame") : t("paused")}
                  <small className="selected-game-mode">
                    {t("gameMode")} ·{" "}
                    {t(
                      seeker
                        ? "seekerMode"
                        : hard
                          ? "hardMode"
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
                      aria-pressed={!hard && !seeker}
                      className={!hard && !seeker ? "active" : ""}
                      onClick={() => {
                        setHard(false);
                        setChoice(null);
                        setParams({});
                      }}
                    >
                      {t("standardMode")}
                    </button>
                    <button
                      data-hand-click
                      aria-pressed={hard}
                      className={hard ? "active" : ""}
                      onClick={() => {
                        setHard(true);
                        setChoice(null);
                        setParams({});
                      }}
                    >
                      {t("hardMode")}
                    </button>
                    <button
                      data-hand-click
                      aria-pressed={seeker}
                      className={seeker ? "active" : ""}
                      onClick={() => {
                        setHard(false);
                        setChoice(null);
                        setCalibrating(false);
                        setParams({ role: "seeker" });
                      }}
                    >
                      {t("seekerMode")}
                    </button>
                  </div>
                )}
                {seeker && (
                  <p>{t("seekerHint", { seconds: responseMs / 1000 })}</p>
                )}
                <p hidden={seeker}>
                  {text(
                    `10라운드 · 화살표가 나타나면 ${responseMs / 1000}초 안에 다른 방향을 선택하세요.`,
                    `10 rounds. Choose a different direction within ${responseMs / 1000} seconds of the arrow appearing.`,
                  )}
                </p>
                {mode === "face" && (
                  <p>
                    {neutral
                      ? canPlay
                        ? text("얼굴 인식 준비 완료", "Face tracking ready")
                        : t("showFace")
                      : text(
                          "카메라 패널에서 정면 보정을 먼저 완료해주세요.",
                          "First use Calibrate center in the camera panel.",
                        )}
                  </p>
                )}
                {phase === "ready" && !seeker && (
                  <InputCoach
                    game="cham"
                    cameraMode={mode === "face"}
                    onModeChange={(value) =>
                      selectMode(value ? "face" : "buttons")
                    }
                    faceNeutral={neutral}
                    onCalibrate={beginCalibration}
                    calibrating={calibrating}
                  />
                )}
                <button
                  className="arcade-button pink"
                  data-hand-click
                  disabled={!canPlay || calibrating}
                  onClick={() => {
                    tone(phase === "ready" ? "game.ready" : "resume");
                    if (phase === "ready") nextRound();
                    else {
                      candidate.current = { direction: "center", since: 0 };
                      transition(resumePhase.current);
                    }
                  }}
                >
                  <Play />
                  {t(phase === "ready" ? "go" : "resume")}
                </button>
                {mode !== "buttons" && (
                  <button
                    className="cham-fallback"
                    onClick={() => selectMode("buttons")}
                  >
                    {text("버튼으로 계속", "Continue with buttons")}
                  </button>
                )}
              </section>
            </div>
          )}
        </section>
      </div>
      <p className="cham-note panel" hidden={seeker}>
        {text(
          "화면에 보이는 방향을 기준으로 플레이해요. 목을 무리하게 돌리지 말고 편안하게 움직여주세요.",
          "Directions follow the mirrored preview. Move comfortably without straining your neck.",
        )}
      </p>
    </div>
  );
}

export function ChamResultPage({ tone }: { tone: (kind?: SoundCue) => void }) {
  const { t, i18n } = useTranslation();
  const ko = i18n.language.startsWith("ko");
  const location = useLocation();
  const stored = readCham();
  const result = (location.state as ChamResult | null) ?? stored.last;
  if (!result)
    return (
      <section className="empty-state panel">
        <h1>{t("resultEmpty")}</h1>
        <Link className="arcade-button pink" to="/play/cham">
          {t("start")}
        </Link>
      </section>
    );
  return (
    <GameResult
      game="cham"
      score={result.score}
      best={localBest("cham", result.gameMode ?? "standard")}
      stats={[
        {
          label:
            result.gameMode === "seeker"
              ? ko
                ? "잡은 횟수"
                : "CAUGHT"
              : ko
                ? "피한 횟수"
                : "DODGED",
          value: result.wins,
          unit: " / 10",
        },
      ]}
      newBest={result.newBest}
      saved={result.saved}
      tone={tone}
      replay={
        result.gameMode === "seeker" ? "/play/cham?role=seeker" : "/play/cham"
      }
    >
      <div className="cham-rounds">
        {result.rounds.map((r, i) => (
          <span
            key={i}
            className={r.win ? "won" : "lost"}
            title={`${i + 1}: ${arrows[r.computer]} / ${r.player ? arrows[r.player] : "—"}`}
          >
            {r.win ? "✓" : "✕"}
          </span>
        ))}
      </div>
    </GameResult>
  );
}
