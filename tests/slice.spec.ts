import { expect, test, type Page } from "@playwright/test";
import {
  cutAlongPath,
  newSliceRound,
  SlashTracker,
} from "../src/games/sliceRules";

test("only fast continuous swipes cut, with no repeated segment or jump on reacquiring tracking", () => {
  const track = new SlashTracker();
  const sample = (x: number, time: number, hand = "Left") =>
    track.add({ x, y: 220, time }, hand);
  expect(sample(100, 0)).toBeNull();
  expect(sample(130, 100)).toBeNull();
  expect(sample(220, 140)?.map((p) => p.x)).toEqual([130, 220]);
  expect(sample(300, 180)?.map((p) => p.x)).toEqual([220, 300]);
  expect(sample(700, 220, "Right")).toBeNull();
  expect(sample(220, 450, "Right")).toBeNull();
  track.reset();
  expect(sample(600, 480, "Right")).toBeNull();
});

test("a single segment cuts multiple fruit once and a bomb resets the combo", () => {
  const round = newSliceRound();
  const item = (x: number, kind: "apple" | "bomb") => ({
    x,
    y: 240,
    vx: 0,
    vy: 0,
    radius: 30,
    kind,
  });
  round.items = [item(350, "apple"), item(470, "apple"), item(650, "bomb")];
  const swipe = [
    { x: 150, y: 240, time: 0 },
    { x: 560, y: 240, time: 40 },
  ];
  expect(cutAlongPath(round, swipe)).toHaveLength(2);
  expect(round).toMatchObject({ sliced: 2, score: 22, combo: 2, maxCombo: 2 });
  expect(cutAlongPath(round, swipe)).toHaveLength(0);
  cutAlongPath(round, [swipe[1], { x: 750, y: 240, time: 80 }]);
  expect(round).toMatchObject({ lives: 2, score: 22, combo: 0, maxCombo: 2 });
});

async function deterministicRound(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.5;
  });
  await page.clock.install();
}

test("the game tab opens Slice, pointer play saves a result and replay returns to the arena", async ({
  page,
}) => {
  await deterministicRound(page);
  await page.goto("/games");
  const card = page.getByRole("link", { name: "썰어! 지금 플레이!" });
  await expect(card).toBeVisible();
  await expect(card.locator(".card-arrow")).toBeVisible();
  await page.getByRole("button", { name: "얼굴 인식", exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole("button", { name: "손 인식", exact: true }).click();
  await card.click();
  await expect(page).toHaveURL(/\/play\/slice$/);
  const start = page
    .locator(".slice-stage")
    .getByRole("button", { name: "시작!", exact: true });
  await expect(start).toBeEnabled();
  await start.click();
  await page.clock.runFor(2350);
  const canvas = page.locator(".slice-board canvas");
  const bounds = (await canvas.boundingBox())!;
  const move = (x: number) =>
    page.mouse.move(
      bounds.x + bounds.width * x,
      bounds.y + bounds.height * 0.415,
    );
  await move(0.3);
  await page.clock.runFor(43);
  await move(0.64);
  await expect(page.locator(".hud-panel.pink strong")).toHaveText("22");
  await page.clock.runFor(30_500);
  await expect(page).toHaveURL(/\/result\/slice$/);
  await expect(
    page.locator(".game-result").getByRole("heading", { name: "썰어!" }),
  ).toBeVisible();
  const runs = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.community.runs") ?? "[]"),
  );
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({
    game: "slice",
    score: 22,
    seconds: 30,
    details: { hits: 2, inputMode: "mouse" },
  });
  await page.reload();
  await page.getByRole("link", { name: "다시 하기" }).click();
  await expect(page.locator(".slice-stage")).toHaveAttribute(
    "data-phase",
    "ready",
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

test("webcam swipes cut fruit and detonate bombs, and tracking loss freezes the round", async ({
  page,
}) => {
  await deterministicRound(page);
  await page.addInitScript(() => {
    type Palm = { x: number; y: number; hand: string };
    const driver = window as Window & { slicePalm?: Palm | null };
    driver.slicePalm = { x: 0.7, y: 0.43, hand: "Left" };
    const BrowserWorker = window.Worker;
    window.Worker = class extends EventTarget {
      onmessage: ((e: MessageEvent) => void) | null = null;
      timer = 0;
      postMessage(message: { type: string; bitmap?: ImageBitmap }) {
        message.bitmap?.close();
        if (message.type !== "init") return;
        this.timer = window.setInterval(() => {
          const palm = driver.slicePalm;
          const landmarks = palm
            ? Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))
            : undefined;
          if (landmarks && palm) {
            landmarks[5].x = 0.4;
            landmarks[17].x = 0.6;
            landmarks[8] = { x: palm.x, y: palm.y };
          }
          this.onmessage?.(
            new MessageEvent("message", {
              data: {
                type: "result",
                landmarks,
                handedness: palm?.hand,
                time: performance.now(),
                aspect: 4 / 3,
              },
            }),
          );
        }, 45);
        queueMicrotask(() =>
          this.onmessage?.(
            new MessageEvent("message", { data: { type: "ready" } }),
          ),
        );
      }
      terminate() {
        clearInterval(this.timer);
      }
    } as unknown as typeof BrowserWorker;
  });
  await page.goto("/play/slice");
  const stage = page.locator(".slice-stage");
  await expect(stage).toBeVisible();
  await stage.getByRole("button", { name: "웹캠", exact: true }).click();
  const start = stage.getByRole("button", { name: "시작!", exact: true });
  await expect(start).toBeEnabled();
  await page.clock.pauseAt(new Date(Date.now() + 250));
  await start.evaluate((button: HTMLButtonElement) => button.click());
  await page.clock.runFor(2340);
  const setHand = (x: number | null, hand = "Left") =>
    page.evaluate(
      ({ x, hand }) => {
        Object.assign(window, {
          slicePalm: x === null ? null : { x, y: 0.43, hand },
        });
      },
      { x, hand },
    );
  await setHand(0.36);
  await page.clock.runFor(60);
  await expect(page.locator(".hud-panel.pink strong")).toHaveText("22");
  await setHand(0.7);
  await page.clock.runFor(2160);
  await setHand(0.36);
  await page.clock.runFor(60);
  await expect(stage.locator(".slice-feedback.bomb")).toHaveText("앗, 폭탄!");
  await expect(page.locator(".slice-lives")).toHaveAttribute(
    "aria-label",
    "2 / 3",
  );
  const hasExplosionColor = await stage
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas
        .getContext("2d")!
        .getImageData(365, 105, 320, 200).data;
      for (let i = 0; i < pixels.length; i += 4) {
        if (
          pixels[i] === 255 &&
          pixels[i + 1] === 112 &&
          pixels[i + 2] === 59 &&
          pixels[i + 3] === 255
        )
          return true;
      }
      return false;
    });
  expect(hasExplosionColor).toBe(true);
  const score = page.locator(".hud-panel.pink strong");
  const beforeLoss = await score.textContent();
  await setHand(null);
  await page.clock.runFor(80);
  await expect(stage.locator(".slice-tracking")).toHaveCount(0);
  await page.clock.runFor(100);
  await expect(stage.locator(".slice-tracking")).toContainText(
    "손을 카메라에 보여주면",
  );
  const time = page.getByRole("progressbar", { name: "남은 시간" });
  const before = await time.getAttribute("value");
  await page.clock.runFor(2100);
  await expect(time).toHaveAttribute("value", before!);
  await setHand(0.91, "Right");
  await page.clock.runFor(100);
  await expect(stage.locator(".slice-tracking")).toHaveCount(0);
  await expect(score).toHaveText(beforeLoss!);

  await setHand(0.7, "Right");
  await page.clock.runFor(3250);
  await setHand(0.36, "Right");
  await page.clock.runFor(60);
  await expect(page.locator(".slice-lives")).toHaveAttribute(
    "aria-label",
    "1 / 3",
  );
  await setHand(0.7, "Right");
  await page.clock.runFor(3310);
  await setHand(0.36, "Right");
  await page.clock.runFor(70);
  await expect(stage).toHaveAttribute("data-phase", "ending");
  await expect(stage.locator(".slice-feedback.bomb")).toBeVisible();
  await expect(page).toHaveURL(/\/play\/slice$/);
  await page.clock.runFor(520);
  await expect(page).toHaveURL(/\/result\/slice$/);
  const runs = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.community.runs") ?? "[]"),
  );
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({
    game: "slice",
    details: { inputMode: "hand", misses: 3 },
  });
});
