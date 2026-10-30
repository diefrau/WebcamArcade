import { useEffect, useRef } from "react";
import { useCamera } from "../vision/CameraProvider";
import { HomeSecretDetector } from "../vision/homeSecrets";
import { unlockSecret } from "./client";
import { readSecrets } from "./secrets";
import "./secrets.css";
export function HomeEasterEggs() {
  const camera = useCamera();
  const detector = useRef(new HomeSecretDetector());
  useEffect(() => {
    const reset = () => detector.current.reset();
    document.addEventListener("visibilitychange", reset);
    return () => {
      document.removeEventListener("visibilitychange", reset);
      reset();
    };
  }, []);
  useEffect(() => {
    if (
      !camera.homeTracking ||
      camera.state !== "ready" ||
      camera.vision !== "ready" ||
      !camera.homeMotion ||
      document.hidden
    ) {
      detector.current.reset();
      return;
    }
    for (const id of detector.current.update(
      camera.homeMotion,
      new Set(readSecrets().map((r) => r.id)),
    ))
      unlockSecret(id);
  }, [camera.homeMotion, camera.homeTracking, camera.state, camera.vision]);
  return null;
}
