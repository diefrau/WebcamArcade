import { useMemo, useRef, useState, useEffect } from "react";
import { useCamera } from "../vision/CameraProvider";
import { visionSnapshot } from "../vision/visionSnapshot";
import { GatePoseTracker } from "./gatePose";
export function useGatePose(enabled: boolean) {
  const camera = useCamera(),
    tracker = useRef(new GatePoseTracker());
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    tracker.current.reset();
    setAttempt((v) => v + 1);
  }, [enabled]);
  const reading = useMemo(
    () =>
      tracker.current.update(
        visionSnapshot(camera, camera.body.time ?? -Infinity),
        performance.now(),
      ),
    [camera.body, camera.state, camera.vision, attempt],
  );
  const live = enabled && camera.state === "ready" && camera.vision === "ready";
  return {
    ...reading,
    ready: live && reading.ready,
    progress: live && reading.input.poseVector ? reading.progress : 0,
    input: {
      ...reading.input,
      poseVector: live ? reading.input.poseVector : null,
    },
    reset: () => {
      tracker.current.reset();
      setAttempt((v) => v + 1);
    },
    camera,
  };
}
