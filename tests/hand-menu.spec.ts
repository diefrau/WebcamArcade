import { test, expect } from "@playwright/test";

test.use({
  reducedMotion: "reduce",
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    window.Worker = class extends EventTarget {
      onmessage: ((event: MessageEvent) => void) | null = null;
      listener = (event: Event) =>
        this.onmessage?.(
          new MessageEvent("message", {
            data: {
              type: "result",
              landmarks: (event as CustomEvent).detail,
              time: performance.now(),
              aspect: 4 / 3,
            },
          }),
        );
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
        message.bitmap?.close();
      }
      terminate() {
        window.removeEventListener("test-hand", this.listener);
      }
    } as unknown as typeof Worker;
  });
});

for (const game of ["shoot", "circle", "rps"]) {
  test(`${game}: hand cursor pinches start and resume without leaking the click into gameplay`, async ({
    page,
  }) => {
    await page.goto(`/play/${game}`);
    await page
      .getByRole("button", { name: "카메라 연결", exact: true })
      .click();
    await expect(page.locator(".camera-note")).toContainText(
      "손바닥을 카메라에 보여주세요!",
    );
    await page.evaluate(() => document.fonts.ready);
    const button = page.locator(".arcade-button[data-hand-click]");
    const box = await button.boundingBox();
    const viewport = page.viewportSize()!;
    let x = 1 - (0.12 + ((box!.x + box!.width / 2) / viewport.width) * 0.76);
    let y = 0.12 + ((box!.y + box!.height / 2) / viewport.height) * 0.76;
    const send = (pinch: boolean) =>
      page.evaluate(
        ({ x, y, pinch }) => {
          const points = Array.from({ length: 21 }, () => ({ x, y, z: 0 }));
          points[5].x -= 0.1;
          points[17].x += 0.1;
          points[4] = { x: x - 0.1, y: y - 0.2, z: 0 };
          points[8] = { x: x + (pinch ? -0.08 : 0.1), y: y - 0.2, z: 0 };
          window.dispatchEvent(
            new CustomEvent("test-hand", { detail: points }),
          );
        },
        { x, y, pinch },
      );
    // Entering with a closed pinch must not activate anything.
    await send(true);
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    // Recognition replaces the ready guidance and can move the start button.
    const readyBox = await button.boundingBox();
    x =
      1 -
      (0.12 + ((readyBox!.x + readyBox!.width / 2) / viewport.width) * 0.76);
    y = 0.12 + ((readyBox!.y + readyBox!.height / 2) / viewport.height) * 0.76;
    for (let i = 0; i < 5; i++) await send(false);
    await expect(button).toHaveClass(/hand-hovered/);
    await send(true);
    await expect(button).toHaveCount(0);
    await expect(page.locator(".hand-menu-cursor")).toHaveCount(0);
    await send(true);
    if (game === "shoot") {
      await expect(page.locator(".hud-panel").first()).toContainText("0");
      await expect(page.locator('.hearts svg[fill="var(--pink)"]')).toHaveCount(
        5,
      );
    } else if (game === "circle") {
      await expect(page.locator(".circle-canvas")).toHaveAttribute(
        "data-strokes",
        "0",
      );
      await send(false);
      await send(true);
      await expect(page.locator(".circle-canvas")).toHaveAttribute(
        "data-strokes",
        "1",
      );
    }
    await page.evaluate(() => window.dispatchEvent(new Event("arcade:pause")));
    const resumeBox = await button.boundingBox();
    // A held pinch must not resume, even after entering the pause menu.
    expect(resumeBox).not.toBeNull();
    await send(true);
    await expect(button).toBeVisible();
    await page.waitForTimeout(400); // Real gesture cooldown is 350ms.
    x =
      1 -
      (0.12 + ((resumeBox!.x + resumeBox!.width / 2) / viewport.width) * 0.76);
    y =
      0.12 + ((resumeBox!.y + resumeBox!.height / 2) / viewport.height) * 0.76;
    for (let i = 0; i < 5; i++) await send(false);
    await expect(button).toHaveClass(/hand-hovered/);
    await send(true);
    await expect(button).toHaveCount(0);
    await send(true);
    if (game === "shoot") {
      await expect(page.locator('.hearts svg[fill="var(--pink)"]')).toHaveCount(
        5,
      );
    } else if (game === "circle") {
      await expect(page.locator(".circle-canvas")).toHaveAttribute(
        "data-strokes",
        "1",
      );
    }
    await page.evaluate(() => window.dispatchEvent(new Event("arcade:pause")));
    await send(false);
    await expect(page.locator(".hand-menu-cursor")).toBeVisible();
    await page
      .getByRole("button", { name: "카메라 끄기", exact: true })
      .click();
    await expect(page.locator(".hand-menu-cursor")).toHaveCount(0);
  });
}
