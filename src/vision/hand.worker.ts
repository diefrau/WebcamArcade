import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
let detector: HandLandmarker | undefined;
self.onmessage = async (event: MessageEvent) => {
  const message = event.data;
  try {
    if (message.type === "init") {
      const files = await FilesetResolver.forVisionTasks(
        `${message.base}vision/wasm`,
        true,
      );
      detector = await HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${message.base}vision/hand_landmarker.task`,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
      });
      self.postMessage({ type: "ready" });
    } else if (message.type === "frame") {
      const bitmap: ImageBitmap = message.bitmap;
      try {
        const result = detector?.detectForVideo(bitmap, message.time);
        self.postMessage({
          type: "result",
          landmarks: result?.landmarks[0],
          time: message.time,
          aspect: bitmap.width / bitmap.height,
        });
      } finally {
        bitmap.close();
      }
    }
  } catch {
    self.postMessage({ type: "error" });
  }
};
