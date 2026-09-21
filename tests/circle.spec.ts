import { test, expect } from "@playwright/test";

test("circle drawing evaluates, stores a record and can replay", async ({
  page,
}) => {
  await page.goto("/play/circle");
  await expect(page.getByRole("heading", { name: "원 그리기" })).toBeVisible();
  await page.getByRole("button", { name: "시작!", exact: true }).click();

  const canvas = page.locator(".circle-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const center = {
    x: box!.x + box!.width * 0.5,
    y: box!.y + box!.height * 0.5,
  };
  const radius = Math.min(box!.width, box!.height) * 0.3;
  await page.mouse.move(center.x + radius, center.y);
  await page.mouse.down();
  for (let index = 1; index <= 48; index += 1) {
    const angle = (Math.PI * 2 * index) / 48;
    await page.mouse.move(
      center.x + Math.cos(angle) * radius,
      center.y + Math.sin(angle) * radius,
    );
  }
  await page.mouse.up();

  await expect(page).toHaveURL(/\/result\/circle$/);
  await expect(page.locator(".circle-result")).toBeVisible();
  const result = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.circle.last") || "null"),
  );
  expect(result.score).toBeGreaterThan(0);
  expect(result.accuracy).toBeGreaterThan(0);
  await page.getByRole("button", { name: "다시 하기" }).click();
  await expect(page).toHaveURL(/\/play\/circle$/);
});

test("circle timeout records a zero result instead of leaving the game stuck", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/play/circle");
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  await page.clock.fastForward(20_100);
  await expect(page).toHaveURL(/\/result\/circle$/);
  await expect(page.locator(".result-stats")).toContainText("0");
});
