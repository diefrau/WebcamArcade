import { useEffect, useState } from "react";
import { useCamera } from "./CameraProvider";
import { useInputEnvironment } from "../components/InputEnvironment";

// Connecting the webcam also selects its controls, unless the player explicitly chooses mouse.
export function useGameInput({ preferCameraOnTouch = false } = {}) {
  const camera = useCamera();
  const { compactTouch } = useInputEnvironment();
  const [choice, setChoice] = useState<"mouse" | "hand" | null>(null);
  const defaultMode = !compactTouch || preferCameraOnTouch ? "hand" : "mouse";
  useEffect(() => {
    if (camera.stream) setChoice((current) => current ?? defaultMode);
  }, [camera.stream, defaultMode]);
  const mode = choice ?? (camera.stream ? defaultMode : "mouse");
  return [mode, setChoice] as const;
}
