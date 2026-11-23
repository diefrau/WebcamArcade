import { expect, test } from "@playwright/test";

test("large displays scale the home cards, play area, and practice dialog", async ({ page }) => {
  const heightOf = async (selector: string) =>
    (await page.locator(selector).first().boundingBox())!.height;
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await expect(page.locator(".featured .game-card").first()).toBeVisible();
  const cardHeight = await heightOf(".featured .game-card");

  for (const width of [3840, 4096]) {
    await page.setViewportSize({ width, height: 2160 });
    await page.goto("/");
    expect(await heightOf(".featured .game-card")).toBeGreaterThan(cardHeight * 1.6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await page.goto("/play/circle");
    expect(await heightOf(".circle-stage")).toBeGreaterThan(1050);
    await page.getByRole("button", { name: "입력 연습", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "입력 연습", exact: true });
    const box = (await dialog.boundingBox())!;
    expect(box.width).toBeGreaterThan(950);
    expect(box.y).toBeGreaterThan(0);
    expect(box.y + box.height).toBeLessThan(2160);

    const field = (await dialog.locator(".practice-field").boundingBox())!;
    await page.mouse.move(field.x + field.width * 0.8, field.y + field.height * 0.5);
    await page.mouse.down();
    for (let step = 1; step <= 24; step++) {
      const angle = step * Math.PI / 12;
      await page.mouse.move(
        field.x + field.width * (0.5 + 0.3 * Math.cos(angle)),
        field.y + field.height * (0.5 + 0.3 * Math.sin(angle)),
      );
    }
    await page.mouse.up();
    await expect(dialog.getByRole("status")).toHaveText("연습 완료!");
  }
});
