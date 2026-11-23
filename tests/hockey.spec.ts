import { expect, test } from "@playwright/test";
import { faceLandmarkBox, type FaceBox } from "../src/vision/face";
import {
  faceCrop,
  HockeyCalibration,
  hockeyFaceTarget,
} from "../src/games/hockeyFace";
import {
  GOAL_HALF_HEIGHT,
  HOCKEY_CENTER,
  HOCKEY_STEP,
  HOCKEY_WIDTH,
  PLAYER_HOME,
  PUCK_RADIUS,
  newHockey,
  stepHockey,
} from "../src/games/hockeyRules";
type HockeyTestWindow = Window & {
  hockeyBox: FaceBox | null;
  hockeyRequests: number;
  hockeyMallet: { x: number; y: number };
};

test("mallet speed adds power, both rails reflect the puck, and a goal serves once", () => {
  const hit = (targetX: number) => {
    const state = newHockey();
    state.serveIn = 0;
    state.puck = { x: PLAYER_HOME.x + 58, y: PLAYER_HOME.y, vx: -115, vy: 0 };
    expect(stepHockey(state, { ...PLAYER_HOME, x: targetX })).toBe("hit");
    return state.puck.vx;
  };
  expect(hit(410)).toBeGreaterThan(hit(PLAYER_HOME.x) + 250);

  const state = newHockey();
  state.serveIn = 0;
  state.puck = { x: PUCK_RADIUS, y: PUCK_RADIUS, vx: -200, vy: -200 };
  stepHockey(state, PLAYER_HOME);
  expect(state.puck.vx).toBeGreaterThan(0);
  expect(state.puck.vy).toBeGreaterThan(0);
  state.puck = {
    x: HOCKEY_WIDTH + PUCK_RADIUS - 1,
    y: HOCKEY_CENTER.y,
    vx: 480,
    vy: 0,
  };
  expect(stepHockey(state, PLAYER_HOME)).toBe("player");
  expect(state.puck).toMatchObject(HOCKEY_CENTER);
  expect(stepHockey(state, PLAYER_HOME)).toBeNull();
  expect(state.score).toEqual({ player: 1, cpu: 0 });

  const edgeY = HOCKEY_CENTER.y + GOAL_HALF_HEIGHT - PUCK_RADIUS + 10;
  state.serveIn = 0;
  state.puck = { x: PUCK_RADIUS, y: edgeY, vx: -480, vy: 0 };
  expect(stepHockey(state, PLAYER_HOME)).toBeNull();
  expect(state.puck.vx).toBeGreaterThan(0);
  state.puck = { x: HOCKEY_WIDTH + PUCK_RADIUS - 1, y: edgeY, vx: 480, vy: 0 };
  expect(stepHockey(state, PLAYER_HOME)).toBe("player");
});

test("five seconds of contact frees a puck pinned by the CPU in the top-right corner", () => {
  const state = newHockey();
  const right = HOCKEY_WIDTH - PUCK_RADIUS;
  const cpu = { x: HOCKEY_WIDTH - 49, y: 49 };
  state.serveIn = 0;
  state.puck = { x: right, y: PUCK_RADIUS, vx: 0, vy: 0 };
  state.players.cpu = { ...cpu, vx: 0, vy: 0 };
  state.cpuTarget = cpu;
  state.cpuThinkIn = 10;
  const stepsToRelease = Math.round(5 / HOCKEY_STEP);

  for (let i = 0; i < stepsToRelease - 1; i++) stepHockey(state, PLAYER_HOME);
  expect(state.puck).toMatchObject({ x: right, y: PUCK_RADIUS });
  expect(Math.hypot(state.puck.vx, state.puck.vy)).toBe(0);
  stepHockey(state, PLAYER_HOME);
  expect(state.contactSeconds.cpu).toBe(5);
  expect(state.puck.vx).toBeLessThan(0);
  expect(state.puck.vy).toBeGreaterThan(0);

  for (let i = 0; i < 27; i++) stepHockey(state, PLAYER_HOME);
  expect(state.puck.x).toBeLessThan(cpu.x - 20);
  expect(state.contactSeconds.cpu).toBe(5);
  for (let i = 0; i < 30; i++) stepHockey(state, PLAYER_HOME);
  expect(state.contactSeconds.cpu).toBe(0);

  state.puck = { x: right, y: PUCK_RADIUS, vx: 0, vy: 0 };
  stepHockey(state, PLAYER_HOME);
  expect(Math.hypot(state.puck.vx, state.puck.vy)).toBe(0);
  expect(state.contactSeconds.cpu).toBeCloseTo(HOCKEY_STEP);
});

test("position calibration stays centered and a camera-left movement is screen-right", () => {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  points[234].x = 0.32;
  points[454].x = 0.68;
  points[10].y = 0.29;
  points[152].y = 0.71;
  const box = faceLandmarkBox(points)!;
  expect(box.x).toBeCloseTo(0.32);
  expect(box.height).toBeCloseTo(0.42);
  expect(faceLandmarkBox(points.slice(0, 200))).toBeNull();

  const calibration = new HockeyCalibration();
  for (let t = 0; t < 800; t += 50)
    expect(calibration.add({ box, time: t })).toBeNull();
  const neutral = calibration.add({ box, time: 800 })!;
  expect(hockeyFaceTarget(box, neutral).x).toBeCloseTo(PLAYER_HOME.x);
  const moved = hockeyFaceTarget(
    { ...box, x: box.x - 0.1, y: box.y - 0.1 },
    neutral,
  );
  expect(moved.x).toBeGreaterThan(PLAYER_HOME.x + 90);
  expect(moved.y).toBeLessThan(PLAYER_HOME.y - 90);
  const crop = faceCrop({ ...box, x: 0.82, y: 0.8 }, 640, 480);
  expect(crop.x + crop.size).toBeLessThanOrEqual(640);
  expect(crop.y + crop.size).toBeLessThanOrEqual(480);
});

test.beforeEach(async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
});

test("hockey appears in face games and a round saves local scores and replays", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.install();
  await page.goto("/games");
  const card = page.getByRole("link", { name: "얼굴 하키 지금 플레이!" });
  await page.getByRole("button", { name: "손 인식", exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole("button", { name: "얼굴 인식", exact: true }).click();
  await expect(card).toContainText("약 60초");
  await card.click();
  const stage = page.locator(".hockey-stage");
  const start = stage.getByRole("button", { name: "시작!", exact: true });
  await expect(
    page.getByRole("progressbar", { name: "남은 시간" }),
  ).toHaveAttribute("max", "60");
  await expect(start).toBeEnabled();
  await page.clock.pauseAt(new Date(Date.now() + 250));
  await start.evaluate((button: HTMLButtonElement) => button.click());
  await page.clock.runFor(1650);
  const canvas = stage.locator("canvas");
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width * 0.31,
    bounds.y + bounds.height * 0.7,
  );
  await page.clock.runFor(450);
  const mallet = await canvas.evaluate((node: HTMLCanvasElement) =>
    Array.from(node.getContext("2d")!.getImageData(298, 339, 1, 1).data),
  );
  expect(mallet[0]).toBeLessThan(100);
  expect(mallet[2]).toBeGreaterThan(200);
  await page.clock.runFor(30_500);
  await expect(stage).toHaveAttribute("data-phase", "playing");
  await page.clock.runFor(30_000);
  await expect(page).toHaveURL(/\/result\/face-hockey$/);
  await expect(
    page.getByRole("heading", { name: "얼굴 하키", exact: true }),
  ).toBeVisible();
  const runs = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.community.runs") ?? "[]"),
  );
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({
    game: "face-hockey",
    seconds: 60,
    details: { inputMode: "mouse" },
  });
  await page.clock.resume();
  await page.reload();
  await page.getByRole("link", { name: "다시 하기" }).click();
  await expect(stage).toHaveAttribute("data-phase", "ready");
});

test("a shared webcam feeds a mirrored circular mallet and tracking loss pauses play", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const driver = window as HockeyTestWindow;
    driver.hockeyBox = { x: 0.32, y: 0.29, width: 0.36, height: 0.42 };
    driver.hockeyRequests = 0;
    const browserWorker = window.Worker;
    window.Worker = class extends EventTarget {
      onmessage: ((event: MessageEvent) => void) | null = null;
      timer = 0;
      constructor(url: URL | string, options?: WorkerOptions) {
        super();
        if (!String(url).includes("face.worker"))
          return new browserWorker(url, options) as unknown as typeof this;
      }
      postMessage(message: {
        type: string;
        faceGeometry?: boolean;
        bitmap?: ImageBitmap;
      }) {
        message.bitmap?.close();
        if (message.type !== "init" || !message.faceGeometry) return;
        queueMicrotask(() => this.emit({ type: "ready" }));
        this.timer = window.setInterval(
          () =>
            this.emit({
              type: "result",
              box: driver.hockeyBox,
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

    navigator.mediaDevices.getUserMedia = async () => {
      driver.hockeyRequests++;
      const feed = document.createElement("canvas");
      feed.width = 640;
      feed.height = 480;
      const ctx = feed.getContext("2d")!;
      const stream = feed.captureStream(0);
      const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
      function drawFeed() {
        ctx.fillStyle = "#d52e49";
        ctx.fillRect(0, 0, 320, 480);
        ctx.fillStyle = "#34cf52";
        ctx.fillRect(320, 0, 320, 480);
        track.requestFrame();
      }
      queueMicrotask(drawFeed);
      const timer = window.setInterval(() => {
        if (track.readyState === "ended") window.clearInterval(timer);
        else drawFeed();
      }, 50);
      return stream;
    };

    const originalArc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      if (
        args[0] === 0 &&
        args[1] === 0 &&
        args[2] === 43 &&
        (this.canvas as HTMLCanvasElement).matches(".hockey-board canvas")
      ) {
        const transform = this.getTransform();
        if (transform.e < 480)
          driver.hockeyMallet = { x: transform.e, y: transform.f };
      }
      return originalArc.apply(this, args);
    };
  });

  await page.goto("/play/face-hockey");
  const stage = page.locator(".hockey-stage");
  await stage.getByRole("button", { name: "웹캠", exact: true }).click();
  const start = stage.getByRole("button", { name: "시작!", exact: true });
  await expect(start).toBeEnabled();
  await page.clock.pauseAt(new Date(Date.now() + 250));
  await start.evaluate((button: HTMLButtonElement) => button.click());
  await page.clock.runFor(1650);
  await expect(stage).toHaveAttribute("data-phase", "playing");
  const canvas = stage.locator("canvas");
  const pixels = await canvas.evaluate((node: HTMLCanvasElement) => {
    const ctx = node.getContext("2d")!;
    const rgb = (x: number, y: number) =>
      Array.from(ctx.getImageData(x, y, 1, 1).data);
    return { left: rgb(224, 270), right: rgb(256, 270), corner: rgb(212, 245) };
  });
  expect(pixels.left[1]).toBeGreaterThan(170);
  expect(pixels.left[0]).toBeLessThan(110);
  expect(pixels.right[0]).toBeGreaterThan(155);
  expect(pixels.right[1]).toBeLessThan(100);
  expect(pixels.corner[1]).toBeGreaterThan(170);
  expect(pixels.corner[2]).toBeGreaterThan(200);
  expect(
    await page.evaluate(() => (window as HockeyTestWindow).hockeyRequests),
  ).toBe(1);

  await page.evaluate(() => {
    (window as HockeyTestWindow).hockeyBox = {
      x: 0.22,
      y: 0.19,
      width: 0.36,
      height: 0.42,
    };
  });
  await page.clock.runFor(350);
  const moved = await page.evaluate(
    () => (window as HockeyTestWindow).hockeyMallet,
  );
  expect(moved.x).toBeGreaterThan(310);
  expect(moved.y).toBeLessThan(190);
  await page.evaluate(() => {
    (window as HockeyTestWindow).hockeyBox = null;
  });
  await page.clock.runFor(350);
  await expect(stage.locator(".hockey-tracking")).toBeVisible();
  const time = page.getByRole("progressbar", { name: "남은 시간" });
  const value = await time.getAttribute("value");
  await page.clock.runFor(1500);
  await expect(time).toHaveAttribute("value", value!);
  await page.evaluate(() => {
    (window as HockeyTestWindow).hockeyBox = {
      x: 0.32,
      y: 0.29,
      width: 0.36,
      height: 0.42,
    };
  });
  await page.clock.runFor(1100);
  await expect(stage.locator(".hockey-tracking")).toHaveCount(0);
  expect(Number(await time.getAttribute("value"))).toBeLessThan(Number(value));
});
