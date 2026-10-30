import { test, expect } from "@playwright/test";
import {
  classifyRps,
  rpsChoices,
  rpsOutcome,
  rpsPoints,
  type RpsChoice,
} from "../src/games/rpsRules";
import type { Landmark } from "../src/vision/gestures";

function posePoints(pose: RpsChoice): Landmark[] {
  const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8, z: 0 }));
  points[0] = { x: 0.5, y: 0.9, z: 0 };
  points[4] = { x: 0.2, y: 0.6, z: 0 };
  [5, 9, 13, 17].forEach((mcp, finger) => {
    const x = 0.38 + finger * 0.08;
    const open = pose === "paper" || (pose === "scissors" && finger < 2);
    points[mcp] = { x, y: 0.65, z: 0 };
    points[mcp + 1] = { x, y: 0.5, z: 0 };
    points[mcp + 2] = { x: x + (open ? 0 : 0.03), y: open ? 0.35 : 0.6, z: 0 };
    points[mcp + 3] = { x, y: open ? 0.22 : 0.7, z: 0 };
  });
  return points;
}

test("RPS evaluates every matchup and classifies shapes across size, rotation and mirroring", () => {
  const expected = [
    ["draw", "lose", "win"],
    ["win", "draw", "lose"],
    ["lose", "win", "draw"],
  ];
  rpsChoices.forEach((player, i) =>
    rpsChoices.forEach((computer, j) =>
      expect(rpsOutcome(player, computer)).toBe(expected[i][j]),
    ),
  );
  expect(rpsOutcome(null, "rock")).toBe("timeout");
  expect(rpsPoints("win")).toBe(100);
  expect(rpsPoints("draw")).toBe(30);
  for (const choice of rpsChoices)
    for (const scale of [0.4, 1])
      for (const mirror of [-1, 1]) {
        const transformed = posePoints(choice).map((p) => {
          const x = (p.x - 0.5) * scale * mirror,
            y = (p.y - 0.5) * scale;
          return {
            x: 0.45 + x * Math.cos(0.6) - y * Math.sin(0.6),
            y: 0.4 + x * Math.sin(0.6) + y * Math.cos(0.6),
          };
        });
        expect(classifyRps(transformed, 1)).toBe(choice);
      }
  expect(classifyRps([])).toBeNull();
  expect(
    classifyRps(Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))),
  ).toBeNull();
  const invalid = posePoints("paper");
  invalid[8].x = NaN;
  expect(classifyRps(invalid)).toBeNull();
  const unknown = posePoints("rock");
  unknown[8] = posePoints("paper")[8];
  expect(classifyRps(unknown)).toBeNull();
});

test.use({
  reducedMotion: "reduce",
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});
test("five button rounds preserve pause, store exact records, reload and replay", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.clock.install();
  await page.goto("/games");
  await page.getByRole("link", { name: "가위바위보 지금 플레이!" }).click();
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  for (let i = 0; i < 5; i++) {
    await page.clock.fastForward(1520);
    await expect(page.locator(".rps-cue")).toHaveAttribute(
      "data-phase",
      "respond",
    );
    if (i === 0) {
      await page.getByRole("button", { name: "일시정지", exact: true }).click();
      const time = await page
        .locator(".rps-stage progress")
        .getAttribute("value");
      await page.clock.fastForward(5000);
      await expect(page.locator(".rps-stage progress")).toHaveAttribute(
        "value",
        time!,
      );
      await page
        .getByRole("button", { name: "계속하기", exact: true })
        .last()
        .click();
    }
    if (i === 1) await page.keyboard.press("2");
    else await page.getByRole("button", { name: "보", exact: true }).click();
    await expect(page.locator(".rps-cue")).toContainText("이겼다!");
    await page.clock.fastForward(1040);
  }
  await expect(page).toHaveURL(/\/result\/rps$/);
  await expect(page.locator(".result-stats")).toContainText("500");
  const record = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.rps")!),
  );
  expect(record.best).toBe(500);
  expect(record.plays).toBe(1);
  expect(record.last.wins).toBe(5);
  const evidence = await page.evaluate(() => ({
    run: JSON.parse(localStorage.getItem("arcade.community.runs")!)[0],
    state: JSON.parse(localStorage.getItem("arcade.achievements.v1")!),
  }));
  expect(evidence.run.details.rounds).toHaveLength(5);
  expect(evidence.state.unlockedIds).toContain("rpsStreak5");
  expect(evidence.state.unlockedIds).not.toContain("rpsRecognized");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("arcade.records")!).daily,
    ),
  ).toBe(1);
  await page.reload();
  await expect(page.locator(".result-stats")).toContainText("500");
  await page.getByRole("link", { name: "다시 하기", exact: true }).click();
  await expect(page.locator(".rps-cue")).toHaveAttribute("data-phase", "ready");
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  for (let i = 0; i < 5; i++) {
    await page.clock.fastForward(1520);
    await page.clock.fastForward(3040);
    await page.clock.fastForward(1040);
  }
  await expect(page).toHaveURL(/\/result\/rps$/);
  await expect(page.locator(".result-stats")).toContainText("0");
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.rps")!),
  );
  expect(after.plays).toBe(2);
  expect(after.best).toBe(500);
  expect(
    after.last.rounds.every(
      (r: { outcome: string }) => r.outcome === "timeout",
    ),
  ).toBe(true);
});

test("empty and malformed records stay honest; Korean and English fit narrow screens", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "arcade.rps",
      JSON.stringify({ best: 100, plays: 1, last: { rounds: [null] } }),
    ),
  );
  await page.goto("/result/rps");
  await expect(
    page.getByRole("heading", { name: "아직 플레이 기록이 없어요." }),
  ).toBeVisible();
  for (const language of ["ko", "en"]) {
    await page.evaluate(
      (lang) => localStorage.setItem("arcade.language", JSON.stringify(lang)),
      language,
    );
    for (const width of [320, 390, 768, 1920]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.goto("/play/rps");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.locator(".arcade-button[data-hand-click]"),
      ).toBeVisible();
    }
  }
});

test.describe("RPS webcam", () => {
  test("a stable hand shape scores; hand loss pauses and button fallback resumes", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Math.random = () => 0;
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
    await page.clock.install();
    await page.goto("/play/rps");
    await page
      .getByRole("button", { name: "손으로 플레이", exact: true })
      .click();
    await expect(page.locator(".camera-note")).toContainText(
      "손바닥을 카메라에 보여주세요!",
    );
    const send = (points: Landmark[] | undefined) =>
      page.evaluate(
        (data) =>
          window.dispatchEvent(new CustomEvent("test-hand", { detail: data })),
        points,
      );
    await send(posePoints("paper"));
    await expect(page.locator(".rps-tracking")).toContainText("보");
    await page.getByRole("button", { name: "시작!", exact: true }).click();
    // Stop at the observed feedback phase instead of assuming a fixed number
    // of frames; clocked inference can run faster on a busy test machine.
    for (let i = 0; i < 50; i++) {
      await send(posePoints("paper"));
      await page.clock.runFor(80);
      if (
        (await page.locator(".rps-cue").getAttribute("data-phase")) ===
        "feedback"
      )
        break;
    }
    await expect(page.locator(".rps-cue")).toHaveAttribute(
      "data-phase",
      "feedback",
    );
    await expect(page.locator(".rps-cue")).toContainText("이겼다!");
    await send(undefined);
    await page.clock.runFor(840);
    await expect(page.locator(".rps-cue")).toHaveAttribute(
      "data-phase",
      "paused",
    );
    await expect(
      page.locator(".arcade-button[data-hand-click]"),
    ).toBeDisabled();
    await page
      .locator(".cham-dialog")
      .getByRole("button", { name: "버튼으로 플레이", exact: true })
      .click();
    await page.locator(".arcade-button[data-hand-click]").click();
    await expect(page.locator(".rps-cue")).not.toHaveAttribute(
      "data-phase",
      "paused",
    );
  });
});
