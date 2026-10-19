import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Hand, RotateCcw, Sparkles, X } from "lucide-react";
import { useCamera } from "../vision/CameraProvider";

const connections = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [5, 9, 10, 11, 12],
  [9, 13, 14, 15, 16],
  [13, 17, 18, 19, 20],
  [0, 17],
];
export function WebcamFrame({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const camera = useCamera();
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.srcObject = camera.stream;
    if (camera.stream) void element.play().catch(() => {});
    return () => {
      element.srcObject = null;
    };
  }, [camera.stream]);
  const waiting =
    camera.state === "requesting" || camera.state === "connecting";
  const live = camera.state === "ready";
  const problem = ["denied", "missing", "busy", "error"].includes(camera.state);
  const shownHands = (
    camera.homeTracking
      ? camera.homeMotion?.hands || []
      : camera.hand.detected
        ? [camera.hand.landmarks]
        : []
  ).filter(
    (points) =>
      points.length === 21 &&
      points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
  );
  const status =
    camera.tracking === "body"
      ? camera.vision === "error"
        ? "bodyError"
        : camera.vision === "loading"
          ? "bodyLoading"
          : camera.body.detected
            ? "bodyDetected"
            : "showBody"
      : camera.tracking === "face"
        ? camera.vision === "error"
          ? "faceError"
          : camera.vision === "loading"
            ? "faceLoading"
            : camera.face.detected
              ? "faceDetected"
              : "showFace"
        : camera.vision === "error"
          ? "visionError"
          : camera.vision === "loading"
            ? "visionLoading"
            : camera.hand.detected
              ? "handDetected"
              : "showHand";
  return (
    <section
      className={`webcam-frame ${compact ? "compact" : ""} ${live ? "is-live" : ""}`}
      aria-label={t("cameraTitle")}
    >
      <span className="you-label">{t("you")}</span>
      <span className="webcam-mode">
        <span />
        {t(
          live ? "cameraLive" : waiting ? "cameraConnecting" : "cameraStandby",
        )}
      </span>
      <div className="webcam-placeholder">
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          className="camera-video"
          hidden={!camera.stream}
        />
        {live && camera.tracking === "hand" && shownHands.length > 0 && (
          <svg
            className="hand-overlay"
            viewBox="0 0 640 480"
            aria-hidden="true"
          >
            {shownHands.map((points, handIndex) => (
              <g key={handIndex} className={`tracked-hand hand-${handIndex}`}>
                {connections.map((indices, index) => (
                  <polyline
                    key={index}
                    points={indices
                      .map(
                        (i) =>
                          `${(1 - points[i].x) * 640},${points[i].y * 480}`,
                      )
                      .join(" ")}
                  />
                ))}
                {points.map((point, index) => (
                  <circle
                    key={index}
                    cx={(1 - point.x) * 640}
                    cy={point.y * 480}
                    r={index === 4 || index === 8 ? 6 : 3}
                  />
                ))}
              </g>
            ))}
          </svg>
        )}
        {live && camera.homeTracking && camera.vision === "ready" && (
          <>
            <span className="home-motion-status">
              {t("homeHands", { count: shownHands.length })} ·{" "}
              {t(camera.face.detected ? "homeFaceReady" : "homeFaceWaiting")}
            </span>
            {camera.face.detected && camera.homeMotion && (
              <svg
                className="hand-overlay face-overlay"
                viewBox="0 0 640 480"
                aria-hidden="true"
              >
                {[33, 263, 1, 61, 291, 13, 14].map((i) => {
                  const p = camera.homeMotion!.face[i];
                  return (
                    p && (
                      <circle
                        key={i}
                        cx={(1 - p.x) * 640}
                        cy={p.y * 480}
                        r={3}
                      />
                    )
                  );
                })}
              </svg>
            )}
          </>
        )}
        {live && camera.tracking === "body" && camera.body.detected && (
          <svg
            className="hand-overlay"
            viewBox="0 0 640 480"
            aria-hidden="true"
          >
            <polyline
              points={[11, 12]
                .map(
                  (i) =>
                    `${(1 - camera.body.landmarks[i].x) * 640},${camera.body.landmarks[i].y * 480}`,
                )
                .join(" ")}
            />
            {[11, 12].map((i) => (
              <circle
                key={i}
                cx={(1 - camera.body.landmarks[i].x) * 640}
                cy={camera.body.landmarks[i].y * 480}
                r={7}
              />
            ))}
          </svg>
        )}
        {!live && (
          <div className="camera-empty">
            <div className="camera-orbit">
              <Hand size={68} strokeWidth={2} />
              <Sparkles className="orbit-star" />
            </div>
            <h3>
              {t(
                problem
                  ? `camera_${camera.state}`
                  : waiting
                    ? "cameraConnecting"
                    : "cameraTitle",
              )}
            </h3>
            <p>
              {t(
                problem
                  ? "cameraErrorHelp"
                  : waiting
                    ? "permissionHint"
                    : camera.tracking === "body"
                      ? "showBody"
                      : camera.tracking === "face"
                        ? "showFace"
                        : "cameraHint",
              )}
            </p>
            <button
              className="camera-connect"
              disabled={waiting}
              onClick={() => void camera.connect()}
            >
              <Camera size={20} />
              {t(
                problem
                  ? "cameraRetry"
                  : waiting
                    ? "cameraConnecting"
                    : "cameraConnect",
              )}
            </button>
          </div>
        )}
        {live && (
          <span
            className={`camera-note ${camera.vision === "error" ? "warning" : ""}`}
          >
            <Hand size={20} />
            {t(status)}
            {camera.vision === "error" && (
              <button
                onClick={camera.retryVision}
                aria-label={t("cameraRetry")}
              >
                <RotateCcw size={17} />
              </button>
            )}
          </span>
        )}
        {camera.stream && (
          <button
            className="camera-disconnect"
            onClick={camera.disconnect}
            aria-label={t("cameraDisconnect")}
          >
            <X size={15} />
          </button>
        )}
        {waiting && (
          <button className="camera-cancel" onClick={camera.disconnect}>
            {t("cancel")}
          </button>
        )}
        <span className="corner c1" />
        <span className="corner c2" />
        <span className="corner c3" />
        <span className="corner c4" />
      </div>
    </section>
  );
}
