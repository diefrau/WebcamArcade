import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Check, RotateCcw, MousePointer2 } from "lucide-react";
import { useCamera } from "../vision/CameraProvider";
import { useInputEnvironment } from "./InputEnvironment";
import { PracticeSession, type PracticePoint } from "./practiceSession";
import { InputDemo } from "./InputDemo";
import { coachCopy, pointerCopy, inputKind } from "./input-coach-data";
import { rpsChoices } from "../games/rpsRules";
import type { GameId } from "../community/store";
import "./input-coach.css";
export function InputCoach({
  game,
  cameraMode,
  onModeChange,
  faceNeutral = null,
  onCalibrate,
  calibrating = false,
}: {
  game: GameId;
  cameraMode: boolean;
  onModeChange: (camera: boolean) => void;
  faceNeutral?: { x: number; y: number } | null;
  onCalibrate?: () => void;
  calibrating?: boolean;
}) {
  const { i18n } = useTranslation();
  const ko = i18n.language.startsWith("ko");
  const text = (a: string, b: string) => (ko ? a : b);
  const camera = useCamera();
  const copy = cameraMode ? coachCopy[game] : pointerCopy[game];
  const { compactTouch } = useInputEnvironment();
  const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const practice = useRef(new PracticeSession(game));
  const [view, setView] = useState(() => practice.current.view());
  const pressed = useRef(false);
  const reset = () => {
    practice.current = new PracticeSession(game);
    pressed.current = false;
    setView(practice.current.view());
  };
  useEffect(() => {
    reset();
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open, cameraMode, game, faceNeutral]);
  useEffect(() => {
    if (!open || !cameraMode) return;
    if (
      document.hidden ||
      camera.state !== "ready" ||
      camera.vision !== "ready"
    ) {
      practice.current.lose();
      setView(practice.current.view());
      return;
    }
    const now = performance.now();
    const settings = camera.stream?.getVideoTracks()[0]?.getSettings();
    const aspect =
      settings?.width && settings.height
        ? settings.width / settings.height
        : 4 / 3;
    setView(
      inputKind[game] === "hand"
        ? practice.current.hand(camera.hand, camera.shotSequence, now, aspect)
        : game === "cham"
          ? practice.current.face(camera.face, faceNeutral, now)
          : practice.current.body(camera.body, now),
    );
  }, [
    open,
    cameraMode,
    camera.hand,
    camera.face,
    camera.body,
    camera.shotSequence,
    camera.state,
    camera.vision,
    faceNeutral,
    game,
  ]);
  useEffect(() => {
    if (!open) return;
    const hidden = () => {
      practice.current.lose();
      pressed.current = false;
      setView(practice.current.view());
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [open]);
  const mode = (next: boolean) => {
    onModeChange(next);
    if (next && !camera.stream) void camera.connect();
  };
  const point = (event: React.PointerEvent<SVGSVGElement>): PracticePoint => {
    const r = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)),
    };
  };
  const move = (direction: string) =>
    setView(practice.current.direction(direction));
  const waiting =
    cameraMode && (camera.state !== "ready" || camera.vision !== "ready");
  const status = view.complete
    ? text("연습 완료!", "Practice complete!")
    : waiting
      ? text("웹캠 인식을 준비해 주세요.", "Connect your webcam to practice.")
      : view.message === "tracking"
        ? text(
            `${inputKind[game] === "hand" ? "손" : inputKind[game] === "face" ? "얼굴" : "어깨"}이 화면에 보이게 해 주세요.`,
            `Keep your ${inputKind[game] === "hand" ? "hand" : inputKind[game] === "face" ? "face" : "shoulders"} visible.`,
          )
        : view.message === "calibrate"
          ? text("먼저 정면을 맞춰 주세요.", "Calibrate facing forward first.")
          : game === "shoot"
            ? text(
                "과녁 위에서 한 번 쏴 보세요.",
                "Fire once with your aim on the target.",
              )
            : game === "circle"
              ? text(
                  cameraMode
                    ? "선을 그린 뒤 손을 펴 보세요."
                    : "누른 채로 선을 그린 뒤 놓아 보세요.",
                  "Draw a line, then release.",
                )
              : game === "rps"
                ? text(
                    "바위 → 보 → 가위를 차례로 유지해요.",
                    "Hold rock, then paper, then scissors.",
                  )
                : text(
                    "왼쪽 → 오른쪽 → 가운데로 돌아오세요.",
                    "Move left, then right, then back to center.",
                  );
  return (
    <div className="input-coach">
      <p className="coach-goal">{copy.goal[ko ? 0 : 1]}</p>
      <InputDemo game={game} />
      <ol className="coach-steps">
        {copy.steps.map((step, i) => (
          <li key={i}>
            <b>{i + 1}</b>
            {step[ko ? 0 : 1]}
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="coach-open"
        data-hand-click
        onClick={() => setOpen(true)}
      >
        {text("입력 연습", "Practice controls")}
      </button>
      <dialog
        ref={dialog}
        className="coach-dialog"
        aria-labelledby={title}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        onKeyDown={(event) => {
          if (cameraMode || !["cham", "dodge"].includes(game)) return;
          const direction =
            event.key === "ArrowLeft"
              ? "left"
              : event.key === "ArrowRight"
                ? "right"
                : event.key === "ArrowDown"
                  ? "center"
                  : null;
          if (direction) {
            event.preventDefault();
            event.stopPropagation();
            move(direction);
          }
        }}
      >
        <header>
          <h2 id={title}>{text("입력 연습", "Control practice")}</h2>
          <span>
            {text("기록에 포함되지 않아요", "No scores are recorded")}
          </span>
        </header>
        <div
          className="coach-modes"
          role="group"
          aria-label={text("연습 입력 방식", "Practice input")}
        >
          <button aria-pressed={cameraMode} onClick={() => mode(true)}>
            <Camera />
            {text("웹캠", "Webcam")}
          </button>
          <button aria-pressed={!cameraMode} onClick={() => mode(false)}>
            <MousePointer2 />
            {compactTouch
              ? text("터치 / 버튼", "Touch / buttons")
              : text("마우스 / 버튼", "Mouse / buttons")}
          </button>
        </div>
        {cameraMode && game === "cham" && onCalibrate && (
          <button
            className="coach-calibrate"
            disabled={!camera.face.detected || calibrating}
            onClick={onCalibrate}
          >
            {calibrating
              ? text(
                  "정면을 보고 잠깐 기다리세요",
                  "Hold still, facing forward",
                )
              : text("정면 맞추기", "Calibrate forward")}
          </button>
        )}
        {waiting && (
          <button
            className="coach-calibrate"
            onClick={() =>
              camera.stream ? camera.retryVision() : void camera.connect()
            }
          >
            {text("카메라 연결 / 재시도", "Connect / retry camera")}
          </button>
        )}
        <div className="coach-sandbox" data-testid="practice-sandbox">
          {game === "rps" ? (
            <div className="coach-shapes">
              {rpsChoices.map((pose, i) =>
                cameraMode ? (
                  <span
                    key={pose}
                    className={view.steps.includes(pose) ? "checked" : ""}
                    aria-label={pose}
                  >
                    {["✊", "✋", "✌"][i]}
                    {view.steps.includes(pose) && <Check />}
                  </span>
                ) : (
                  <button
                    key={pose}
                    aria-label={text(
                      ["바위 연습", "보 연습", "가위 연습"][i],
                      `${pose} practice`,
                    )}
                    className={view.steps.includes(pose) ? "checked" : ""}
                    onClick={() => setView(practice.current.shape(pose))}
                  >
                    {["✊", "✋", "✌"][i]}
                  </button>
                ),
              )}
              {cameraMode && (
                <>
                  <strong>
                    {view.pose
                      ? text("인식한 모양: ", "Detected: ") +
                        { rock: "✊", paper: "✋", scissors: "✌" }[view.pose]
                      : text("손 모양을 보여주세요", "Show a hand shape")}
                  </strong>
                  <progress
                    aria-label={text("손 모양 유지", "Hold hand shape")}
                    max={1}
                    value={view.hold}
                  />
                </>
              )}
            </div>
          ) : (
            <svg
              viewBox="0 0 360 190"
              className="practice-field"
              aria-label={text("연습 영역", "Practice area")}
              onPointerDown={(event) => {
                if (cameraMode || !["shoot", "circle"].includes(game)) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                pressed.current = true;
                setView(
                  practice.current.pointer(
                    point(event),
                    true,
                    game === "shoot",
                  ),
                );
              }}
              onPointerMove={(event) => {
                if (cameraMode || !["shoot", "circle"].includes(game)) return;
                setView(
                  practice.current.pointer(point(event), pressed.current),
                );
              }}
              onPointerUp={(event) => {
                if (cameraMode) return;
                pressed.current = false;
                setView(practice.current.pointer(point(event), false));
              }}
              onPointerCancel={() => {
                pressed.current = false;
                practice.current.lose();
                setView(practice.current.view());
              }}
            >
              {game === "shoot" ? (
                <g className={view.complete ? "practice-hit" : ""}>
                  <circle cx="259" cy="84" r="36" />
                  <circle cx="259" cy="84" r="23" />
                  <circle cx="259" cy="84" r="9" />
                </g>
              ) : game === "circle" ? (
                <>
                  <circle className="practice-guide" cx="180" cy="95" r="66" />
                  <path
                    className="practice-stroke"
                    d={view.path
                      .map(
                        (p) => `${p.move ? "M" : "L"}${p.x * 360},${p.y * 190}`,
                      )
                      .join(" ")}
                  />
                </>
              ) : (
                <>
                  <path className="practice-guide" d="M36 145H324" />
                  <text x="50" y="38">
                    ←
                  </text>
                  <text x="292" y="38">
                    →
                  </text>
                </>
              )}
              {game === "shoot" || game === "circle" ? (
                <circle
                  className="practice-cursor"
                  cx={view.cursor.x * 360}
                  cy={view.cursor.y * 190}
                  r="10"
                />
              ) : (
                <g transform={`translate(${view.cursor.x * 360} 108)`}>
                  <circle r="18" />
                  <path d="M0 18v32m-23-20 23-12 23 12" />
                </g>
              )}
            </svg>
          )}
          {!cameraMode && (game === "cham" || game === "dodge") && (
            <div className="coach-directions">
              {["left", "center", "right"].map((d, i) => (
                <button
                  key={d}
                  aria-label={text(
                    ["왼쪽 연습", "가운데 연습", "오른쪽 연습"][i],
                    `${d} practice`,
                  )}
                  onClick={() => move(d)}
                >
                  {["←", "●", "→"][i]}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="coach-status" role="status">
          {status}
        </p>
        <progress
          className="coach-progress"
          aria-label={text("연습 진행", "Practice progress")}
          max={view.total}
          value={view.done}
        />
        <footer>
          <button className="coach-reset" onClick={reset}>
            <RotateCcw />
            {text("다시 연습", "Reset practice")}
          </button>
          <button
            className={`arcade-button ${view.complete ? "lime" : "white"}`}
            onClick={() => setOpen(false)}
          >
            {view.complete
              ? text("연습 마치기", "Done")
              : text("건너뛰기", "Skip practice")}
          </button>
        </footer>
      </dialog>
    </div>
  );
}
