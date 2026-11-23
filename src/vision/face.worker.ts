import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { faceAimSample, faceLandmarkBox } from "./face";
let detector: FaceLandmarker | undefined;
let faceGeometry = false;
let faceAim = false;
self.onmessage = async ({ data: message }: MessageEvent) => {
  try {
    if (message.type === "init") {
      faceGeometry = message.faceGeometry === true;
      faceAim = message.faceAim === true;
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
        outputFaceBlendshapes: !!message.home || faceAim,
        minFaceDetectionConfidence: 0.6,
        minFacePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      self.postMessage({ type: "ready" });
    } else if (message.type === "frame") {
      const bitmap: ImageBitmap = message.bitmap;
      try {
        const result = detector?.detectForVideo(bitmap, message.time);
        if (faceGeometry) {
          const points = result?.faceLandmarks[0];
          const box = faceLandmarkBox(points);
          const categories =
            faceAim && box ? result?.faceBlendshapes[0]?.categories : undefined;
          const aim = categories
            ? faceAimSample(
                points,
                bitmap.width / bitmap.height,
                categories.find(
                  (category) => category.categoryName === "jawOpen",
                )?.score,
              )
            : undefined;
          self.postMessage({ type: "result", box, aim, time: message.time });
          return;
        }
        self.postMessage({
          type: "result",
          landmarks: result?.faceLandmarks[0],
          expressions:
            message.home === false
              ? {}
              : Object.fromEntries(
                  (result?.faceBlendshapes[0]?.categories || []).map((c) => [
                    c.categoryName,
                    c.score,
                  ]),
                ),
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
