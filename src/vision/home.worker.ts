import type { Landmark } from "./gestures";
type Result = {
  type: string;
  time: number;
  landmarks?: Landmark[];
  hands?: Landmark[][];
  expressions?: Record<string, number>;
  message?: string;
};
let hands: Worker | undefined, face: Worker | undefined;
let ready = 0;
let pending: {
  time: number;
  aspect: number;
  hands?: Result;
  face?: Result;
} | null = null;
const fail = (message: string) => {
  hands?.terminate();
  face?.terminate();
  pending = null;
  self.postMessage({ type: "error", message });
};
// Separate runtimes avoid MediaPipe's global WASM ModuleFactory collision.
// Merge only the two results belonging to the exact same camera frame.
self.onmessage = async ({ data: message }: MessageEvent) => {
  if (message.type === "init") {
    hands = new Worker(new URL("./hand.worker.ts", import.meta.url), {
      type: "module",
    });
    face = new Worker(new URL("./face.worker.ts", import.meta.url), {
      type: "module",
    });
    for (const [kind, worker] of [
      ["hands", hands],
      ["face", face],
    ] as const) {
      worker.onerror = () => fail(`${kind} worker failed`);
      worker.onmessage = ({ data: result }: MessageEvent<Result>) => {
        if (result.type === "error") {
          fail(result.message || `${kind} model failed`);
          return;
        }
        if (result.type === "ready") {
          ready++;
          if (ready === 2) self.postMessage({ type: "ready" });
          return;
        }
        if (
          result.type !== "result" ||
          !pending ||
          result.time !== pending.time
        )
          return;
        pending[kind] = result;
        if (pending.hands && pending.face) {
          self.postMessage({
            type: "result",
            time: pending.time,
            aspect: pending.aspect,
            landmarks: pending.hands.landmarks,
            hands: pending.hands.hands,
            face: pending.face.landmarks,
            expressions: pending.face.expressions || {},
          });
          pending = null;
        }
      };
      worker.postMessage({ ...message, home: true });
    }
  } else if (message.type === "frame") {
    const bitmap: ImageBitmap = message.bitmap;
    let copy: ImageBitmap | undefined;
    try {
      if (!hands || !face || pending) {
        bitmap.close();
        return;
      }
      copy = await createImageBitmap(bitmap);
      pending = { time: message.time, aspect: bitmap.width / bitmap.height };
      hands.postMessage({ type: "frame", bitmap, time: message.time }, [
        bitmap,
      ]);
      face.postMessage({ type: "frame", bitmap: copy, time: message.time }, [
        copy,
      ]);
    } catch (error) {
      bitmap.close();
      copy?.close();
      fail(String(error));
    }
  }
};
