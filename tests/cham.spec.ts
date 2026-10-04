import { test, expect, type Page } from "@playwright/test";
import { faceSample, faceDirection, type Direction } from "../src/vision/face";
import { winsRound } from "../src/games/chamRules";

async function revealWithLoading(page: Page) {
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-state",
    "loading",
  );
  await page.clock.fastForward(3000);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-state",
    "exiting",
  );
  await page.clock.fastForward(600);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-ready",
    "true",
  );
}

function landmarks(x = 0, y = 0.25) {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  points[33] = { x: 0.3, y: 0.4 };
  points[263] = { x: 0.7, y: 0.4 };
  points[1] = { x: 0.5 - x * 0.4, y: 0.4 + (y * 0.4 * 4) / 3 };
  return points;
}
test("face directions ignore position and scale and reject absent faces", () => {
  const neutral = faceSample(landmarks(), 0);
  for (const [x, y, d] of [
    [-0.3, 0.25, "left"],
    [0.3, 0.25, "right"],
    [0, 0, "up"],
    [0, 0.5, "down"],
  ] as const) {
    expect(faceDirection(faceSample(landmarks(x, y), 1), neutral)).toBe(d);
    const shifted = landmarks(x, y).map((p) => ({
      x: p.x * 0.7 + 0.1,
      y: p.y * 0.7 + 0.2,
    }));
    expect(faceDirection(faceSample(shifted, 1), neutral)).toBe(d);
  }
  expect(faceDirection(neutral, neutral)).toBe("center");
  expect(faceSample(undefined, 0).detected).toBe(false);
  expect(faceSample([], 0).detected).toBe(false);
  expect(winsRound("left", "right")).toBe(true);
  expect(winsRound("left", "left")).toBe(false);
  expect(winsRound("left", null)).toBe(false);
});

test("ten rounds support buttons, timeout, pause, records and replay", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/games");
  await revealWithLoading(page);
  await page.getByRole("link", { name: "참!참!참! 지금 플레이!" }).click();
  await revealWithLoading(page);
  await page.screenshot({ path: "artifacts/cham-ready.png", fullPage: true });
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.clock.fastForward(5000);
  await expect(page.locator(".cham-cue")).toHaveAttribute(
    "data-phase",
    "paused",
  );
  await page.getByRole("button", { name: "계속하기", exact: true }).click();
  for (let i = 0; i < 10; i++) {
    await page.clock.fastForward(1500);
    const arrow = await page.getByTestId("cham-arrow").textContent();
    await expect(page.locator(".cham-stage progress")).toHaveAttribute(
      "max",
      "900",
    );
    if (i === 0) await page.clock.fastForward(900);
    else {
      const d = arrow === "←" ? "ArrowRight" : "ArrowLeft";
      await page.keyboard.press(d);
    }
    if (i === 1)
      await page.screenshot({
        path: "artifacts/cham-play.png",
        fullPage: true,
      });
    await expect(page.locator(".cham-cue")).toHaveAttribute(
      "data-phase",
      "feedback",
    );
    await page.clock.fastForward(1040);
  }
  await expect(page).toHaveURL(/result\/cham$/);
  await revealWithLoading(page);
  await page.clock.fastForward(900);
  await expect(page.locator(".result-stats")).toContainText("900");
  const record = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.cham")!),
  );
  expect(record.plays).toBe(1);
  expect(record.last.rounds).toHaveLength(10);
  await page.reload();
  await revealWithLoading(page);
  await page.clock.fastForward(900);
  await expect(page.locator(".result-stats")).toContainText("900");
  await page.screenshot({ path: "artifacts/cham-result.png", fullPage: true });
  await page.getByRole("link", { name: "다시 하기" }).click();
  await revealWithLoading(page);
  await expect(
    page.getByRole("button", { name: "시작!", exact: true }),
  ).toBeEnabled();
});

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});
test.describe("face camera", () => {
  async function mockFace(page: Page) {
    await page.addInitScript(() => {
      const OriginalWorker = window.Worker;
      window.Worker = class extends EventTarget {
        onmessage: ((e: MessageEvent) => void) | null = null;
        onerror = null;
        points: unknown;
        closed = false;
        listener = (e: Event) => {
          this.points = (e as CustomEvent).detail;
        };
        constructor(url: string | URL, options?: WorkerOptions) {
          super();
          if (!String(url).includes("face.worker"))
            return new OriginalWorker(url, options) as unknown as typeof this;
          window.addEventListener("test-face", this.listener);
        }
        postMessage(message: {
          type: string;
          bitmap?: ImageBitmap;
          time: number;
        }) {
          if (message.type === "init")
            setTimeout(
              () =>
                this.onmessage?.(
                  new MessageEvent("message", { data: { type: "ready" } }),
                ),
              0,
            );
          if (message.type === "frame") {
            message.bitmap?.close();
            setTimeout(() => {
              if (!this.closed)
                this.onmessage?.(
                  new MessageEvent("message", {
                    data: {
                      type: "result",
                      landmarks: this.points,
                      time: message.time,
                      aspect: 4 / 3,
                    },
                  }),
                );
            }, 0);
          }
        }
        terminate() {
          this.closed = true;
          window.removeEventListener("test-face", this.listener);
        }
      } as unknown as typeof Worker;
    });
  }
  const send = (page: Page, points: unknown) =>
    page.evaluate(
      (p) => window.dispatchEvent(new CustomEvent("test-face", { detail: p })),
      points,
    );
  test("calibrates, scores head movement, pauses on face loss, and resumes", async ({
    page,
  }) => {
    await mockFace(page);
    await page.goto("/play/cham");
    await page
      .getByRole("button", { name: "얼굴로 플레이", exact: true })
      .click();
    await expect(page.locator(".camera-note")).toContainText("얼굴을 카메라");
    await send(page, landmarks());
    await page.getByRole("button", { name: "정면 보정", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "시작!", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "시작!", exact: true }).click();
    await expect(page.getByTestId("cham-arrow")).toBeVisible();
    const arrow = await page.getByTestId("cham-arrow").textContent();
    await send(page, landmarks(arrow === "←" ? 0.3 : -0.3));
    await expect(page.locator(".cham-cue")).toContainText("+100");
    await send(page, undefined);
    await expect(
      page.getByRole("button", { name: "계속하기", exact: true }),
    ).toBeDisabled();
    await expect(page).toHaveURL(/play\/cham$/);
    await send(page, landmarks());
    await page.getByRole("button", { name: "계속하기", exact: true }).click();
    await expect(page.locator(".cham-rounds .won")).toHaveCount(1);
  });
  test("real face model loads locally and switching games restores hand tracking", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/play/cham");
    await page
      .getByRole("button", { name: "얼굴로 플레이", exact: true })
      .click();
    await expect(page.locator(".camera-note")).toContainText("얼굴을 카메라", {
      timeout: 40000,
    });
    await page.getByRole("link", { name: "뒤로" }).click();
    await page.getByRole("link", { name: "쏴! 지금 플레이!" }).click();
    await expect(page.locator(".camera-note")).toContainText(
      "손바닥을 카메라",
      { timeout: 40000 },
    );
  });
  test("face model failure can retry and buttons remain playable", async ({
    page,
  }) => {
    await page.route("**/vision/face_landmarker.task", (route) =>
      route.abort(),
    );
    await page.goto("/play/cham");
    await page
      .getByRole("button", { name: "얼굴로 플레이", exact: true })
      .click();
    await expect(page.locator(".camera-note")).toContainText(
      "얼굴 인식을 사용할 수 없어요",
    );
    await page.getByRole("button", { name: "버튼으로 계속" }).click();
    await expect(
      page.getByRole("button", { name: "시작!", exact: true }),
    ).toBeEnabled();
    await page.unroute("**/vision/face_landmarker.task");
    await page.getByRole("button", { name: "다시 연결", exact: true }).click();
    await expect(page.locator(".camera-note")).toContainText("얼굴을 카메라", {
      timeout: 40000,
    });
  });
});

test("mobile and English instructions fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/cham");
  await page.screenshot({ path: "artifacts/cham-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "한국어 / EN", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Buttons / keys" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
