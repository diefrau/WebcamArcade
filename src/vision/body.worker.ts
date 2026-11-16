import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { maskAlpha } from "./bodyCutout";
let detector: PoseLandmarker | undefined;
let segmentation = false;
let maskCanvas: OffscreenCanvas | undefined;
let maskPixels: ImageData | undefined;
let output: OffscreenCanvas | undefined;
self.onmessage = async ({ data: message }: MessageEvent) => {
  try {
    if (message.type === "init") {
      const files = await FilesetResolver.forVisionTasks(
        `${message.base}vision/wasm`,
        true,
      );
      segmentation = message.segmentation === true;
      const options = {
        baseOptions: {
          modelAssetPath: `${message.base}vision/pose_landmarker_lite.task`,
          delegate: "CPU" as const,
        },
        runningMode: "VIDEO" as const,
        numPoses: 1,
        minPoseDetectionConfidence: 0.6,
        minPosePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      };
      try {
        detector = await PoseLandmarker.createFromOptions(files, {
          ...options,
          outputSegmentationMasks: segmentation,
        });
      } catch (error) {
        if (!segmentation) throw error;
        segmentation = false;
        detector = await PoseLandmarker.createFromOptions(files, options);
      }
      self.postMessage({ type: "ready", segmentation });
    } else if (message.type === "frame") {
      const bitmap: ImageBitmap = message.bitmap;
      let disableSegmentation = false;
      try {
        detector?.detectForVideo(bitmap, message.time, (result) => {
          let cutout: ImageBitmap | undefined;
          const mask = result.segmentationMasks?.[0];
          if (segmentation && mask && result.landmarks[0]) {
            try {
              // Reuse two small canvases. No extra model, raw-frame queue or mask copies.
              if (
                !maskCanvas ||
                maskCanvas.width !== mask.width ||
                maskCanvas.height !== mask.height
              ) {
                maskCanvas = new OffscreenCanvas(mask.width, mask.height);
                maskPixels = undefined;
              }
              const ctx = maskCanvas.getContext("2d")!;
              if (!maskPixels) {
                maskPixels = ctx.createImageData(mask.width, mask.height);
                // RGB stays constant. Subsequent frames update only alpha.
                maskPixels.data.fill(255);
              }
              const confidence = mask.getAsFloat32Array();
              for (let i = 0; i < confidence.length; i++) {
                maskPixels.data[i * 4 + 3] = maskAlpha(confidence[i]);
              }
              ctx.putImageData(maskPixels, 0, 0);
              const width = Math.min(512, bitmap.width),
                height = Math.round((width * bitmap.height) / bitmap.width);
              if (!output || output.width !== width || output.height !== height)
                output = new OffscreenCanvas(width, height);
              const out = output.getContext("2d")!;
              out.clearRect(0, 0, width, height);
              out.globalCompositeOperation = "source-over";
              out.drawImage(bitmap, 0, 0, width, height);
              out.globalCompositeOperation = "destination-in";
              out.drawImage(maskCanvas, 0, 0, width, height);
              out.globalCompositeOperation = "source-over";
              cutout = output.transferToImageBitmap();
            } catch {
              // Optional visual effect must not stop the pose game.
              segmentation = false;
              disableSegmentation = true;
            }
          }
          self.postMessage(
            {
              type: "result",
              landmarks: result.landmarks[0],
              time: message.time,
              aspect: bitmap.width / bitmap.height,
              segmentation: segmentation && (!result.landmarks[0] || !!mask),
              cutout,
            },
            { transfer: cutout ? [cutout] : [] },
          );
        });
        if (disableSegmentation) {
          // Reconfigure after the callback releases its mask storage.
          await detector
            ?.setOptions({ outputSegmentationMasks: false })
            .catch(() => {});
        }
      } finally {
        bitmap.close();
      }
    }
  } catch {
    self.postMessage({ type: "error" });
  }
};
