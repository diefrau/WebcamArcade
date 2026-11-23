import { expect, test } from "@playwright/test";
import { BubbleFaceInput, rollAngle } from "../src/games/bubbleFace";
import {
  BUBBLE_RADIUS,
  BUBBLE_WIDTH,
  advanceBubble,
  advanceBubbleRowClock,
  bubbleCellPoint,
  launchBubble,
  newBubbleRound,
  traceBubble,
} from "../src/games/bubbleRules";
import { faceAimSample, type FaceAim } from "../src/vision/face";

const mouthClosed = { roll: 0, jawOpen: 0.09 };
const mouthOpen = { roll: 0, jawOpen: 0.94 };

test("wall-banked guides turn at the rail, match three, and drop unsupported bubbles", () => {
  const round = newBubbleRound();
  round.board.forEach((row) => row.fill(null));
  const bank = traceBubble(round.board, 0.96);
  expect(bank.points.length).toBeGreaterThan(2);
  expect(bank.points[1].x).toBeCloseTo(BUBBLE_WIDTH - BUBBLE_RADIUS);
  expect(bank.points.at(-1)!.y).toBeCloseTo(35);
  round.board[0][4] = 2;
  round.board[0][5] = 2;
  round.board[1][5] = 1;
  expect(launchBubble(round, 0)).toBe(true);
  expect(launchBubble(round, 0)).toBe(false);
  const effects = advanceBubble(round, 1)!;
  expect(effects).toHaveLength(4);
  expect(effects.filter(({ fallen }) => fallen)).toHaveLength(1);
  expect(round).toMatchObject({
    outcome: "clear",
    score: 95,
    shotsLeft: 29,
    lowered: false,
  });
});

test("shots lower shuffled color groups and preserve the hex grid", () => {
  const round = newBubbleRound();
  for (const row of round.board) {
    row.forEach((color, col) => {
      if (color !== null) row[col] = 0;
    });
  }
  const count = () =>
    round.board.flat().filter((color) => color !== null).length;
  const initial = count();
  const originalCeiling = round.board[0];
  const originalX = bubbleCellPoint(round.board, { row: 0, col: 0 }).x;
  round.color = 1;
  round.next = 3;
  expect(launchBubble(round, 0)).toBe(true);
  expect(count()).toBe(initial);
  round.shotsUntilRow = 2;
  expect(advanceBubble(round, 1, () => 0.99)).toHaveLength(0);
  expect(round.shotsUntilRow).toBe(1);
  expect(round.lowered).toBe(false);
  expect([0, 1]).toContain(round.color);
  expect([0, 1]).toContain(round.next);
  round.color = 3;
  expect(launchBubble(round, 0)).toBe(true);
  expect(advanceBubble(round, 1, () => 0.99)).toHaveLength(0);
  expect(count()).toBe(initial + 2 + 8);
  expect(round.shotsUntilRow).toBe(3);
  expect(round.lowered).toBe(true);
  expect(round.board[1]).toBe(originalCeiling);
  expect(bubbleCellPoint(round.board, { row: 1, col: 0 }).x).toBe(originalX);
  expect(round.board[0]).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);

  round.shotsUntilRow = 1;
  round.color = 2;
  expect(launchBubble(round, 0)).toBe(true);
  advanceBubble(round, 1, () => 0);
  expect(round.board[0]).toEqual([1, 1, 2, 2, 3, 3, 0, 0, 0]);
});

test("a successful shot also advances the row schedule", () => {
  const round = newBubbleRound();
  round.shotsUntilRow = 1;
  launchBubble(round, 0);
  expect(advanceBubble(round, 1, () => 0)!.length).toBeGreaterThan(0);
  expect(round.lowered).toBe(true);
  expect(round.shotsUntilRow).toBe(1);
});

test("the lowest threatened row supplies the loaded and preview bubbles", () => {
  const round = newBubbleRound();
  round.board[7][0] = 1;
  round.board[8][0] = 3;
  round.shotsUntilRow = 2;
  round.color = 0;
  round.next = 1;
  expect(launchBubble(round, 0)).toBe(true);
  expect(advanceBubble(round, 1, () => 0)).toHaveLength(0);
  expect(round).toMatchObject({ color: 3, next: 3, outcome: null });
});

test("unlimited modes count fired bubbles and timed rows descend without a shot", () => {
  const endless = newBubbleRound("endless");
  endless.shotsUntilRow = 1;
  expect(launchBubble(endless, 0)).toBe(true);
  advanceBubble(endless, 1, () => 0);
  expect(endless).toMatchObject({ shotsLeft: Infinity, shotsFired: 1, lowered: true });
  expect(advanceBubbleRowClock(endless, 5)).toBe(false);

  const timed = newBubbleRound("time-attack");
  timed.shotsUntilRow = 1;
  expect(launchBubble(timed, 0)).toBe(true);
  advanceBubble(timed, 1, () => 0);
  expect(timed).toMatchObject({ shotsLeft: Infinity, shotsFired: 1, lowered: false });
  const ceiling = timed.board[0];
  expect(advanceBubbleRowClock(timed, 2, () => 0)).toBe(false);
  expect(advanceBubbleRowClock(timed, 1, () => 0)).toBe(true);
  expect(timed.board[1]).toBe(ceiling);
  expect(timed.secondsUntilRow).toBe(3);
});

test("a timed row drop preserves both queued colors even at the danger line", () => {
  const round = newBubbleRound("time-attack");
  round.board.at(-3)![0] = 3;
  round.color = 1;
  round.next = 2;

  expect(advanceBubbleRowClock(round, 3, () => 0)).toBe(true);
  expect(round.board.at(-2)![0]).toBe(3);
  expect(round).toMatchObject({ color: 1, next: 2, outcome: null });
});

test("the mirrored eye line maps roll and an open mouth must be sustained through continuous frames", () => {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  landmarks[33] = { x: 0.3, y: 0.44 };
  landmarks[263] = { x: 0.7, y: 0.56 };
  const sample = faceAimSample(landmarks, 4 / 3, 0.9)!;
  expect(sample.roll).toBeLessThan(0);
  expect(rollAngle(sample.roll, 0)).toBeLessThan(0);
  expect(rollAngle(0.03, 0)).toBe(0);

  const input = new BubbleFaceInput();
  let time = 0;
  const advance = (aim: FaceAim, interval: number, playing = true) => {
    const shots: number[] = [];
    for (let end = time + interval; time < end; time += 50) {
      const shot = input.update(aim, time, playing);
      if (shot !== null) shots.push(shot);
    }
    return shots;
  };
  advance(mouthClosed, 800, false);
  expect(input.neutral).toBe(0);
  for (let i = 0; i < 8; i++) {
    expect(advance(mouthClosed, 200)).toEqual([]);
    expect(advance(mouthOpen, i % 2 ? 100 : 150)).toEqual([]);
  }
  expect(advance({ ...mouthOpen, jawOpen: 0.35 }, 600)).toEqual([]);
  advance({ ...mouthClosed, roll: 0.3 }, 400);
  expect(advance({ ...mouthOpen, roll: -0.3 }, 1500)).toEqual([input.angle]);
  expect(input.angle).toBeGreaterThan(0);
  expect(advance(mouthOpen, 1000)).toEqual([]);
  advance(mouthClosed, 200);
  advance(mouthOpen, 200);
  time += 300;
  expect(advance(mouthOpen, 700)).toEqual([]);
  advance(mouthClosed, 200);
  expect(advance(mouthOpen, 500)).toHaveLength(1);
});

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});
test.beforeEach(async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
});

test("the face filter opens the game, keyboard shots pop bubbles and a round saves", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.install();
  await page.goto("/games");
  const card = page.getByRole("link", { name: "버블 팡! 지금 플레이!" });
  await page.getByRole("button", { name: "얼굴 인식", exact: true }).click();
  await expect(card).toContainText("30발");
  await card.click();
  const stage = page.locator(".bubble-stage");
  const start = stage.getByRole("button", { name: "시작!", exact: true });
  await expect(start).toBeEnabled();
  await page.clock.pauseAt(new Date(Date.now() + 220));
  await start.evaluate((button: HTMLButtonElement) => button.click());
  await page.clock.runFor(1680);
  await page.keyboard.press("Space");
  await page.clock.runFor(730);
  expect(
    Number(await page.locator(".hud-panel.pink strong").textContent()),
  ).toBeGreaterThan(0);
  for (let i = 0; i < 29 && !page.url().includes("/result/"); i++) {
    await page.keyboard.press("Space");
    await page.clock.runFor(1050);
  }
  await expect(page).toHaveURL(/\/result\/bubble-shooter$/);
  const run = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.community.runs") ?? "[]").at(-1),
  );
  expect(run).toMatchObject({
    game: "bubble-shooter",
    details: { inputMode: "mouse" },
  });
  expect(run.details.metadata.bubblePopped).toBeGreaterThan(0);
});

test("the mode selector shows unlimited shots and a three-second row countdown", async ({ page }) => {
  await page.clock.install();
  await page.goto("/play/bubble-shooter");
  const stage = page.locator(".bubble-stage");
  const shots = page.locator(".hud-panel.cyan");
  await stage.getByRole("button", { name: "무한 모드", exact: true }).click();
  await expect(shots.locator("strong")).toHaveText("∞");
  await expect(shots).toContainText("발");
  await stage.getByRole("button", { name: "타임어택", exact: true }).click();
  await expect(shots).toContainText("다음 줄까지 3초");
  const start = stage.getByRole("button", { name: "시작!", exact: true });
  await page.clock.pauseAt(new Date(Date.now() + 220));
  await start.evaluate((button: HTMLButtonElement) => button.click());
  await page.clock.runFor(4050);
  await expect(shots).toContainText("다음 줄까지 1초");
  await page.clock.runFor(1000);
  await expect(shots).toContainText("다음 줄까지 3초");
});

test("webcam calibration enables a single deliberate mouth-open shot and keeps Space available", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const driver = window as Window & { bubblesAim: FaceAim | null };
    driver.bubblesAim = { roll: 0, jawOpen: 0.09 };
    window.Worker = class extends EventTarget {
      onmessage: ((event: MessageEvent) => void) | null = null;
      timer = 0;
      postMessage(message: {
        type: string;
        faceAim?: boolean;
        bitmap?: ImageBitmap;
      }) {
        message.bitmap?.close();
        if (message.type !== "init" || !message.faceAim) return;
        queueMicrotask(() => this.emit({ type: "ready" }));
        this.timer = window.setInterval(
          () =>
            this.emit({
              type: "result",
              box: { x: 0.3, y: 0.28, width: 0.4, height: 0.44 },
              aim: driver.bubblesAim,
              time: performance.now(),
            }),
          50,
        );
      }
      emit(data: unknown) {
        this.onmessage?.(new MessageEvent("message", { data }));
      }
      terminate() {
        window.clearInterval(this.timer);
      }
    } as unknown as typeof window.Worker;
  });
  await page.goto("/play/bubble-shooter");
  const stage = page.locator(".bubble-stage");
  await stage.getByRole("button", { name: "웹캠", exact: true }).click();
  const start = stage.getByRole("button", { name: "시작!", exact: true });
  await expect(start).toBeEnabled();
  await page.clock.pauseAt(new Date(Date.now() + 220));
  await start.evaluate((button: HTMLButtonElement) => button.click());
  await page.clock.runFor(1960);
  const preview = page.locator(".bubble-camera-preview video");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveJSProperty("hidden", false);
  const setFace = (aim: FaceAim | null) =>
    page.evaluate((value) => Object.assign(window, { bubblesAim: value }), aim);
  await setFace(mouthOpen);
  await page.clock.runFor(125);
  await setFace(mouthClosed);
  await page.clock.runFor(300);
  const shots = page.locator(".hud-panel.cyan strong");
  await expect(shots).toHaveText("30");
  await setFace(mouthOpen);
  await page.clock.runFor(1450);
  await expect(shots).toHaveText("29");
  await setFace(null);
  await page.clock.runFor(300);
  await expect(stage.locator(".bubble-tracking")).toBeVisible();
  await page.keyboard.press("Space");
  await page.clock.runFor(620);
  await expect(shots).toHaveText("28");
});
