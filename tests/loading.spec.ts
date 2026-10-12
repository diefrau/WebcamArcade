import { test, expect } from "@playwright/test";

test("routes stay visible and usable while fonts and artwork are pending", async ({
  page,
}) => {
  await page.addInitScript(() => {
    document.fonts.load = () => new Promise(() => {});
  });
  await page.route("**/dog-full-circle.webp", (route) => route.abort());
  await page.goto("/play/circle", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".arcade-loading, #arcade-boot")).toHaveCount(0);
  await expect(page.locator(".route-content")).not.toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  await expect(page.locator(".circle-overlay")).toHaveCount(0);
  await page.getByRole("button", { name: "뒤로", exact: true }).click();
  await expect(page).toHaveURL(/\/games$/);
  await expect(page.locator(".arcade-loading, #arcade-boot")).toHaveCount(0);
  await page.getByRole("link", { name: "쏴! 지금 플레이!" }).click();
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  await page.getByTestId("target-1").click();
  await expect(page.locator(".hud-panel").first()).toContainText("100");
});
