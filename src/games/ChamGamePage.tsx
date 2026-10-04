import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Camera, Keyboard, Pause, Play, RotateCcw, Trophy } from "lucide-react";
import { useCamera } from "../vision/CameraProvider";
import { faceDirection, type Direction } from "../vision/face";
import { Character } from "../components/Character";
import { WebcamFrame } from "../components/WebcamFrame";
import "./cham.css";
import { winsRound } from "./chamRules";
import { CountUp, ResultCelebration } from "../components/ResultCelebration";
import type { SoundCue } from "../audio/ArcadeAudio";

export const directions: Direction[] = ["left", "up", "down", "right"];
const arrows = { left: "←", right: "→", up: "↑", down: "↓", center: "•" };
type Round = { computer: Direction; player: Direction | null; win: boolean };
export type ChamResult = {
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
  const navigate = useNavigate();
  const [choice, setChoice] = useState<"face" | "buttons" | null>(null);
  const mode = choice ?? (camera.stream ? "face" : "buttons");
  useEffect(() => {
    if (camera.stream) setChoice((v) => v ?? "face");
  }, [camera.stream]);
  const [phase, setPhase] = useState<Phase>("ready");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [computer, setComputer] = useState<Direction>("left");
  const [remaining, setRemaining] = useState(1500);
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
  const phaseRef = useRef<Phase>(phase);
  const remainingRef = useRef(1500);
  const resumePhase = useRef<Phase>("countdown");
  const roundsRef = useRef<Round[]>([]);
  const complete = useRef(false);
  const tickRef = useRef<(delta: number) => void>(() => {});
  const inputRef = useRef<(direction: Direction) => void>(() => {});
  const canPlay =
    mode === "buttons" ||
    (camera.state === "ready" &&
      camera.vision === "ready" &&
      camera.face.detected &&
      neutral !== null);
  const direction = neutral ? faceDirection(camera.face, neutral) : "center";
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
    centered.current = mode === "buttons";
    candidate.current = { direction: "center", since: 0 };
    transition("countdown", 1500);
  }
  function finish() {
    if (complete.current) return;
    complete.current = true;
    const previous = readCham(),
      played = roundsRef.current;
    const wins = played.filter((r) => r.win).length,
      score = wins * 100;
    const result: ChamResult = {
      wins,
      score,
      rounds: played,
      newBest: score > previous.best,
      saved: true,
    };
    try {
      localStorage.setItem(
        "arcade.cham",
        JSON.stringify({
          best: Math.max(previous.best, score),
          plays: previous.plays + 1,
          last: result,
        }),
      );
    } catch {
      result.saved = false;
    }
    onFinish();
    navigate("/result/cham", { replace: true, state: result });
  }
  function answer(player: Direction | null) {
    if (phaseRef.current !== "respond") return;
    const win = winsRound(computer, player);
    const next = [...roundsRef.current, { computer, player, win }];
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
          : "success"
        : "fail",
    );
    transition("feedback", 1000);
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
    if (
      mode === "face" &&
      (!canPlay || performance.now() - camera.face.time > 900)
    ) {
      pause();
      return;
    }
    remainingRef.current = Math.max(0, remainingRef.current - delta);
    setRemaining(remainingRef.current);
    if (remainingRef.current > 0) return;
    if (phaseRef.current === "countdown") {
      setComputer(directions[Math.floor(Math.random() * directions.length)]);
      candidate.current = { direction: "center", since: 0 };
      transition("respond", 1500);
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
      camera.face.time - candidate.current.since >= 180
    )
      answer(d);
  }, [camera.face, mode, calibrating]);

  function selectMode(next: "face" | "buttons") {
    pause();
    setChoice(next);
    if (next === "buttons") setCalibrating(false);
    candidate.current = { direction: "center", since: 0 };
    if (next === "face" && !camera.stream) void camera.connect();
  }
  const active =
    phase === "countdown" || phase === "respond" || phase === "feedback";
  const last = rounds[rounds.length - 1];
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
          className={mode === "face" ? "active" : ""}
          onClick={() => selectMode("face")}
        >
          <Camera />
          {text("얼굴로 플레이", "Face control")}
        </button>
        <button
          className={mode === "buttons" ? "active" : ""}
          onClick={() => selectMode("buttons")}
        >
          <Keyboard />
          {text("버튼 / 키보드", "Buttons / keys")}
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
          <p>
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
                onClick={() => {
                  calibration.current = [];
                  baseline.current = null;
                  setNeutral(null);
                  setCalibrationCount(0);
                  setCalibrating(true);
                }}
              >
                {calibrating
                  ? `${calibrationCount} / 24`
                  : text("정면 보정", "Calibrate center")}
              </button>
              <p>
                {text(
                  "카메라 정면을 보고 보정하세요. 매 라운드 정면으로 돌아온 뒤 화살표를 피하세요.",
                  "Look straight at the camera to calibrate. Return to center before each round.",
                )}
              </p>
              <strong className="cham-face-direction">
                {camera.face.detected
                  ? `${arrows[direction]} ${label(direction)}`
                  : t("showFace")}
              </strong>
            </>
          )}
        </aside>
        <section className="cham-stage panel">
          <div className="cham-stage-top">
            <span className="cham-sticker">
              {text("다른 방향으로!", "LOOK AWAY!")}
            </span>
            <strong>
              {t("score")} {rounds.filter((r) => r.win).length * 100}
            </strong>
          </div>
          <Character asset="cham" className="cham-rival" />
          <div className="cham-cue" data-phase={phase} aria-live="polite">
            {phase === "countdown" ? (
              <>
                <b key={Math.ceil(remaining / 500)} className="bounce-feedback">
                  {Math.ceil(remaining / 500)}
                </b>
                <span>{text("정면 보고 준비!", "Face forward. Ready!")}</span>
              </>
            ) : phase === "respond" ? (
              <>
                <b
                  key="arrow"
                  className="bounce-feedback"
                  data-testid="cham-arrow"
                >
                  {arrows[computer]}
                </b>
                <span>{text("피해!", "LOOK AWAY!")}</span>
              </>
            ) : phase === "feedback" && last ? (
              <>
                <b key="feedback" className="bounce-feedback">
                  {last.win ? "✓" : "✕"}
                </b>
                <span>
                  {last.win
                    ? text("피했다! +100", "DODGED! +100")
                    : last.player
                      ? text("같은 방향!", "SAME DIRECTION!")
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
            max={phase === "feedback" ? 1000 : 1500}
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
              <section className="panel cham-dialog">
                <h2>{phase === "ready" ? t("readyGame") : t("paused")}</h2>
                <p>
                  {text(
                    "10라운드 · 화살표가 나타나면 1.5초 안에 다른 방향을 선택하세요.",
                    "10 rounds. Choose a different direction within 1.5 seconds of the arrow appearing.",
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
                <button
                  className="arcade-button pink"
                  disabled={!canPlay || calibrating}
                  onClick={() => {
                    tone(phase === "ready" ? "start" : "resume");
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
                {mode === "face" && (
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
      <p className="cham-note panel">
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
    <div className="cham-result">
      <h1 className="result-heading yellow-text">{t("clear")}</h1>
      <ResultCelebration
        newBest={result.newBest}
        score={result.score}
        onCelebrate={(record) => tone(record ? "newBest" : "result")}
      />
      <section className="panel cham-result-panel">
        <Character asset="cham" />
        <div>
          <h2>{t("cham")}</h2>
          <p>{result.newBest ? t("newBest") : t("nice")}</p>
          <div className="result-stats">
            <div>
              <span className="pink">{t("score")}</span>
              <b>
                <CountUp value={result.score} />
              </b>
            </div>
            <div>
              <span className="cyan">{ko ? "피한 횟수" : "DODGED"}</span>
              <b>
                <CountUp value={result.wins} />
                <small> / 10</small>
              </b>
            </div>
          </div>
          <p className="best-comparison">
            <Trophy />
            {t("best")} <b>{Math.max(stored.best, result.score)}</b>
          </p>
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
          {!result.saved && <p role="alert">{t("recordError")}</p>}
        </div>
      </section>
      <div className="result-actions">
        <Link className="arcade-button pink" to="/play/cham">
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
