import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
let detector: FaceLandmarker | undefined;
self.onmessage = async ({ data: message }: MessageEvent) => {
  try {
    if (message.type === "init") {
      const files = await FilesetResolver.forVisionTasks(
        `${message.base}vision/wasm`,
        true,
      );
      detector = await FaceLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${message.base}vision/face_landmarker.task`,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.6,
        minFacePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      self.postMessage({ type: "ready" });
    } else if (message.type === "frame") {
      const bitmap: ImageBitmap = message.bitmap;
      try {
        const result = detector?.detectForVideo(bitmap, message.time);
        self.postMessage({
          type: "result",
          landmarks: result?.faceLandmarks[0],
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
