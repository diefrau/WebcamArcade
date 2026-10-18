import { useEffect, useState } from "react";
import { useCamera } from "./CameraProvider";
import { useInputEnvironment } from "../components/InputEnvironment";

// Connecting the webcam also selects its controls, unless the player explicitly chooses mouse.
export function useGameInput() {
  const camera = useCamera();
  const { compactTouch } = useInputEnvironment();
  const [choice, setChoice] = useState<"mouse" | "hand" | null>(null);
  useEffect(() => {
    if (camera.stream)
      setChoice((current) => current ?? (compactTouch ? "mouse" : "hand"));
  }, [camera.stream, compactTouch]);
  const mode = choice ?? (camera.stream && !compactTouch ? "hand" : "mouse");
  return [mode, setChoice] as const;
}
