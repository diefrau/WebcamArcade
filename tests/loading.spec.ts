import { test, expect } from "@playwright/test";

test("loading waits for actual artwork, blocks input, and reveals a decoded screen", async ({
  page,
}) => {
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/dog-full-circle.webp", async (route) => {
    await delayed;
    await route.continue();
  });
  await page.goto("/play/circle", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("progressbar", { name: "화면 준비 진행률" }),
  ).toBeVisible();
  await expect(page.locator(".route-content")).toHaveAttribute("inert", "");
  await expect(page.getByRole("progressbar")).not.toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await page.screenshot({ path: "artifacts/loading-desktop.png" });
  release();
  await expect(page.locator(".arcade-loading")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "시작!", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator(".route-content img")
      .evaluateAll((images) =>
        images.every(
          (image) =>
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth > 0,
        ),
      ),
  ).toBe(true);
  await page.getByRole("button", { name: "뒤로", exact: true }).click();
  await expect(page).toHaveURL(/\/games$/);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-ready",
    "true",
  );
});

test("font readiness gates the screen even when artwork is cached", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = document.fonts.load.bind(document.fonts);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    (window as unknown as { releaseFonts: () => void }).releaseFonts = release;
    document.fonts.load = async (...args) => {
      await pending;
      return original(...args);
    };
  });
  await page.goto("/play/shoot", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".arcade-loading")).toBeVisible();
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-ready",
    "false",
  );
  await page.evaluate(() =>
    (window as unknown as { releaseFonts: () => void }).releaseFonts(),
  );
  await expect(page.locator(".arcade-loading")).toHaveCount(0);
});

test("failed images offer recovery and retry succeeds without faking completion", async ({
  page,
}) => {
  await page.route("**/dog-full-circle.webp", (route) => route.abort());
  await page.goto("/play/circle");
  await expect(
    page.getByRole("button", { name: "다시 불러오기" }),
  ).toBeVisible();
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-ready",
    "false",
  );
  await page.unroute("**/dog-full-circle.webp");
  await page.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(page.locator(".arcade-loading")).toHaveCount(0);
});

test("mobile loading respects reduced motion and supports explicit fallback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/dog-full-circle.webp", (route) => route.abort());
  await page.goto("/play/circle");
  await expect(
    page.getByRole("button", { name: "준비된 화면으로 시작" }),
  ).toBeVisible();
  expect(
    await page
      .locator(".loading-runner")
      .first()
      .evaluate((image) => getComputedStyle(image).animationName),
  ).toBe("none");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/loading-mobile.png" });
  await page.getByRole("button", { name: "준비된 화면으로 시작" }).click();
  await expect(
    page.getByRole("button", { name: "시작!", exact: true }),
  ).toBeVisible();
});
