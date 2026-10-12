import { test, expect, type Page } from "@playwright/test";
import { bodySample, bodyTarget, type BodyPoint } from "../src/vision/body";
import {
  newDodge,
  advanceDodge,
  dodgeFinished,
  dodgeScore,
} from "../src/games/dodgeRules";
function shoulders(center = 0.5, width = 0.3): BodyPoint[] {
  const p = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }));
  p[11] = { x: center - width / 2, y: 0.4, z: 0, visibility: 1 };
  p[12] = { x: center + width / 2, y: 0.4, z: 0, visibility: 1 };
  return p;
}
test.use({
  reducedMotion: "reduce",
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});
test("body tracking rejects hidden shoulders; movement is mirrored and relative to calibration", () => {
  const center = bodySample(shoulders(0.7));
  expect(center.detected).toBe(true);
  expect(center.x).toBeCloseTo(0.3);
  expect(bodyTarget(center, center.x, center.width)).toBe(0.5);
  expect(
    bodyTarget(bodySample(shoulders(0.6)), center.x, center.width),
  ).toBeGreaterThan(0.5);
  expect(bodySample()).toHaveProperty("detected", false);
  for (const bad of [0.5, NaN]) {
    const p = shoulders();
    p[11].visibility = bad;
    expect(bodySample(p).detected).toBe(false);
  }
  const invalid = shoulders();
  invalid[12].x = NaN;
  expect(bodySample(invalid).detected).toBe(false);
  expect(bodySample(shoulders(0.5, 0.01)).detected).toBe(false);
});
test("collision gives invulnerability, dodges score once, and both endings stop simulation", () => {
  const s = newDodge();
  s.spawnIn = 10;
  s.obstacles = [
    { id: 0, x: 0.5, y: 0.8 },
    { id: 1, x: 0.5, y: 0.81 },
  ];
  let next = advanceDodge(s, 0.04, 0.5);
  expect(next.lives).toBe(2);
  expect(next.hits).toBe(1);
  next = advanceDodge(next, 0.04, 0.5);
  expect(next.lives).toBe(2);
  const dodge = {
    ...newDodge(),
    spawnIn: 10,
    obstacles: [{ id: 0, x: 0.9, y: 1.079 }],
  };
  const passed = advanceDodge(dodge, 0.04, 0.5);
  expect(passed.dodged).toBe(1);
  expect(advanceDodge(passed, 0.04, 0.5).dodged).toBe(1);
  const ended = advanceDodge(
    { ...newDodge(), elapsed: 29.98, spawnIn: 10 },
    0.1,
    0.5,
  );
  expect(ended.elapsed).toBe(30);
  expect(dodgeFinished(ended)).toBe(true);
  expect(dodgeScore(ended)).toBe(300);
  expect(advanceDodge({ ...newDodge(), lives: 0 }, 0.1, 0.9).elapsed).toBe(0);
  expect(s.lives).toBe(3);
});
test("keys and held buttons move; pause preserves time; 30 seconds saves, reloads and replays", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => (Math.random = () => 1));
  await page.goto("/games");
  await page.getByRole("link", { name: "빨리 피해! 지금 플레이!" }).click();
  await page.getByRole("button", { name: "게임 시작!", exact: true }).click();
  await page.clock.runFor(3200);
  await page.keyboard.down("ArrowLeft");
  await page.clock.runFor(350);
  await page.keyboard.up("ArrowLeft");
  const x = await page
    .locator(".dodge-player")
    .evaluate((el) => parseFloat((el as HTMLElement).style.left));
  expect(x).toBeLessThan(40);
  await page
    .getByRole("button", { name: "오른쪽으로 이동", exact: true })
    .dispatchEvent("pointerdown", { pointerId: 1 });
  await page.clock.runFor(250);
  await page.dispatchEvent("body", "pointerup");
  const after = await page
    .locator(".dodge-player")
    .evaluate((el) => parseFloat((el as HTMLElement).style.left));
  expect(after).toBeGreaterThan(x);
  await page.keyboard.press("Escape");
  const timer = await page.locator(".cham-toolbar strong").textContent();
  await page.clock.runFor(5000);
  expect(await page.locator(".cham-toolbar strong").textContent()).toBe(timer);
  await page
    .locator(".game-overlay")
    .getByRole("button", { name: "계속하기", exact: true })
    .click();
  await page.clock.runFor(30000);
  await expect(page).toHaveURL(/result\/dodge$/);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.dodge")!),
  );
  expect(saved.plays).toBe(1);
  expect(saved.last.cleared).toBe(true);
  expect(saved.last.seconds).toBe(30);
  expect(saved.last.hits).toBe(0);
  expect(saved.last.score).toBe(300 + saved.last.dodged * 50);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("arcade.records")!).daily,
    ),
  ).toBe(1);
  await page.reload();
  await expect(page.locator(".result-stats")).toContainText(
    saved.last.score.toLocaleString(),
  );
  await page.getByRole("link", { name: "다시 하기" }).click();
  await expect(
    page.getByRole("button", { name: "게임 시작!", exact: true }),
  ).toBeEnabled();
});
test("three collisions end early, blocked storage keeps result and both languages fit screens", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    Math.random = () => 0.5;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "arcade.dodge") throw new Error("blocked");
      original.call(this, key, value);
    };
  });
  await page.goto("/play/dodge");
  await page.getByRole("button", { name: "게임 시작!", exact: true }).click();
  await page.clock.runFor(30000);
  await expect(page).toHaveURL(/result\/dodge$/);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".result-heading")).toHaveText("잘 피했어요!");
  for (const lang of ["ko", "en"]) {
    await page.evaluate(
      (lang) => localStorage.setItem("arcade.language", JSON.stringify(lang)),
      lang,
    );
    for (const width of [320, 390, 768, 1920]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.goto("/play/dodge");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(page.locator(".game-overlay .arcade-button")).toBeVisible();
      const box = await page
        .locator(".game-overlay .arcade-button")
        .boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  }
});
async function mockBody(page: Page) {
  await page.addInitScript(() => {
    const Original = window.Worker;
    window.Worker = class extends EventTarget {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror = null;
      closed = false;
      points: unknown;
      listener = (e: Event) => (this.points = (e as CustomEvent).detail);
      constructor(url: string | URL, options?: WorkerOptions) {
        super();
        if (!String(url).includes("body.worker"))
          return new Original(url, options) as unknown as typeof this;
        window.addEventListener("test-body", this.listener);
      }
      postMessage(m: { type: string; time: number; bitmap?: ImageBitmap }) {
        if (m.type === "init")
          setTimeout(
            () =>
              this.onmessage?.(
                new MessageEvent("message", { data: { type: "ready" } }),
              ),
            0,
          );
        if (m.type === "frame") {
          m.bitmap?.close();
          setTimeout(() => {
            if (!this.closed)
              this.onmessage?.(
                new MessageEvent("message", {
                  data: {
                    type: "result",
                    landmarks: this.points,
                    time: m.time,
                    aspect: 4 / 3,
                  },
                }),
              );
          }, 0);
        }
      }
      terminate() {
        this.closed = true;
        window.removeEventListener("test-body", this.listener);
      }
    } as unknown as typeof Worker;
  });
}
const send = (page: Page, p: unknown) =>
  page.evaluate(
    (points) =>
      window.dispatchEvent(new CustomEvent("test-body", { detail: points })),
    p,
  );
test("webcam calibrates off-center, moves smoothly, pauses on body loss and supports fallback", async ({
  page,
}) => {
  await mockBody(page);
  await page.goto("/play/dodge");
  await page.getByRole("button", { name: "웹캠 몸 인식", exact: true }).click();
  await expect(page.locator(".camera-note")).toContainText("어깨가 모두");
  await send(page, shoulders(0.7));
  await expect(page.locator(".camera-note")).toContainText("상체 인식 완료");
  await page.getByRole("button", { name: "게임 시작!", exact: true }).click();
  await expect(page.locator(".dodge-controls button").first()).toBeDisabled();
  await expect(page.locator(".dodge-count")).toHaveCount(0, { timeout: 5000 });
  expect(
    await page
      .locator(".dodge-player")
      .evaluate((el) => parseFloat((el as HTMLElement).style.left)),
  ).toBeCloseTo(50, 0);
  await send(page, shoulders(0.6));
  await expect
    .poll(() =>
      page
        .locator(".dodge-player")
        .evaluate((el) => parseFloat((el as HTMLElement).style.left)),
    )
    .toBeGreaterThan(60);
  await send(page, undefined);
  await expect(page.locator(".game-overlay")).toBeVisible();
  await expect(page.locator(".game-overlay .arcade-button")).toBeDisabled();
  const timer = await page.locator(".cham-toolbar strong").textContent();
  await page.waitForTimeout(1200);
  expect(await page.locator(".cham-toolbar strong").textContent()).toBe(timer);
  await send(page, shoulders(0.7));
  await expect(page.locator(".game-overlay .arcade-button")).toBeEnabled();
  await page.getByRole("button", { name: "현재 위치를 중앙으로" }).click();
  await page.locator(".game-overlay .arcade-button").click();
  await page.getByRole("button", { name: "카메라 끄기", exact: true }).click();
  await expect(page.locator(".game-overlay")).toBeVisible();
  await page
    .locator(".game-overlay")
    .getByRole("button", { name: "방향키 / 버튼", exact: true })
    .click();
  await page.locator(".game-overlay .arcade-button").click();
  await expect(page.locator(".dodge-controls button").first()).toBeEnabled();
});
test("real local pose model loads; camera stream survives switching back to a hand game", async ({
  page,
}) => {
  test.setTimeout(60000);
  const assets: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("pose_landmarker_lite.task") && r.ok())
      assets.push(r.url());
  });
  await page.goto("/play/dodge");
  await page.getByRole("button", { name: "웹캠 몸 인식", exact: true }).click();
  await expect(page.locator(".camera-note")).toContainText("어깨가 모두", {
    timeout: 40000,
  });
  expect(assets).toHaveLength(1);
  await page.getByRole("link", { name: "뒤로" }).click();
  await page.getByRole("link", { name: "쏴! 지금 플레이!" }).click();
  await expect(page.locator(".camera-note")).toContainText("손바닥을 카메라", {
    timeout: 40000,
  });
});
test("body model failure can retry without blocking button play", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.route("**/vision/pose_landmarker_lite.task", (r) => r.abort());
  await page.goto("/play/dodge");
  await page.getByRole("button", { name: "웹캠 몸 인식", exact: true }).click();
  await expect(page.locator(".camera-note")).toContainText("몸 인식 준비 실패");
  await page
    .locator(".game-overlay")
    .getByRole("button", { name: "방향키 / 버튼", exact: true })
    .click();
  await expect(page.locator(".game-overlay .arcade-button")).toBeEnabled();
  await page.unroute("**/vision/pose_landmarker_lite.task");
  await page.locator(".camera-note button").click();
  await expect(page.locator(".camera-note")).toContainText("어깨가 모두", {
    timeout: 40000,
  });
  await expect(page.locator(".cham-mode button").first()).toHaveClass("active");
});
test("malformed results show an empty state and valid results fit every supported width", async ({
  page,
}) => {
  await page.goto("/result/dodge");
  await expect(page.locator(".empty-state")).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem(
      "arcade.dodge",
      JSON.stringify({
        best: 100,
        plays: 1,
        last: { score: 100, seconds: 31, dodged: -1, hits: 0, cleared: true },
      }),
    ),
  );
  await page.reload();
  await expect(page.locator(".empty-state")).toBeVisible();
  for (const lang of ["ko", "en"]) {
    await page.evaluate((lang) => {
      localStorage.setItem("arcade.language", JSON.stringify(lang));
      localStorage.setItem(
        "arcade.dodge",
        JSON.stringify({
          best: 1300,
          plays: 1,
          last: {
            score: 1300,
            seconds: 30,
            dodged: 20,
            hits: 0,
            cleared: true,
            newBest: true,
            saved: true,
          },
        }),
      );
    }, lang);
    for (const width of [320, 390, 768, 1920]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.goto("/result/dodge");
      await expect(page.locator(".result-stats")).toContainText("30.0");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});
