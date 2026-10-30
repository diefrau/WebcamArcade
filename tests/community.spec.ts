import { test, expect } from "@playwright/test";
import { progressFor, type Run } from "../src/community/store";
test("achievements require completed valid runs and game-specific thresholds", () => {
  const run = (
    game: Run["game"],
    score: number,
    accuracy = 0,
    seconds = 0,
  ): Run => ({
    id: crypto.randomUUID(),
    game,
    score,
    accuracy,
    seconds,
    date: new Date().toISOString(),
  });
  expect(progressFor([]).first).toBe(false);
  const p = progressFor([
    run("shoot", 100, 90),
    run("circle", 800),
    run("cham", 700),
    run("rps", 300),
    run("dodge", 300, 0, 30),
  ]);
  expect(
    Object.entries(p)
      .filter(([key]) => key !== "counts" && key !== "playedGames")
      .every(([, value]) => value === true),
  ).toBe(true);
  expect(progressFor([run("shoot", 0, 100)]).sharp).toBe(false);
});
test("rankings and achievements show honest device data without network configuration", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "arcade.records",
      JSON.stringify({ best: 1200, plays: 1, daily: 1 }),
    ),
  );
  await page.goto("/");
  await page.getByRole("link", { name: "랭킹", exact: true }).click();
  await expect(page.locator(".local-score")).toContainText("1,200");
  await expect(
    page.getByRole("button", { name: "온라인", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "도전과제", exact: true }).click();
  await expect(page.locator(".achievement-grid article")).toHaveCount(74);
  await expect(page.locator(".achievement.unlocked")).toHaveCount(0);
});
test("all completed game results integrate with local community history", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => (Math.random = () => 1));
  await page.goto("/play/dodge");
  await page.getByRole("button", { name: "게임 시작!", exact: true }).click();
  await page.clock.runFor(33500);
  await expect(page).toHaveURL(/result\/dodge$/);
  const runs = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.community.runs")!),
  );
  expect(runs).toHaveLength(1);
  expect(runs[0].game).toBe("dodge");
  expect(runs[0].seconds).toBe(30);
  expect(runs[0].details.metadata.maxSafeSeconds).toBeGreaterThanOrEqual(29.9);
  expect(runs[0].details.metadata.maxAvoidStreak).toBeGreaterThanOrEqual(10);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("arcade.achievements.v1")!).stats
          .totalGamesCompleted,
    ),
  ).toBe(1);
  await page.getByRole("link", { name: "도전과제", exact: true }).click();
  await expect(page.locator(".achievement.unlocked")).toHaveCount(7);
  await page.reload();
  await expect(page.locator(".achievement.unlocked")).toHaveCount(7);
});
test("touch detection removes mouse hints but retains playable controls and navigation", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/play/shoot");
  await expect(page.locator("html")).toHaveAttribute("data-input", "touch");
  await expect(
    page.getByRole("button", { name: "터치로 플레이", exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(".crosshair")).toBeHidden();
  await expect(page.locator(".play-side")).toContainText("터치");
  await page.getByRole("button", { name: "시작!", exact: true }).tap();
  await page.getByTestId("target-1").tap();
  await expect(page.locator(".hud-panel").first()).toContainText("100");
  await page.goto("/play/circle");
  await expect(
    page.getByRole("button", { name: "터치로 플레이", exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "시작!", exact: true }).tap();
  const canvas = page.locator(".circle-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const radius = Math.min(box.width, box.height) * 0.28;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: center.x + radius, y: center.y }],
  });
  for (let i = 1; i <= 48; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: center.x + Math.cos((i * Math.PI) / 24) * radius,
          y: center.y + Math.sin((i * Math.PI) / 24) * radius,
        },
      ],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page).toHaveURL(/result\/circle$/);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("arcade.circle.last")!).score,
    ),
  ).toBeGreaterThan(0);
  await page.goto("/ranking");
  await expect(
    page.getByRole("link", { name: "도전과제", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});
