import { test, expect } from "@playwright/test";
import { GestureInterpreter, type Landmark } from "../src/vision/gestures";

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

function landmarks(pinch: boolean, x = 0.5, y = 0.5): Landmark[] {
  const points = Array.from({ length: 21 }, () => ({ x, y, z: 0 }));
  points[5] = { x: x - 0.1, y, z: 0 };
  points[17] = { x: x + 0.1, y, z: 0 };
  points[4] = { x: x - 0.1, y: y - 0.2, z: 0 };
  points[8] = { x: x + (pinch ? -0.08 : 0.1), y: y - 0.2, z: 0 };
  return points;
}

test("pinch needs an open hand, releases between shots, and resets on lost detection", () => {
  const gesture = new GestureInterpreter();
  expect(gesture.update(landmarks(true), 0).fire).toBe(false);
  expect(gesture.update(landmarks(false), 20).fire).toBe(false);
  expect(gesture.update(landmarks(true), 100).fire).toBe(true);
  expect(gesture.update(landmarks(true), 900).fire).toBe(false);
  gesture.update(landmarks(false), 1000);
  expect(gesture.update(landmarks(true), 1100).fire).toBe(true);
  gesture.update(undefined, 1300);
  expect(gesture.update(landmarks(true), 1500).fire).toBe(false);
  expect(gesture.update(landmarks(false, 0.8), 1600).x).toBeLessThan(0.5);
});

test("camera is opt-in, real worker loads local model, navigation reuses stream, disconnect stops it", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  expect(
    await page
      .locator("video")
      .evaluateAll((elements) =>
        elements.every((el) => (el as HTMLVideoElement).srcObject === null),
      ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "카메라 연결", exact: true })
    .first()
    .click();
  await expect(page.locator(".webcam-frame")).toHaveClass(/is-live/, {
    timeout: 15000,
  });
  await expect(page.locator(".camera-note")).toContainText(
    "손바닥을 카메라에 보여주세요!",
    { timeout: 40000 },
  );
  const track = await page
    .locator(".camera-video")
    .evaluateHandle((el) =>
      (el as HTMLVideoElement).srcObject instanceof MediaStream
        ? (
            (el as HTMLVideoElement).srcObject as MediaStream
          ).getVideoTracks()[0]
        : null,
    );
  const id = await track.evaluate((track) => track!.id);
  await page.getByRole("button", { name: "게임 시작!" }).click();
  await page.getByRole("link", { name: "쏴! 지금 플레이!" }).click();
  await expect(page.locator(".webcam-frame")).toHaveClass(/is-live/);
  expect(
    await page
      .locator(".camera-video")
      .evaluate(
        (el) =>
          (
            (el as HTMLVideoElement).srcObject as MediaStream
          ).getVideoTracks()[0].id,
      ),
  ).toBe(id);
  await page.getByRole("button", { name: "카메라 끄기", exact: true }).click();
  expect(await track.evaluate((track) => track!.readyState)).toBe("ended");
  await expect(page.locator(".webcam-frame")).not.toHaveClass(/is-live/);
});

test("denied permission stays honest and mouse game remains playable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("denied", "NotAllowedError");
    };
  });
  await page.goto("/play/shoot");
  await page
    .getByRole("button", { name: "손으로 플레이", exact: true })
    .click();
  await expect(page.locator(".camera-empty h3")).toHaveText(
    "카메라 사용이 허용되지 않았어요",
  );
  await expect(
    page.getByRole("button", { name: "시작!", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "마우스로 계속", exact: true })
    .click();
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  await page.getByTestId("target-1").click();
  await expect(page.locator(".hud-panel").first()).toContainText("100");
});

test("hand aim and pinch enter the game, held pinch does not repeat, lost hand pauses", async ({
  page,
}) => {
  await page.addInitScript(() => {
    // Replace only the inference worker; camera lifecycle and gesture interpretation remain real.
    const OriginalWorker = window.Worker;
    window.Worker = class extends EventTarget {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror = null;
      listener = (event: Event) => {
        const data = (event as CustomEvent).detail;
        this.onmessage?.(
          new MessageEvent("message", {
            data: {
              type: "result",
              landmarks: data,
              time: performance.now(),
              aspect: 4 / 3,
            },
          }),
        );
      };
      constructor(url: string | URL, options?: WorkerOptions) {
        super();
        if (!String(url).includes("hand.worker"))
          return new OriginalWorker(url, options) as unknown as typeof this;
        window.addEventListener("test-hand", this.listener);
      }
      postMessage(message: { type: string; bitmap?: ImageBitmap }) {
        if (message.type === "init")
          setTimeout(
            () =>
              this.onmessage?.(
                new MessageEvent("message", { data: { type: "ready" } }),
              ),
            0,
          );
        if (message.type === "frame") message.bitmap?.close();
      }
      terminate() {
        window.removeEventListener("test-hand", this.listener);
      }
    } as unknown as typeof Worker;
  });
  await page.goto("/play/shoot");
  await page
    .getByRole("button", { name: "손으로 플레이", exact: true })
    .click();
  await expect(page.locator(".webcam-frame")).toHaveClass(/is-live/);
  await expect(page.locator(".camera-note")).toContainText(
    "손바닥을 카메라에 보여주세요!",
  );
  const target = await page.getByTestId("target-2").boundingBox();
  const field = await page.locator(".playfield").boundingBox();
  const x =
    1 -
    (0.12 + ((target!.x + target!.width / 2 - field!.x) / field!.width) * 0.76);
  const y =
    0.12 + ((target!.y + target!.height / 2 - field!.y) / field!.height) * 0.76;
  const send = async (pinch: boolean) =>
    page.evaluate(
      (points) =>
        window.dispatchEvent(new CustomEvent("test-hand", { detail: points })),
      landmarks(pinch, x, y),
    );
  await send(false);
  await expect(
    page.getByRole("button", { name: "시작!", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  await send(true);
  await expect(page.locator(".hud-panel").first()).toContainText("100");
  await send(true);
  await send(true);
  await expect(page.locator(".hud-panel").first()).toContainText("100");
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("test-hand", { detail: undefined })),
  );
  await expect(
    page.getByRole("heading", { name: "잠깐 쉬어갈까?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "계속하기", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "잠깐 쉬어갈까?" }),
  ).toBeVisible();
});

test("model download failure offers retry and preserves mouse fallback", async ({
  page,
}) => {
  await page.route("**/vision/hand_landmarker.task", (route) => route.abort());
  await page.goto("/play/shoot");
  await page
    .getByRole("button", { name: "손으로 플레이", exact: true })
    .click();
  await expect(page.locator(".camera-note")).toContainText(
    "손 인식을 쉬고 있어요",
    { timeout: 40000 },
  );
  await page
    .getByRole("button", { name: "마우스로 계속", exact: true })
    .click();
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  await page.getByTestId("target-1").click();
  await expect(page.locator(".hud-panel").first()).toContainText("100");
  await page.unroute("**/vision/hand_landmarker.task");
  await page.getByRole("button", { name: "다시 연결", exact: true }).click();
  await expect(page.locator(".camera-note")).toContainText(
    "손바닥을 카메라에 보여주세요!",
    { timeout: 40000 },
  );
});

test("canceling a pending permission request stops a late-arriving stream", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = window as unknown as {
      resolveCamera: () => void;
      lateTrack: MediaStreamTrack;
    };
    navigator.mediaDevices.getUserMedia = () =>
      new Promise((resolve) => {
        state.resolveCamera = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 100;
          canvas.height = 100;
          canvas.getContext("2d")!.fillRect(0, 0, 100, 100);
          const media = canvas.captureStream(1);
          state.lateTrack = media.getVideoTracks()[0];
          resolve(media);
        };
      });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "카메라 연결", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.evaluate(() =>
    (window as unknown as { resolveCamera: () => void }).resolveCamera(),
  );
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { lateTrack: MediaStreamTrack }).lateTrack
          .readyState,
    ),
  ).toBe("ended");
  await expect(page.locator(".webcam-frame")).not.toHaveClass(/is-live/);
});

test("circle webcam connection selects hand input, draws and preserves path on tracking loss", async ({
  page,
}) => {
  await page.addInitScript(() => {
    // Replace only the inference worker; camera lifecycle and gesture interpretation remain real.
    const OriginalWorker = window.Worker;
    window.Worker = class extends EventTarget {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror = null;
      listener = (event: Event) => {
        const data = (event as CustomEvent).detail;
        this.onmessage?.(
          new MessageEvent("message", {
            data: {
              type: "result",
              landmarks: data,
              time: performance.now(),
              aspect: 4 / 3,
            },
          }),
        );
      };
      constructor(url: string | URL, options?: WorkerOptions) {
        super();
        if (!String(url).includes("hand.worker"))
          return new OriginalWorker(url, options) as unknown as typeof this;
        window.addEventListener("test-hand", this.listener);
      }
      postMessage(message: { type: string; bitmap?: ImageBitmap }) {
        if (message.type === "init")
          setTimeout(
            () =>
              this.onmessage?.(
                new MessageEvent("message", { data: { type: "ready" } }),
              ),
            0,
          );
        if (message.type === "frame") message.bitmap?.close();
      }
      terminate() {
        window.removeEventListener("test-hand", this.listener);
      }
    } as unknown as typeof Worker;
  });

  await page.goto("/play/circle");
  await page.getByRole("button", { name: "카메라 연결", exact: true }).click();
  await expect(page.locator(".camera-note")).toContainText(
    "손바닥을 카메라에 보여주세요!",
  );
  await expect(
    page.getByRole("button", { name: "손가락 그리기", exact: true }),
  ).toHaveClass(/active/);
  const send = async (x: number, y: number) =>
    page.evaluate(
      (points) =>
        window.dispatchEvent(new CustomEvent("test-hand", { detail: points })),
      landmarks(false, x, y),
    );
  await send(0.5, 0.5);
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  for (let i = 0; i <= 32; i++) {
    const a = (i * Math.PI * 2) / 32;
    await send(0.5 + Math.cos(a) * 0.18, 0.65 + Math.sin(a) * 0.18);
  }
  const count = await page.locator(".circle-score b").textContent();
  expect(Number(count)).toBeGreaterThan(18);
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("test-hand", { detail: undefined })),
  );
  await expect(
    page.getByRole("heading", { name: "잠깐 쉬어갈까?" }),
  ).toBeVisible();
  const pausedCount = await page.locator(".circle-score b").textContent();
  const remaining = await page.locator(".circle-timer b").textContent();
  await page.waitForTimeout(1100);
  await expect(page.locator(".circle-timer b")).toHaveText(remaining!);
  await expect(page.locator(".circle-score b")).toHaveText(pausedCount!);
  await send(0.68, 0.65);
  await page.getByRole("button", { name: "계속하기", exact: true }).click();
  await page.getByRole("button", { name: "그리기 완료", exact: true }).click();
  await expect(page).toHaveURL(/result\/circle$/);
});
