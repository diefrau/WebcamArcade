import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { emptyHand, GestureInterpreter, type HandSample } from "./gestures";
import { useLocation } from "react-router-dom";
import { emptyFace, faceSample, type FaceSample } from "./face";

export type CameraState =
  | "idle"
  | "requesting"
  | "connecting"
  | "ready"
  | "denied"
  | "missing"
  | "busy"
  | "error";
type VisionState = "idle" | "loading" | "ready" | "error";
type CameraContextValue = {
  state: CameraState;
  vision: VisionState;
  stream: MediaStream | null;
  hand: HandSample;
  face: FaceSample;
  tracking: "hand" | "face";
  shotSequence: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  retryVision: () => void;
};
const CameraContext = createContext<CameraContextValue | null>(null);
export function useCamera() {
  const value = useContext(CameraContext);
  if (!value) throw new Error("CameraProvider missing");
  return value;
}

export function CameraProvider({ children }: { children: ReactNode }) {
  const tracking = useLocation().pathname === "/play/cham" ? "face" : "hand";
  const [face, setFace] = useState<FaceSample>(emptyFace);
  const [state, setState] = useState<CameraState>("idle");
  const [vision, setVision] = useState<VisionState>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hand, setHand] = useState({ ...emptyHand });
  const [shotSequence, setShotSequence] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const activeStream = useRef<MediaStream | null>(null);
  const request = useRef(0);
  const pending = useRef(false);
  const disconnect = useCallback(() => {
    request.current++;
    pending.current = false;
    activeStream.current?.getTracks().forEach((track) => track.stop());
    activeStream.current = null;
    setStream(null);
    setState("idle");
    setVision("idle");
    setHand({ ...emptyHand });
    setFace({ ...emptyFace });
  }, []);
  const connect = useCallback(async () => {
    if (pending.current || activeStream.current) return;
    const id = ++request.current;
    pending.current = true;
    setState("requesting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
          frameRate: { ideal: 30, max: 30 },
        },
      });
      if (request.current !== id) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      activeStream.current = media;
      setState("connecting");
      setStream(media);
      media.getVideoTracks().forEach((track) =>
        track.addEventListener(
          "ended",
          () => {
            if (activeStream.current === media) {
              disconnect();
              setState("missing");
            }
          },
          { once: true },
        ),
      );
    } catch (error) {
      if (request.current !== id) return;
      const name = error instanceof DOMException ? error.name : "";
      setState(
        name === "NotAllowedError" || name === "SecurityError"
          ? "denied"
          : name === "NotFoundError"
            ? "missing"
            : name === "NotReadableError"
              ? "busy"
              : "error",
      );
    } finally {
      if (request.current === id) pending.current = false;
    }
  }, [disconnect]);
  useEffect(
    () => () => {
      request.current++;
      activeStream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  useEffect(() => {
    if (!stream) return;
    let disposed = false,
      worker: Worker | undefined,
      raf = 0,
      busy = false,
      lastFrame = -1,
      lastRun = 0;
    let startupTimer: ReturnType<typeof setTimeout>;
    let frameTimer: ReturnType<typeof setTimeout>;
    let staleTimer: ReturnType<typeof setTimeout>;
    const gesture = new GestureInterpreter();
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.className = "vision-source";
    video.setAttribute("aria-hidden", "true");
    document.body.append(video);
    const invalidateTracking = () => {
      if (disposed) return;
      gesture.reset();
      setHand({ ...emptyHand });
      setFace({ ...emptyFace });
    };
    const fail = () => {
      if (disposed) return;
      setVision("error");
      invalidateTracking();
      worker?.terminate();
      worker = undefined;
      cancelAnimationFrame(raf);
      clearTimeout(startupTimer);
      clearTimeout(frameTimer);
      clearTimeout(staleTimer);
    };
    const tick = async (time: number) => {
      if (disposed || !worker) return;
      raf = requestAnimationFrame(tick);
      if (document.hidden) {
        gesture.reset();
        return;
      }
      if (
        busy ||
        video.readyState < 2 ||
        video.currentTime === lastFrame ||
        time - lastRun < 42
      )
        return;
      busy = true;
      lastFrame = video.currentTime;
      lastRun = time;
      try {
        const bitmap = await createImageBitmap(video);
        if (disposed || !worker) {
          bitmap.close();
          return;
        }
        worker.postMessage({ type: "frame", bitmap, time }, [bitmap]);
        frameTimer = setTimeout(fail, 6000);
      } catch {
        fail();
      }
    };
    const start = async () => {
      try {
        await video.play();
        if (disposed) return;
        setState("ready");
        setVision("loading");
        setHand({ ...emptyHand });
        setFace({ ...emptyFace });
        worker =
          tracking === "face"
            ? new Worker(new URL("./face.worker.ts", import.meta.url), {
                type: "module",
              })
            : new Worker(new URL("./hand.worker.ts", import.meta.url), {
                type: "module",
              });
        startupTimer = setTimeout(fail, 30000);
        worker.onerror = fail;
        worker.onmessage = (event) => {
          if (disposed) return;
          if (event.data.type === "ready") {
            clearTimeout(startupTimer);
            setVision("ready");
            raf = requestAnimationFrame(tick);
          } else if (event.data.type === "error") fail();
          else if (event.data.type === "result") {
            busy = false;
            clearTimeout(frameTimer);
            clearTimeout(staleTimer);
            // A live camera does not guarantee live inference. Invalidate the
            // last pose quickly while allowing a slow worker to recover before
            // the existing six-second error/retry timeout.
            const age = performance.now() - event.data.time;
            const fresh =
              !document.hidden &&
              Number.isFinite(event.data.time) &&
              age >= 0 &&
              age < 900;
            const landmarks = fresh ? event.data.landmarks : undefined;
            if (fresh) staleTimer = setTimeout(invalidateTracking, 900 - age);
            if (tracking === "face") {
              setFace(
                faceSample(landmarks, event.data.time, event.data.aspect),
              );
              return;
            }
            const next = gesture.update(
              landmarks,
              event.data.time,
              event.data.aspect,
            );
            setHand(next);
            if (next.fire) setShotSequence((sequence) => sequence + 1);
          }
        };
        worker.postMessage({
          type: "init",
          base: new URL(import.meta.env.BASE_URL, location.href).href,
        });
      } catch {
        if (!disposed) {
          fail();
          disconnect();
          setState("error");
        }
      }
    };
    void start();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(startupTimer);
      clearTimeout(frameTimer);
      clearTimeout(staleTimer);
      worker?.terminate();
      video.pause();
      video.srcObject = null;
      video.remove();
    };
  }, [stream, attempt, disconnect, tracking]);
  return (
    <CameraContext.Provider
      value={{
        state,
        vision,
        stream,
        hand,
        face,
        tracking,
        shotSequence,
        connect,
        disconnect,
        retryVision: () => setAttempt((value) => value + 1),
      }}
    >
      {children}
    </CameraContext.Provider>
  );
}
