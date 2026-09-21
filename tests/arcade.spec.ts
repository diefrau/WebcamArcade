import { test, expect } from "@playwright/test";

test("home, filters, language and settings work", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "게임 시작!" })).toBeVisible();
  await page.screenshot({ path: "artifacts/home-ko.png", fullPage: true });
  await page.getByRole("button", { name: "게임 시작!" }).click();
  await expect(page).toHaveURL(/\/games$/);
  await page.getByRole("button", { name: "얼굴 인식", exact: true }).click();
  await expect(page.locator(".selection-games .game-card")).toHaveCount(1);
  await page.getByRole("button", { name: "전체", exact: true }).click();
  await expect(page.locator(".selection-games .game-card")).toHaveCount(3);
  await page.screenshot({ path: "artifacts/games-ko.png", fullPage: true });
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByRole("combobox").selectOption("en");
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await expect(
    page.getByRole("heading", { name: "PICK A GAME!" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "PICK A GAME!" }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/games-en.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("shooting, pause, timer, results, replay and storage", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/play/shoot");
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  for (let i = 0; i < 6; i++) await page.getByTestId("target-1").click();
  expect(await page.locator(".app-shell").evaluate((el) => el.scrollLeft)).toBe(
    0,
  );
  expect(await page.locator(".playfield").evaluate((el) => el.scrollLeft)).toBe(
    0,
  );
  await expect(page.locator(".hud-panel").first()).toContainText("900");
  await page.getByRole("button", { name: "일시정지" }).click();
  const pausedTime = await page.locator(".timer-bar b").textContent();
  await page.clock.fastForward(10000);
  await expect(page.locator(".timer-bar b")).toHaveText(pausedTime!);
  await page.getByRole("button", { name: "계속하기" }).click();
  await page.screenshot({ path: "artifacts/play.png", fullPage: true });
  await page.clock.fastForward(30050);
  await expect(page).toHaveURL(/\/result\/shoot$/);
  await expect(page.locator(".result-stats")).toContainText("900");
  await expect(page.locator(".result-stats")).toContainText("100");
  await page.clock.fastForward(350);
  await page.screenshot({ path: "artifacts/result.png", fullPage: true });
  await page.reload();
  await expect(page.locator(".result-stats")).toContainText("900");
  const records = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.records")!),
  );
  expect(records.plays).toBe(1);
  expect(records.best).toBe(900);
  await page.getByRole("button", { name: "다시 하기" }).click();
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  for (let i = 0; i < 5; i++)
    await page.locator(".playfield").click({ position: { x: 10, y: 10 } });
  await expect(page).toHaveURL(/\/result\/shoot$/);
  await expect(page.locator(".result-stats")).toContainText("0");
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.records")!),
  );
  expect(after.plays).toBe(2);
  expect(after.best).toBe(900);
  expect(after.last.accuracy).toBe(0);
});

test("empty results and narrow layouts are honest and usable", async ({
  page,
}) => {
  await page.goto("/result/shoot");
  await expect(
    page.getByRole("heading", { name: "아직 플레이 기록이 없어요." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "artifacts/home-mobile.png", fullPage: true });
});
