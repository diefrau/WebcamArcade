import { test, expect } from "@playwright/test";
import { GatePoseTracker } from "../src/input/gatePose";
import { mockPose, mockVision } from "../src/input/mockPose";
import { poseSimilarity } from "../src/vision/shared/poseNormalization";
import { adaptGameInput } from "../src/input/GameInputAdapter";
function points(left = 90, right = 90) {
  return mockPose(left, right).map((p) => ({
    ...p,
    x: 1 - (0.5 + (p.x - 0.5) / (4 / 3)),
  }));
}
function frame(time: number, left = 90, right = 90) {
  const s = mockVision(left, right, time);
  s.aspect = 4 / 3;
  s.pose.landmarks = points(left, right);
  return s;
}
test("pose readiness requires fresh visible joints, then canonical aspect and mirroring match mock", () => {
  const tracker = new GatePoseTracker();
  let r = tracker.update(frame(0), 0);
  expect(r.ready).toBe(false);
  for (let time = 100; time <= 1300; time += 100)
    r = tracker.update(frame(time, 90, 0), time);
  expect(r.ready).toBe(true);
  expect(
    poseSimilarity(
      r.input.poseVector,
      adaptGameInput(mockVision(90, 0), "mock").poseVector,
    ),
  ).toBe(100);
  const hidden = frame(1400);
  hidden.pose.landmarks[15].visibility = 0;
  expect(tracker.update(hidden, 1400).input.poseVector).toBeNull();
  expect(tracker.update(frame(1400), 2400).ready).toBe(false);
  tracker.reset();
  expect(tracker.update(frame(2500), 2500).ready).toBe(false);
});
test.use({
  reducedMotion: "reduce",
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});
test("webcam gate reuses pose worker, calibrates, pauses on missing arms and saves webcam record", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    window.Worker = class extends EventTarget {
      onmessage: ((event: MessageEvent) => void) | null = null;
      listener = (e: Event) =>
        this.onmessage?.(
          new MessageEvent("message", {
            data: {
              type: "result",
              landmarks: (e as CustomEvent).detail,
              time: performance.now(),
              aspect: 4 / 3,
            },
          }),
        );
      constructor(url: string | URL, options?: WorkerOptions) {
        super();
        if (!String(url).includes("body.worker"))
          return new OriginalWorker(url, options) as unknown as typeof this;
        window.addEventListener("test-body", this.listener);
      }
      postMessage(m: { type: string; bitmap?: ImageBitmap }) {
        if (m.type === "init")
          setTimeout(
            () =>
              this.onmessage?.(
                new MessageEvent("message", { data: { type: "ready" } }),
              ),
            0,
          );
        m.bitmap?.close();
      }
      terminate() {
        window.removeEventListener("test-body", this.listener);
      }
    } as unknown as typeof Worker;
  });
  await page.clock.install();
  await page.goto("/play/gate");
  const start = page.getByRole("button", { name: "시작!", exact: true });
  await expect(start).toHaveCount(0);
  await page
    .locator(".game-dialog")
    .getByRole("button", { name: "카메라 연결", exact: true })
    .click();
  await expect(page.locator(".webcam-frame")).toHaveClass(/is-live/);
  const send = async (left = 90, right = 90) =>
    page.evaluate(
      (p) => window.dispatchEvent(new CustomEvent("test-body", { detail: p })),
      points(left, right),
    );
  for (let i = 0; i < 25; i++) {
    await send();
    await page.clock.runFor(100);
  }
  await expect(page.locator(".gate-caption strong")).toHaveText(/[123]/);
  await expect(start).toHaveCount(0);
  for (let i = 0; i < 32; i++) {
    await send();
    await page.clock.runFor(100);
  }
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("test-body", { detail: undefined })),
  );
  await page.clock.runFor(850);
  await expect(
    page.getByRole("heading", { name: "잠깐 쉬어갈까?", exact: true }),
  ).toBeVisible();
  for (let i = 0; i < 45; i++) {
    await send();
    await page.clock.runFor(100);
  }
  await expect(
    page.getByRole("heading", { name: "잠깐 쉬어갈까?", exact: true }),
  ).toHaveCount(0);
  // An explicit pause stays paused while the same raised pose is held.
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  for (let i = 0; i < 15; i++) {
    await send();
    await page.clock.runFor(100);
  }
  await expect(
    page.getByRole("heading", { name: "잠깐 쉬어갈까?", exact: true }),
  ).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await send(-60, -60);
    await page.clock.runFor(100);
  }
  for (let i = 0; i < 45; i++) {
    await send();
    await page.clock.runFor(100);
  }
  await expect(
    page.getByRole("heading", { name: "잠깐 쉬어갈까?", exact: true }),
  ).toHaveCount(0);
  const poses = [
    [90, 90],
    [0, 0],
    [90, 0],
    [0, 90],
    [45, 45],
  ];
  for (let i = 0; i < 260 && !page.url().includes("/result/"); i++) {
    const label = await page.locator(".cham-toolbar strong").textContent();
    const round = Number(label?.match(/\d+/)?.[0] ?? 1);
    await send(...(poses[round - 1] as [number, number]));
    await page.clock.runFor(100);
  }
  await expect(page).toHaveURL(/result\/gate\?input=vision/);
  const saved = await page.evaluate(() => ({
    vision: JSON.parse(localStorage.getItem("arcade.gate.vision") || "null"),
    mock: localStorage.getItem("arcade.gate.prototype"),
  }));
  expect(saved.vision.last.source).toBe("vision");
  expect(saved.vision.last.outcomes).toHaveLength(5);
  expect(saved.vision.last.score).toBe(1500);
  expect(saved.mock).toBeNull();
});
test("camera denial keeps start gated and allows mock fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("denied", "NotAllowedError");
    };
  });
  await page.goto("/play/gate");
  await page
    .locator(".game-dialog")
    .getByRole("button", { name: "카메라 연결", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "시작!", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "체험 입력", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "시작!", exact: true }),
  ).toBeEnabled();
});

test("gate loads one existing pose model and preserves camera permission across profile changes", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    (window as any).cameraRequests = 0;
    navigator.mediaDevices.getUserMedia = (constraints) => {
      (window as any).cameraRequests++;
      return original(constraints);
    };
  });
  const models: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("pose_landmarker_lite.task") && r.ok())
      models.push(r.url());
  });
  await page.goto("/play/gate");
  await page
    .locator(".game-dialog")
    .getByRole("button", { name: "카메라 연결", exact: true })
    .click();
  await expect(page.locator(".camera-note")).toContainText("어깨가 모두", {
    timeout: 40000,
  });
  expect(models).toHaveLength(1);
  await page.getByRole("link", { name: /뒤로/ }).click();
  await page.getByRole("link", { name: "빨리 피해! 지금 플레이!" }).click();
  await expect(page.locator(".camera-note")).toContainText("어깨가 모두", {
    timeout: 40000,
  });
  expect(models).toHaveLength(2);
  expect(await page.evaluate(() => (window as any).cameraRequests)).toBe(1);
});
