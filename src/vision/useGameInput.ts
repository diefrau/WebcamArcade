import { useEffect, useState } from "react";
import { useCamera } from "./CameraProvider";

// Connecting the webcam also selects its controls, unless the player explicitly chooses mouse.
export function useGameInput() {
  const camera = useCamera();
  const [choice, setChoice] = useState<"mouse" | "hand" | null>(null);
  useEffect(() => {
    if (camera.stream) setChoice((current) => current ?? "hand");
  }, [camera.stream]);
  const mode = choice ?? (camera.stream ? "hand" : "mouse");
  return [mode, setChoice] as const;
}
