import { test, expect } from "@playwright/test";
import { isCircleClosed, type CirclePoint } from "../src/games/circleClosure";
function circle(radius = 0.2, n = 64, turn = 1): CirclePoint[] {
  return Array.from({ length: n + 1 }, (_, i) => ({
    x: 0.5 + radius * Math.cos((i / n) * Math.PI * 2 * turn),
    y: 0.5 + radius * Math.sin((i / n) * Math.PI * 2 * turn),
  }));
}
test("closure requires an actual sized loop, not a short stroke, stationary jitter, a line or an open arc", () => {
  expect(isCircleClosed(circle())).toBe(true);
  expect(isCircleClosed(circle().reverse())).toBe(true);
  expect(
    isCircleClosed([...circle().slice(0, -1), { x: 0.705, y: 0.65 }]),
  ).toBe(true);
  expect(isCircleClosed(circle(0.2, 64, 0.8))).toBe(false);
  expect(isCircleClosed(circle(0.02))).toBe(false);
  expect(isCircleClosed(circle(0.2, 10))).toBe(false);
  expect(
    isCircleClosed(
      Array.from({ length: 100 }, (_, i) => ({
        x: 0.5 + (i % 2) * 0.001,
        y: 0.5,
      })),
    ),
  ).toBe(false);
  const backtrack = Array.from({ length: 65 }, (_, i) => ({
    x: 0.2 + Math.sin((i / 64) * Math.PI) * 0.5,
    y: 0.2 + Math.sin((i / 64) * Math.PI) * 0.4,
  }));
  expect(isCircleClosed(backtrack)).toBe(false);
});
test("hover or tracking jumps cannot close a missing segment; only tiny visually connected joins are allowed", () => {
  const loop = circle();
  loop[loop.length - 1].move = true;
  expect(isCircleClosed(loop)).toBe(false);
  const gap = circle().filter((_, i) => i < 20 || i >= 40);
  gap[20].move = true;
  expect(isCircleClosed(gap)).toBe(false);
  const near = circle();
  near[20].move = true;
  expect(isCircleClosed(near)).toBe(false);
  const dense = circle(0.2, 200);
  dense[20].move = true;
  expect(isCircleClosed(dense)).toBe(true);
  const bad = circle();
  bad[30].x = NaN;
  expect(isCircleClosed(bad)).toBe(false);
});
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});
for (const completion of ["closure", "fist"])
  test("webcam completes exactly once via " + completion, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install({ time: new Date("2026-11-01T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-11-01T00:00:01Z"));
    await page.addInitScript(() => {
      const OriginalWorker = window.Worker;
      window.Worker = class {
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
          if (!String(url).includes("hand.worker"))
            return new OriginalWorker(url, options) as any;
          window.addEventListener("circle-hand", this.listener);
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
          window.removeEventListener("circle-hand", this.listener);
        }
      } as any;
    });
    await page.goto("/play/circle");
    await page
      .getByRole("button", { name: "카메라 연결", exact: true })
      .click();
    await expect
      .poll(async () => {
        await page.clock.runFor(100);
        return page.locator(".camera-note").textContent();
      })
      .toContain("손바닥을 카메라에 보여주세요!");
    await expect(
      page.getByRole("button", { name: "손가락 그리기", exact: true }),
    ).toHaveClass(/active/);
    async function send(x: number, y: number, pinched: boolean) {
      await page.evaluate(
        ({ x, y, pinched }) => {
          const cx = 1 - (x * 0.76 + 0.12),
            cy = y * 0.76 + 0.12;
          const points = Array.from({ length: 21 }, () => ({
            x: 0.5,
            y: 0.65,
          }));
          points[5] = { x: 0.43, y: 0.65 };
          points[17] = { x: 0.57, y: 0.65 };
          points[8] = { x: cx, y: cy };
          points[4] = { x: cx - (pinched ? 0.005 : 0.15), y: cy };
          window.dispatchEvent(
            new CustomEvent("circle-hand", { detail: points }),
          );
        },
        { x, y, pinched },
      );
      await page.clock.runFor(70);
    }
    await send(0.72, 0.5, false);
    await page.getByRole("button", { name: "시작!", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "그리기 완료", exact: true }),
    ).toHaveCount(0);
    // Moving back to the start with an open hand draws nothing and cannot finish.
    for (let i = 0; i < 8; i++) await send(0.5 + i * 0.02, 0.5, false);
    await expect(page.locator(".circle-score b")).toHaveText("0");
    for (let i = 0; i < 5; i++) await send(0.72, 0.5, false);
    for (let i = 0; i <= 48; i++) {
      const a = (i / 64) * Math.PI * 2;
      await send(0.5 + 0.22 * Math.cos(a), 0.5 + 0.22 * Math.sin(a), true);
    }
    await expect(page).toHaveURL(/play\/circle$/);
    if (completion === "fist") {
      for (let frame = 0; frame < 7; frame++) {
        await page.evaluate(() => {
          const p = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8 }));
          p[0] = { x: 0.5, y: 0.9 };
          p[4] = { x: 0.2, y: 0.6 };
          [5, 9, 13, 17].forEach((i, f) => {
            const x = 0.38 + f * 0.08;
            p[i] = { x, y: 0.65 };
            p[i + 1] = { x, y: 0.5 };
            p[i + 2] = { x: x + 0.03, y: 0.6 };
            p[i + 3] = { x, y: 0.7 };
          });
          window.dispatchEvent(new CustomEvent("circle-hand", { detail: p }));
        });
        await page.clock.runFor(100);
      }
    }
    for (let i = 49; completion === "closure" && i <= 70; i++) {
      const a = (Math.min(i, 64) / 64) * Math.PI * 2;
      await send(0.5 + 0.22 * Math.cos(a), 0.5 + 0.22 * Math.sin(a), true);
      if (page.url().includes("/result/")) break;
    }
    await expect(page).toHaveURL(/result\/circle$/);
    const stored = await page.evaluate(() => ({
      result: JSON.parse(localStorage.getItem("arcade.circle.last")!),
      runs: JSON.parse(localStorage.getItem("arcade.community.runs")!),
      plays: localStorage.getItem("arcade.circle.plays"),
    }));
    expect(stored.result.score).toBeGreaterThan(0);
    expect(stored.result.evidence.inputMode).toBe("hand");
    expect(stored.result.evidence.metadata.drawComplete).toBe(true);
    expect(stored.plays).toBe("1");
    expect(stored.runs).toHaveLength(1);
    await page.clock.runFor(1000);
    await page.reload();
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("arcade.community.runs")!).length,
      ),
    ).toBe(1);
  });
