import { test, expect } from "@playwright/test";
import { advanceDodge, dodgeFinished, newDodge } from "../src/games/dodgeRules";

test("vertical modes mix both sides with falling obstacles and score side dodges once", () => {
  for (const duration of [30, Infinity]) {
    let state = newDodge();
    const spawned = new Map<number, "left" | "right" | undefined>();
    for (let i = 0; i < 16; i++) {
      state = advanceDodge(state, 0.25, 0.5, () => 0, duration, 0.87);
      for (const obstacle of state.obstacles)
        spawned.set(obstacle.id, obstacle.side);
    }
    expect([...spawned.values()].slice(0, 4)).toEqual([
      undefined,
      "left",
      undefined,
      "right",
    ]);
  }

  for (const side of ["left", "right"] as const) {
    const state = {
      ...newDodge(),
      spawnIn: 10,
      obstacles: [{ id: 0, side, x: side === "left" ? 0.4 : 0.6, y: 0.87 }],
    };
    const hit = advanceDodge(state, 0.25, 0.5, () => 0, 30, 0.87);
    expect(hit.hits).toBe(1);
    expect(hit.obstacles).toHaveLength(0);

    let movedUp = { ...state, y: 0.6 };
    for (let i = 0; i < 16; i++)
      movedUp = advanceDodge(movedUp, 0.25, 0.5, () => 0, 30, 0.6);
    expect(movedUp.hits).toBe(0);
    expect(movedUp.dodged).toBe(1);
    expect(movedUp.obstacles).toHaveLength(0);
  }
});

test("dodge hard starts fast and endless difficulty keeps rising beyond 30 seconds", () => {
  const spawn = (elapsed: number, duration: number) =>
    advanceDodge(
      { ...newDodge(), elapsed, spawnIn: 0 },
      0.02,
      0.5,
      () => 0,
      duration,
    );
  const opening = spawn(0, Infinity);
  const hard = spawn(0, 30);
  expect(hard.obstacles[0].y).toBeGreaterThan(opening.obstacles[0].y);
  expect(hard.spawnIn).toBeLessThan(opening.spawnIn);
  const atThirty = spawn(30, Infinity);
  const atNinety = spawn(90, Infinity);
  expect(atNinety.obstacles[0].y).toBeGreaterThan(atThirty.obstacles[0].y);
  expect(atNinety.spawnIn).toBeLessThan(atThirty.spawnIn);
});

test("endless dodge runs beyond 30 seconds and vertical movement changes collisions", () => {
  const late = { ...newDodge(), elapsed: 30, spawnIn: 10 };
  const next = advanceDodge(late, 0.2, 0.5, () => 1, Infinity, 0.55);
  expect(next.elapsed).toBeGreaterThan(30);
  expect(next.y).toBeLessThan(0.7);
  expect(dodgeFinished(next, Infinity)).toBe(false);
  const obstacle = { id: 1, x: 0.5, y: 0.59 };
  const collision = advanceDodge(
    { ...newDodge(), y: 0.6, spawnIn: 10, obstacles: [obstacle] },
    0.02,
    0.5,
    () => 1,
    Infinity,
    0.6,
  );
  expect(collision.hits).toBe(1);
});

test("wave ends after 12 hits and unlocks its achievement", async ({
  page,
}) => {
  await page.goto("/games");
  await page.getByRole("link", { name: "쏴! 지금 플레이!" }).click();
  await page.getByRole("button", { name: "타깃 웨이브" }).click();
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  for (let i = 0; i < 12; i++)
    await page.getByTestId("target-1").dispatchEvent("click");
  await expect(page).toHaveURL(/result\/shoot/);
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.achievements.v1") || "{}"),
  );
  expect(state.unlockedIds).toContain("shootAll");
});

test("survival and vertical modes expose accessible controls and movement", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/games");
  await page.getByRole("link", { name: "빨리 피해! 지금 플레이!" }).click();
  await expect(
    page.getByRole("button", { name: "생존!", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "60초 생존" })).toHaveCount(0);
  await page.getByRole("button", { name: "상하 이동" }).click();
  await expect(page.locator(".timer-bar progress")).toHaveCount(0);
  await page.getByRole("button", { name: "게임 시작!", exact: true }).click();
  await page.clock.runFor(3200);
  await page.keyboard.down("ArrowUp");
  await page.clock.runFor(400);
  await page.keyboard.up("ArrowUp");
  const y = await page
    .locator(".dodge-player")
    .evaluate((el) => parseFloat((el as HTMLElement).style.top));
  expect(y).toBeLessThan(65);
});

test("hardest cham mode completes ten rounds and unlocks its achievement", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/games");
  await page.getByRole("link", { name: "참!참!참! 지금 플레이!" }).click();
  await page.getByRole("button", { name: "최고 난이도" }).click();
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  await page.clock.runFor(32000);
  await expect(page).toHaveURL(/result\/cham/);
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.achievements.v1") || "{}"),
  );
  expect(state.unlockedIds).toContain("chamMaster");
});

test("retired 60-second links open Survive and its minute achievement still unlocks", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    Math.random = () => 1;
  });
  await page.goto("/play/dodge?mode=survival");
  await expect(
    page.getByRole("button", { name: "생존!", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "게임 시작!", exact: true }).click();
  await page.clock.runFor(64000);
  await expect(page).toHaveURL(/play\/dodge/);
  await page.getByRole("button", { name: "그만하고 기록 저장" }).click();
  await expect(page).toHaveURL(/result\/dodge/);
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.achievements.v1") || "{}"),
  );
  expect(state.unlockedIds).toContain("dodgeMinute");
});

test("device rankings keep legacy and new mode records separate", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "arcade.records",
      JSON.stringify({ best: 1200, plays: 1, daily: 1 }),
    );
    localStorage.setItem(
      "arcade.community.runs",
      JSON.stringify([
        {
          id: "11111111-1111-4111-8111-111111111111",
          game: "shoot",
          score: 1900,
          accuracy: 100,
          seconds: 10,
          date: new Date().toISOString(),
          details: { gameMode: "wave" },
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          game: "cham",
          score: 500,
          accuracy: 0,
          seconds: 0,
          date: new Date().toISOString(),
          details: { gameMode: "hard" },
        },
      ]),
    );
  });
  await page.goto("/ranking");
  await expect(page.locator(".local-score")).toContainText("1,200");
  await page
    .getByRole("group", { name: "게임 모드" })
    .getByRole("button", { name: "타깃 웨이브" })
    .click();
  await expect(page.locator(".local-score")).toContainText("1,900");
  await page
    .locator(".community-games")
    .first()
    .getByRole("button", { name: "참!참!참!" })
    .click();
  await expect(page.locator(".local-score")).toContainText("0");
  await page
    .getByRole("group", { name: "게임 모드" })
    .getByRole("button", { name: "최고 난이도" })
    .click();
  await expect(page.locator(".local-score")).toContainText("500");
});

test("vertical mode unlocks only after moving both directions and finishing", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto("/games");
  await page.getByRole("link", { name: "빨리 피해! 지금 플레이!" }).click();
  await page.getByRole("button", { name: "상하 이동" }).click();
  await page.getByRole("button", { name: "30초 하드 모드" }).click();
  await page.getByRole("button", { name: "게임 시작!", exact: true }).click();
  await page.clock.runFor(3200);
  await page.keyboard.down("ArrowUp");
  await page.clock.runFor(450);
  await page.keyboard.up("ArrowUp");
  await page.keyboard.down("ArrowDown");
  await page.clock.runFor(850);
  await page.keyboard.up("ArrowDown");
  await page.clock.runFor(32000);
  await expect(page).toHaveURL(/result\/dodge/);
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.achievements.v1") || "{}"),
  );
  expect(state.unlockedIds).toContain("dodgeDance");
});
