import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
let detector: PoseLandmarker | undefined;
self.onmessage = async ({ data: message }: MessageEvent) => {
  try {
    if (message.type === "init") {
      const files = await FilesetResolver.forVisionTasks(
        `${message.base}vision/wasm`,
        true,
      );
      detector = await PoseLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${message.base}vision/pose_landmarker_lite.task`,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.6,
        minPosePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
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
