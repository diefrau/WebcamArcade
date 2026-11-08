import { test, expect } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

for (const [random, direction, button] of [
  [0, "left", "왼쪽"],
  [0.3, "up", "위"],
  [0.6, "down", "아래"],
  [0.9, "right", "오른쪽"],
] as const) {
  test(`seeker previews ${direction} late in countdown and accepts it at GO`, async ({
    page,
  }) => {
    await page.clock.install();
    await page.addInitScript((value) => {
      Math.random = () => value;
    }, random);
    await page.goto("/play/cham?role=seeker");
    await page.getByRole("button", { name: "시작!", exact: true }).click();
    const tell = page.getByTestId("seeker-tell");
    await page.clock.runFor(800);
    await expect(tell).toHaveAttribute("data-direction", "center");
    await page.clock.runFor(200);
    await expect(tell).toHaveAttribute("data-direction", direction);
    await expect(tell.getByRole("status")).toContainText(button);
    expect(
      await tell.evaluate((el) => getComputedStyle(el).transform),
    ).not.toBe("matrix(1, 0, 0, 1, 0, 0)");
    await page.clock.runFor(550);
    await expect(page.getByTestId("cham-arrow")).toHaveText("?");
    await expect(tell).toHaveAttribute("data-direction", direction);
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.locator(".cham-cue")).toContainText("잡았다!");
  });
}

test("pausing and GO never change the direction already previewed", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto("/play/cham?role=seeker");
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  await page.clock.runFor(1000);
  await expect(page.getByTestId("seeker-tell")).toHaveAttribute(
    "data-direction",
    "left",
  );
  await page.evaluate(() => {
    Math.random = () => 0.9;
  });
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.clock.runFor(5000);
  await page.getByRole("button", { name: "계속하기", exact: true }).click();
  await expect(page.getByTestId("seeker-tell")).toHaveAttribute(
    "data-direction",
    "left",
  );
  await page.clock.runFor(550);
  await expect(page.getByTestId("seeker-tell")).toHaveAttribute(
    "data-direction",
    "left",
  );
  await page.getByRole("button", { name: "왼쪽", exact: true }).click();
  await expect(page.locator(".cham-cue")).toContainText("잡았다!");
});
