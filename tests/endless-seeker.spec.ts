import { test, expect } from "@playwright/test";
import { pointingDirection } from "../src/vision/pointingDirection";
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});
import { newDodge, advanceDodge, dodgeFinished } from "../src/games/dodgeRules";
test("index direction is mirrored, rejects diagonals and curled fingers", () => {
  const p = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  p[5] = { x: 0.5, y: 0.5 };
  p[17] = { x: 0.65, y: 0.5 };
  p[6] = { x: 0.5, y: 0.45 };
  p[8] = { x: 0.5, y: 0.25 };
  expect(pointingDirection(p)).toBe("up");
  p[8] = { x: 0.25, y: 0.5 };
  expect(pointingDirection(p)).toBe("right");
  p[8] = { x: 0.75, y: 0.5 };
  expect(pointingDirection(p)).toBe("left");
  p[8] = { x: 0.5, y: 0.75 };
  expect(pointingDirection(p)).toBe("down");
  p[8] = { x: 0.49, y: 0.49 };
  expect(pointingDirection(p)).toBe("center");
  expect(pointingDirection([])).toBe("center");
});
test("endless dodge continues beyond finite modes and still ends on lost lives", () => {
  let s = { ...newDodge(), elapsed: 120, spawnIn: 10 };
  s = advanceDodge(s, 0.2, 0.5, () => 1, Infinity);
  expect(s.elapsed).toBeGreaterThan(120);
  expect(dodgeFinished(s, Infinity)).toBe(false);
  expect(dodgeFinished({ ...s, lives: 0 }, Infinity)).toBe(true);
});
for (const game of ["shoot", "dodge"])
  test(`${game} endless survives 60 seconds, saves and uses its own ranking`, async ({
    page,
  }) => {
    await page.clock.install();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    await page.goto(`/play/${game}`);
    await page.getByRole("button", { name: "무한 모드", exact: true }).click();
    await page
      .getByRole("button", {
        name: game === "shoot" ? "시작!" : "게임 시작!",
        exact: true,
      })
      .click();
    await page.clock.runFor(65000);
    await expect(page).toHaveURL(new RegExp(`play/${game}`));
    await page.getByRole("button", { name: "그만하고 기록 저장" }).click();
    await expect(page).toHaveURL(new RegExp(`result/${game}`));
    const run = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("arcade.community.runs") || "[]").at(-1),
    );
    expect(run.details.gameMode).toBe("endless");
    expect(run.seconds).toBeGreaterThan(60);
  });
test("seeker hints the computer direction, scores matching input, and records separately", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto("/play/cham");
  await page.getByRole("button", { name: "내가 술래", exact: true }).click();
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  for (let i = 0; i < 10; i++) {
    await page.clock.runFor(1520);
    await expect(page.getByTestId("cham-arrow")).toHaveText("?");
    await expect(page.getByTestId("seeker-tell")).toHaveAttribute(
      "data-direction",
      "left",
    );
    await page.getByRole("button", { name: "왼쪽", exact: true }).click();
    await page.clock.runFor(1040);
  }
  await expect(page).toHaveURL(/result\/cham/);
  const run = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.community.runs") || "[]").at(-1),
  );
  expect(run.score).toBe(1000);
  expect(run.details.gameMode).toBe("seeker");
});

test("seeker switches webcam tracking to hands and accepts a stable index direction", async ({
  page,
}) => {
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
        if (!String(url).includes("hand.worker"))
          return new OriginalWorker(url, options) as unknown as typeof this;
        window.addEventListener("test-hand", this.listener);
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
        window.removeEventListener("test-hand", this.listener);
      }
    } as unknown as typeof Worker;
    Math.random = () => 0.3;
  });
  await page.clock.install();
  await page.goto("/play/cham?role=seeker");
  await page
    .getByRole("button", { name: "손으로 플레이", exact: true })
    .click();
  const p = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  p[5] = { x: 0.5, y: 0.5 };
  p[17] = { x: 0.65, y: 0.5 };
  p[6] = { x: 0.5, y: 0.45 };
  p[8] = { x: 0.5, y: 0.25 };
  p[4] = { x: 0.3, y: 0.5 };
  const send = () =>
    page.evaluate(
      (points) =>
        window.dispatchEvent(new CustomEvent("test-hand", { detail: points })),
      p,
    );
  for (let i = 0; i < 15; i++) {
    await send();
    await page.clock.runFor(80);
  }
  await expect(
    page.getByRole("button", { name: "시작!", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  for (let i = 0; i < 28; i++) {
    await send();
    await page.clock.runFor(80);
    if (
      (await page.locator(".cham-cue").getAttribute("data-phase")) ===
      "feedback"
    )
      break;
  }
  await expect(page.locator(".cham-cue")).toContainText("잡았다!");
});
