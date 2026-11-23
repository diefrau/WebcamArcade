import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { visionProfile } from "./visionProfiles";
import { emptyHand, GestureInterpreter, type HandSample } from "./gestures";
import { useLocation } from "react-router-dom";
import {
  emptyFace,
  faceSample,
  type FaceMotionFrame,
  type FaceSample,
} from "./face";
import { emptyBody, bodySample, type BodySample } from "./body";
import { useInputEnvironment } from "../components/InputEnvironment";
import type { BodyCutoutFrame, CutoutState } from "./bodyCutout";
import type { HomeMotionFrame } from "./homeSecrets";

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
type HandFrameListener = (sample: HandSample) => void;
type CameraContextValue = {
  state: CameraState;
  vision: VisionState;
  stream: MediaStream | null;
  hand: HandSample;
  face: FaceSample;
  body: BodySample;
  bodyCutout: RefObject<BodyCutoutFrame | null>;
  cutoutState: CutoutState;
  homeTracking: boolean;
  homeMotion: HomeMotionFrame | null;
  tracking: "hand" | "face" | "body";
  shotSequence: number;
  subscribeGameHand: (listener: HandFrameListener) => () => void;
  subscribeFaceMotion: (
    listener: (frame: FaceMotionFrame | null) => void,
  ) => () => void;
  sourceVideo: RefObject<HTMLVideoElement | null>;
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
  const routeLocation = useLocation();
  const path = routeLocation.pathname;
  const { compactTouch } = useInputEnvironment();
  const homeTracking = path === "/" && !compactTouch;
  const [homeMotion, setHomeMotion] = useState<HomeMotionFrame | null>(null);
  const profile = visionProfile(path, routeLocation.search);
  const pipelineEnabled = profile.detector !== null;
  const segmentation = profile.segmentation;
  const faceGeometry = profile.faceGeometry === true;
  const faceAim = profile.faceAim === true;
  const sourceVideo = useRef<HTMLVideoElement | null>(null);
  const latestFaceMotion = useRef<FaceMotionFrame | null>(null);
  const faceMotionListeners = useRef(
    new Set<(frame: FaceMotionFrame | null) => void>(),
  );
  const publishFaceMotion = useCallback((frame: FaceMotionFrame | null) => {
    latestFaceMotion.current = frame;
    for (const listener of faceMotionListeners.current) listener(frame);
  }, []);
  const subscribeFaceMotion = useCallback(
    (listener: (frame: FaceMotionFrame | null) => void) => {
      const listeners = faceMotionListeners.current;
      listeners.add(listener);
      listener(latestFaceMotion.current);
      return () => {
        listeners.delete(listener);
      };
    },
    [],
  );
  const bodyCutout = useRef<BodyCutoutFrame | null>(null);
  const [cutoutState, setCutoutState] = useState<CutoutState>("idle");
  const clearCutout = useCallback(() => {
    bodyCutout.current?.bitmap.close();
    bodyCutout.current = null;
  }, []);
  const tracking = profile.detector ?? "hand";
  const [body, setBody] = useState<BodySample>(emptyBody);
  const [face, setFace] = useState<FaceSample>(emptyFace);
  const [state, setState] = useState<CameraState>("idle");
  const [vision, setVision] = useState<VisionState>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hand, setHand] = useState({ ...emptyHand });
  const latestHand = useRef<HandSample>(emptyHand);
  const gameHands = useRef(new Set<HandFrameListener>());
  const publishHand = useCallback((sample: HandSample) => {
    const detectionChanged = latestHand.current.detected !== sample.detected;
    latestHand.current = sample;
    // During direct game input, React only needs tracking status. The game reads every sample.
    if (!gameHands.current.size || detectionChanged) setHand(sample);
    for (const listener of gameHands.current) listener(sample);
  }, []);
  const subscribeGameHand = useCallback((listener: HandFrameListener) => {
    const listeners = gameHands.current;
    listeners.add(listener);
    listener(latestHand.current);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) setHand(latestHand.current);
    };
  }, []);
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
    clearCutout();
    setCutoutState("idle");
    setStream(null);
    setState("idle");
    setVision("idle");
    publishHand(emptyHand);
    setFace({ ...emptyFace });
    publishFaceMotion(null);
    setBody({ ...emptyBody });
    setHomeMotion(null);
  }, [clearCutout, publishFaceMotion, publishHand]);
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
    clearCutout();
    publishFaceMotion(null);
    setCutoutState(stream && segmentation ? "loading" : "idle");
    if (!stream || !pipelineEnabled) {
      publishHand(emptyHand);
      setFace({ ...emptyFace });
      setBody({ ...emptyBody });
      setHomeMotion(null);
      setVision("idle");
      return;
    }
    let disposed = false,
      worker: Worker | undefined,
      raf = 0,
      busy = false,
      lastFrame = -1,
      lastRun = 0,
      cutoutInterval = 84;
    let startupTimer: ReturnType<typeof setTimeout>;
    let frameTimer: ReturnType<typeof setTimeout>;
    let staleTimer: ReturnType<typeof setTimeout>;
    const gesture = new GestureInterpreter();
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    sourceVideo.current = video;
    video.className = "vision-source";
    video.setAttribute("aria-hidden", "true");
    document.body.append(video);
    const invalidateTracking = () => {
      if (disposed) return;
      gesture.reset();
      clearCutout();
      publishHand(emptyHand);
      setFace({ ...emptyFace });
      publishFaceMotion(null);
      setBody({ ...emptyBody });
      setHomeMotion(null);
    };
    const fail = () => {
      if (disposed) return;
      setVision("error");
      setCutoutState(segmentation ? "unavailable" : "idle");
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
        time - lastRun <
          (segmentation ? cutoutInterval : homeTracking ? 84 : 42)
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
        publishHand(emptyHand);
        setFace({ ...emptyFace });
        setBody({ ...emptyBody });
        setHomeMotion(null);
        worker =
          tracking === "body"
            ? new Worker(new URL("./body.worker.ts", import.meta.url), {
                type: "module",
              })
            : tracking === "face"
              ? new Worker(new URL("./face.worker.ts", import.meta.url), {
                  type: "module",
                })
              : homeTracking
                ? new Worker(new URL("./home.worker.ts", import.meta.url), {
                    type: "module",
                  })
                : new Worker(new URL("./hand.worker.ts", import.meta.url), {
                    type: "module",
                  });
        startupTimer = setTimeout(fail, 30000);
        worker.onerror = fail;
        worker.onmessage = (event) => {
          if (disposed) {
            event.data.cutout?.close();
            return;
          }
          if (event.data.type === "ready") {
            clearTimeout(startupTimer);
            setVision("ready");
            if (segmentation && event.data.segmentation === false)
              setCutoutState("unavailable");
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
            if (homeTracking) {
              const points = fresh ? event.data.face : undefined;
              const sample = faceSample(
                points,
                event.data.time,
                event.data.aspect,
              );
              setFace(sample);
              setHomeMotion(
                fresh
                  ? {
                      time: event.data.time,
                      aspect: event.data.aspect || 4 / 3,
                      hands: event.data.hands || (landmarks ? [landmarks] : []),
                      face: sample.detected ? points : [],
                      expressions: event.data.expressions || {},
                    }
                  : null,
              );
            }
            if (fresh) staleTimer = setTimeout(invalidateTracking, 900 - age);
            if (tracking === "body") {
              clearCutout();
              if (segmentation) {
                // Back off on slow devices; never enqueue inference frames.
                cutoutInterval = Math.min(200, Math.max(84, age * 1.15));
                if (fresh && event.data.cutout && landmarks) {
                  bodyCutout.current = {
                    bitmap: event.data.cutout,
                    landmarks,
                    time: event.data.time,
                  };
                  setCutoutState("ready");
                } else {
                  event.data.cutout?.close();
                  if (event.data.segmentation === false)
                    setCutoutState("unavailable");
                }
              } else event.data.cutout?.close();
              setBody(
                bodySample(landmarks, event.data.time, event.data.aspect),
              );
              return;
            }
            if (tracking === "face") {
              if (faceGeometry) {
                const box = fresh ? event.data.box : null;
                const frame: FaceMotionFrame | null = box
                  ? { box, aim: event.data.aim, time: event.data.time }
                  : null;
                const detected = Boolean(frame);
                if (Boolean(latestFaceMotion.current) !== detected)
                  setFace({ ...emptyFace, detected, time: event.data.time });
                publishFaceMotion(frame);
                return;
              }
              setFace(
                faceSample(landmarks, event.data.time, event.data.aspect),
              );
              return;
            }
            const next = gesture.update(
              landmarks,
              event.data.time,
              event.data.aspect,
              event.data.handedness,
            );
            publishHand(next);
            if (next.fire) setShotSequence((sequence) => sequence + 1);
          }
        };
        worker.postMessage({
          type: "init",
          home: homeTracking,
          faceGeometry,
          faceAim,
          segmentation,
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
      clearCutout();
      video.pause();
      video.srcObject = null;
      if (sourceVideo.current === video) sourceVideo.current = null;
      video.remove();
    };
  }, [
    stream,
    attempt,
    disconnect,
    tracking,
    homeTracking,
    pipelineEnabled,
    segmentation,
    faceGeometry,
    faceAim,
    clearCutout,
    publishFaceMotion,
    publishHand,
  ]);
  return (
    <CameraContext.Provider
      value={{
        state,
        vision,
        stream,
        hand,
        face,
        body,
        bodyCutout,
        cutoutState,
        homeTracking,
        homeMotion,
        tracking,
        shotSequence,
        subscribeGameHand,
        subscribeFaceMotion,
        sourceVideo,
        connect,
        disconnect,
        retryVision: () => setAttempt((value) => value + 1),
      }}
    >
      {children}
    </CameraContext.Provider>
  );
}
