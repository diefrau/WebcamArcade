import { expect, test, type Page } from "@playwright/test";
import { GestureInterpreter, type Landmark } from "../src/vision/gestures";
import { faceDirection, faceSample } from "../src/vision/face";

function hand(pinched: boolean): Landmark[] {
  const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  points[5].x = 0.4;
  points[17].x = 0.6;
  points[4] = { x: 0.4, y: 0.3 };
  points[8] = { x: pinched ? 0.42 : 0.6, y: 0.3 };
  return points;
}

function face(): Landmark[] {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  points[33] = { x: 0.3, y: 0.4 };
  points[263] = { x: 0.7, y: 0.4 };
  points[1] = { x: 0.38, y: 0.55 };
  return points;
}

test("collapsed palm resets the pinch latch and requires reopening before a shot", () => {
  const gesture = new GestureInterpreter();
  gesture.update(hand(false), 0);
  const collapsed = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  expect(gesture.update(collapsed, 500)).toMatchObject({
    detected: false,
    pinched: false,
    fire: false,
  });
  expect(gesture.update(hand(true), 900).fire).toBe(false);
  gesture.update(hand(false), 1000);
  expect(gesture.update(hand(true), 1400).fire).toBe(true);
});

test("invalid hand geometry resets detection without leaking non-finite aim", () => {
  const gesture = new GestureInterpreter();
  const invalid = hand(false);
  invalid[8].x = Number.NaN;
  const sparse = new Array<Landmark>(21);
  for (const [points, time, aspect] of [
    [invalid, 100, 4 / 3],
    [sparse, 100, 4 / 3],
    [hand(false), Number.NaN, 4 / 3],
    [hand(false), 100, Number.POSITIVE_INFINITY],
    [hand(false), 100, 0],
  ] as const) {
    gesture.update(hand(false), 0);
    expect(gesture.update(points, time, aspect)).toMatchObject({
      detected: false,
      x: 0.5,
      y: 0.5,
      fire: false,
    });
    expect(gesture.update(hand(true), 500).fire).toBe(false);
  }
});

test("face coordinates retain their direction when the head image rolls", () => {
  const baseline = faceSample(face(), 100, 1);
  const angle = Math.PI / 7;
  const rotated = face().map(({ x, y }) => ({
    x:
      0.4 +
      (x - 0.5) * 0.7 * Math.cos(angle) -
      (y - 0.5) * 0.7 * Math.sin(angle),
    y:
      0.6 +
      (x - 0.5) * 0.7 * Math.sin(angle) +
      (y - 0.5) * 0.7 * Math.cos(angle),
  }));
  const next = faceSample(rotated, 200, 1);
  expect(next.detected).toBe(true);
  expect(next.x).toBeCloseTo(baseline.x);
  expect(next.y).toBeCloseTo(baseline.y);
  expect(faceDirection(next, { x: 0, y: baseline.y })).toBe("right");
});

test("invalid face geometry and calibration cannot create a false direction", () => {
  const collapsed = face();
  collapsed[263] = { ...collapsed[33] };
  const invalid = face();
  invalid[1].x = Number.POSITIVE_INFINITY;
  for (const [points, time, aspect] of [
    [collapsed, 100, 4 / 3],
    [invalid, 100, 4 / 3],
    [new Array<Landmark>(478), 100, 4 / 3],
    [face(), Number.NaN, 4 / 3],
    [face(), 100, Number.NaN],
    [face(), 100, -1],
  ] as const) {
    const sample = faceSample(points, time, aspect);
    expect(sample.detected).toBe(false);
    expect([sample.x, sample.y, sample.time].every(Number.isFinite)).toBe(true);
    expect(faceDirection(sample, { x: 0, y: 0 })).toBe("center");
  }
  const valid = faceSample(face(), 100);
  expect(faceDirection(valid, { x: Number.NaN, y: 0 })).toBe("center");
  expect(faceDirection({ ...valid, x: Number.NaN }, { x: 0, y: 0 })).toBe(
    "center",
  );
});

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

test.describe("stalled inference", () => {

  async function mockWorker(page: Page, points: Landmark[]) {
    await page.addInitScript((landmarks) => {
      const OriginalWorker = window.Worker;
      window.Worker = class extends EventTarget {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror = null;
        stalled = false;
        pending: { time: number } | undefined;
        emit = (frame: { time: number }) => {
          this.onmessage?.(
            new MessageEvent("message", {
              data: {
                type: "result",
                landmarks,
                time: frame.time,
                aspect: 4 / 3,
              },
            }),
          );
        };
        control = (event: Event) => {
          const action = (event as CustomEvent).detail;
          if (action === "stall") this.stalled = true;
          else {
            if (action === "recover") this.stalled = false;
            const frame = this.pending;
            this.pending = undefined;
            if (frame) this.emit(frame);
          }
        };
        constructor(url: string | URL, options?: WorkerOptions) {
          super();
          if (!/hand\.worker|face\.worker/.test(String(url)))
            return new OriginalWorker(url, options) as unknown as typeof this;
          window.addEventListener("test-inference", this.control);
        }
        postMessage(message: {
          type: string;
          time: number;
          bitmap?: ImageBitmap;
        }) {
          if (message.type === "init")
            setTimeout(
              () =>
                this.onmessage?.(
                  new MessageEvent("message", {
                    data: { type: "ready" },
                  }),
                ),
              0,
            );
          if (message.type === "frame") {
            message.bitmap?.close();
            if (this.stalled) this.pending = message;
            else setTimeout(() => this.emit(message), 0);
          }
        }
        terminate() {
          window.removeEventListener("test-inference", this.control);
        }
      } as unknown as typeof Worker;
    }, points);
  }

  const control = (page: Page, action: "stall" | "old" | "recover") =>
    page.evaluate(
      (detail) =>
        window.dispatchEvent(new CustomEvent("test-inference", { detail })),
      action,
    );

  test("hand samples expire, old results cannot resume, and retry keeps the camera stream", async ({
    page,
  }) => {
    await mockWorker(page, hand(false));
    await page.goto("/play/shoot");
    await page
      .getByRole("button", { name: "손으로 플레이", exact: true })
      .click();
    await expect(page.locator(".camera-note")).toContainText("손 인식 완료");
    const streamId = await page
      .locator(".camera-video")
      .evaluate(
        (video) =>
          (
            (video as HTMLVideoElement).srcObject as MediaStream
          ).getVideoTracks()[0].id,
      );
    await page.getByRole("button", { name: "시작!", exact: true }).click();
    await control(page, "stall");
    await expect(page.locator(".camera-note")).toContainText(
      "손바닥을 카메라",
      { timeout: 2000 },
    );
    await expect(
      page.getByRole("heading", { name: "잠깐 쉬어갈까?" }),
    ).toBeVisible({ timeout: 1500 });
    await expect(
      page.getByRole("button", { name: "계속하기", exact: true }),
    ).toBeDisabled();
    await control(page, "old");
    await page.waitForTimeout(150);
    await expect(page.locator(".camera-note")).toContainText("손바닥을 카메라");
    await control(page, "recover");
    await expect(
      page.getByRole("button", { name: "계속하기", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "계속하기", exact: true }).click();
    await expect(page.locator(".hud-panel").first()).toContainText("0");
    await control(page, "stall");
    await expect(page.locator(".camera-note")).toContainText(
      "손 인식을 쉬고 있어요",
      { timeout: 7000 },
    );
    await page.getByRole("button", { name: "다시 연결", exact: true }).click();
    await expect(page.locator(".camera-note")).toContainText("손 인식 완료");
    expect(
      await page.locator(".camera-video").evaluate((video) => {
        const track = (
          (video as HTMLVideoElement).srcObject as MediaStream
        ).getVideoTracks()[0];
        return { id: track.id, state: track.readyState };
      }),
    ).toEqual({ id: streamId, state: "live" });
    await expect(
      page.getByRole("button", { name: "계속하기", exact: true }),
    ).toBeEnabled();
  });

  test("face samples expire during a round and fresh inference restores calibrated controls", async ({
    page,
  }) => {
    await mockWorker(page, face());
    await page.goto("/play/cham");
    await page
      .getByRole("button", { name: "얼굴로 플레이", exact: true })
      .click();
    await expect(page.locator(".camera-note")).toContainText("얼굴 인식 완료");
    await page.getByRole("button", { name: "정면 보정", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "시작!", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "시작!", exact: true }).click();
    await control(page, "stall");
    await expect(page.locator(".camera-note")).toContainText("얼굴을 카메라", {
      timeout: 2000,
    });
    await expect(page.locator(".cham-cue")).toHaveAttribute(
      "data-phase",
      "paused",
    );
    await expect(
      page.getByRole("button", { name: "계속하기", exact: true }),
    ).toBeDisabled();
    await control(page, "old");
    await page.waitForTimeout(150);
    await expect(
      page.getByRole("button", { name: "계속하기", exact: true }),
    ).toBeDisabled();
    await control(page, "recover");
    await expect(
      page.getByRole("button", { name: "계속하기", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "계속하기", exact: true }).click();
    await expect(page.locator(".cham-cue")).toHaveAttribute(
      "data-phase",
      "countdown",
    );
  });
});
