import { test, expect } from "@playwright/test";
import type { Landmark } from "../src/vision/gestures";
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
  reducedMotion: "reduce",
});
test.beforeEach(async ({ page }) => {
  await page.clock.install();
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
        if (!/hand.worker|face.worker|body.worker/.test(String(url)))
          return new OriginalWorker(url, options) as any;
        window.addEventListener("practice-frame", this.listener);
      }
      postMessage(message: any) {
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
        window.removeEventListener("practice-frame", this.listener);
      }
    } as any;
  });
});
function hand(pinched: boolean, x = 0.72, y = 0.44, tip = false): Landmark[] {
  const cx = tip ? 0.5 : 1 - (x * 0.76 + 0.12),
    cy = tip ? 0.55 : y * 0.76 + 0.12;
  const points = Array.from({ length: 21 }, () => ({ x: cx, y: cy }));
  points[5] = { x: cx - 0.07, y: cy };
  points[17] = { x: cx + 0.07, y: cy };
  const finger = tip
    ? { x: 1 - (x * 0.76 + 0.12), y: y * 0.76 + 0.12 }
    : { x: cx + 0.06, y: cy - 0.16 };
  points[8] = finger;
  points[4] = { x: finger.x - (pinched ? 0.005 : 0.15), y: finger.y };
  return points;
}
function rps(pose: string): Landmark[] {
  const p = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8 }));
  p[0] = { x: 0.5, y: 0.9 };
  p[4] = { x: 0.2, y: 0.6 };
  [5, 9, 13, 17].forEach((i, f) => {
    const x = 0.38 + f * 0.08,
      open = pose === "paper" || (pose === "scissors" && f < 2);
    p[i] = { x, y: 0.65 };
    p[i + 1] = { x, y: 0.5 };
    p[i + 2] = { x: x + (open ? 0 : 0.03), y: open ? 0.35 : 0.6 };
    p[i + 3] = { x, y: open ? 0.22 : 0.7 };
  });
  return p;
}
function face(nose = 0.5): Landmark[] {
  const p = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }));
  p[33] = { x: 0.4, y: 0.4 };
  p[263] = { x: 0.6, y: 0.4 };
  p[1] = { x: nose, y: 0.5 };
  return p;
}
function body(shift = 0) {
  const p = Array.from({ length: 33 }, () => ({
    x: 0.5 + shift,
    y: 0.5,
    visibility: 1,
  }));
  p[11] = { x: 0.4 + shift, y: 0.4, visibility: 1 };
  p[12] = { x: 0.6 + shift, y: 0.4, visibility: 1 };
  return p;
}
for (const game of ["shoot", "circle", "rps", "cham", "dodge"]) {
  test(`${game}: webcam practice uses live interpreted inputs and leaves actual records untouched`, async ({
    page,
  }) => {
    await page.goto(`/play/${game}`);
    const records = () =>
      page.evaluate(() =>
        Object.fromEntries(
          Object.entries(localStorage).filter(([key]) =>
            /^arcade\.(records|circle|cham|rps|dodge|community\.(runs|progress|secrets))/.test(
              key,
            ),
          ),
        ),
      );
    const before = await records();
    await page.getByRole("button", { name: "입력 연습", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "입력 연습", exact: true });
    await dialog.getByRole("button", { name: "웹캠", exact: true }).click();
    await expect(page.locator(".camera-note")).not.toContainText(
      "준비하고 있어요",
      { timeout: 10000 },
    );
    const send = async (points: Landmark[]) => {
      await page.evaluate(
        (points) =>
          window.dispatchEvent(
            new CustomEvent("practice-frame", { detail: points }),
          ),
        points,
      );
      await page.clock.runFor(70);
    };
    if (game === "shoot") {
      for (let i = 0; i < 3; i++) await send(hand(true));
      await expect(dialog.locator(".coach-progress")).not.toHaveAttribute(
        "value",
        "2",
      );
      await send(hand(false));
      await send(hand(true));
    } else if (game === "circle") {
      await send(hand(true, 0.8, 0.5, true));
      await expect(dialog.locator(".practice-stroke")).toHaveAttribute("d", "");
      await send(hand(false, 0.8, 0.5, true));
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        await send(
          hand(true, 0.5 + 0.3 * Math.cos(a), 0.5 + 0.3 * Math.sin(a), true),
        );
      }
      await send(hand(false, 0.8, 0.5, true));
    } else if (game === "rps") {
      for (const pose of ["rock", "paper", "scissors"])
        for (let i = 0; i < 6; i++) await send(rps(pose));
    } else if (game === "cham") {
      await send(face());
      await dialog
        .getByRole("button", { name: "정면 맞추기", exact: true })
        .click();
      for (let i = 0; i < 26; i++) await send(face());
      for (const nose of [0.55, 0.45, 0.5])
        for (let i = 0; i < 3; i++) await send(face(nose));
    } else {
      for (const shift of [0, 0.1, -0.1, 0])
        for (let i = 0; i < 3; i++) await send(body(shift));
    }
    await expect(dialog.getByRole("status")).toHaveText("연습 완료!");
    expect(await records()).toEqual(before);
    await dialog
      .getByRole("button", { name: "연습 마치기", exact: true })
      .click();
    await expect(page.locator(".achievement-toast")).toHaveCount(0);
    if (game === "shoot" || game === "circle") {
      await send(hand(true, 0.72, 0.44, game === "circle"));
      await page.getByRole("button", { name: "시작!", exact: true }).click();
      for (let i = 0; i < 3; i++)
        await send(hand(true, 0.72, 0.44, game === "circle"));
      if (game === "shoot")
        await expect(page.locator(".hud-panel.pink strong")).toHaveText("0");
      else
        await expect(page.locator(".circle-canvas")).toHaveAttribute(
          "data-strokes",
          "0",
        );
    }
    expect(await records()).toEqual(before);
  });
}
