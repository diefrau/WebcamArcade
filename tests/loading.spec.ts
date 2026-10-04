import { test, expect, type Page } from "@playwright/test";

async function freezeClock(page: Page) {
  await page.clock.install({ time: new Date("2026-10-05T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-05T00:01:00Z"));
}

async function holdFonts(page: Page) {
  await page.addInitScript(() => {
    const original = document.fonts.load.bind(document.fonts);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const loads: Promise<FontFace[]>[] = [];
    document.fonts.load = (...args) => {
      const load = pending.then(() => original(...args));
      loads.push(load);
      return load;
    };
    (window as unknown as { releaseFonts: () => Promise<void> }).releaseFonts =
      async () => {
        release();
        await Promise.all(loads);
        await document.fonts.ready;
      };
  });
}

async function releaseFonts(page: Page) {
  await page.evaluate(() =>
    (window as unknown as { releaseFonts: () => Promise<void> }).releaseFonts(),
  );
}

test("cached screens keep a two-second loading race, then fade while input stays blocked", async ({
  page,
}) => {
  await freezeClock(page);
  await holdFonts(page);
  await page.goto("/play/shoot", { waitUntil: "domcontentloaded" });
  await releaseFonts(page);
  await page.evaluate(() =>
    Promise.all(Array.from(document.images, (image) => image.decode())),
  );
  await page.clock.runFor(1000);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-state",
    "loading",
  );
  const midpoint = Number(
    await page.getByRole("progressbar").getAttribute("aria-valuenow"),
  );
  expect(midpoint).toBeGreaterThan(0);
  expect(midpoint).toBeLessThanOrEqual(50);
  await page.clock.runFor(999);
  await expect(page.locator(".route-content")).toHaveAttribute("inert", "");
  await expect(page.getByRole("progressbar")).not.toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await page.clock.runFor(1);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-state",
    "exiting",
  );
  await expect(page.locator(".loading-track")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-ready",
    "false",
  );
  await expect(page.locator(".route-content")).toHaveAttribute("inert", "");
  expect(
    await page
      .locator(".route-content")
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).not.toBe("0s");
  await page.clock.runFor(599);
  await expect(page.locator(".arcade-loading")).toHaveCount(1);
  await page.clock.runFor(1);
  await expect(page.locator(".arcade-loading")).toHaveCount(0);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator(".route-content")).not.toHaveAttribute("inert", "");

  await page.getByRole("link", { name: "← 뒤로", exact: true }).click();
  await expect(page).toHaveURL(/\/games$/);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-state",
    "loading",
  );
  await page.clock.runFor(1999);
  await expect(page.locator(".arcade-loading")).toHaveCount(1);
  // The destination route may still be decoding its artwork after the
  // minimum timer; give its real asset gate one extra clock turn to finish.
  await page.clock.runFor(1200);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-state",
    "exiting",
  );
  await page.clock.runFor(600);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-ready",
    "true",
  );
});

test("loading waits for actual artwork, blocks input, and reveals a decoded screen", async ({
  page,
}) => {
  await freezeClock(page);
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
  await page.clock.runFor(2000);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-state",
    "loading",
  );
  await expect(page.getByRole("progressbar")).not.toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  release();
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-state",
    "exiting",
  );
  await page.clock.runFor(600);
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
  await page.clock.runFor(2000);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-state",
    "exiting",
  );
  await page.clock.runFor(600);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-ready",
    "true",
  );
});

test("font readiness gates the screen even when artwork is cached", async ({
  page,
}) => {
  await freezeClock(page);
  await holdFonts(page);
  await page.goto("/play/shoot", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".arcade-loading")).toBeVisible();
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-ready",
    "false",
  );
  await page.clock.runFor(3000);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-state",
    "loading",
  );
  await expect(page.getByRole("progressbar")).not.toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await releaseFonts(page);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-state",
    "exiting",
  );
  await page.clock.runFor(600);
  await expect(page.locator(".arcade-loading")).toHaveCount(0);
});

test("failed images offer recovery and retry succeeds without faking completion", async ({
  page,
}) => {
  await freezeClock(page);
  await page.route("**/dog-full-circle.webp", (route) => route.abort());
  await page.goto("/play/circle");
  await expect(
    page.getByRole("button", { name: "다시 불러오기" }),
  ).toBeVisible();
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-ready",
    "false",
  );
  await page.clock.runFor(3000);
  await page.unroute("**/dog-full-circle.webp");
  await page.getByRole("button", { name: "다시 불러오기" }).click();
  await page.clock.runFor(1999);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-state",
    "loading",
  );
  await page.clock.runFor(1);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-state",
    "exiting",
  );
  await page.clock.runFor(600);
  await expect(page.locator(".arcade-loading")).toHaveCount(0);
});

test("mobile loading respects reduced motion and supports explicit fallback", async ({
  page,
}) => {
  await freezeClock(page);
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
  await page.clock.runFor(1999);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-ready",
    "false",
  );
  await expect(page.locator(".route-content")).toHaveAttribute("inert", "");
  await page.clock.runFor(1);
  // The zero-duration transition timer runs on the next clock task.
  await page.clock.runFor(1);
  await expect(page.locator(".arcade-loading")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "시작!", exact: true }),
  ).toBeVisible();
});

test("a late asset failure cannot reopen loading after explicit fallback", async ({
  page,
}) => {
  await freezeClock(page);
  await page.addInitScript(() => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    (window as unknown as { rejectFonts: () => void }).rejectFonts = release;
    document.fonts.load = async () => {
      await pending;
      throw new Error("Delayed font unavailable");
    };
  });
  await page.goto("/play/shoot", { waitUntil: "domcontentloaded" });
  await page.clock.runFor(12000);
  await page.getByRole("button", { name: "준비된 화면으로 시작" }).click();
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-state",
    "exiting",
  );
  await page.clock.runFor(600);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.evaluate(() =>
    (window as unknown as { rejectFonts: () => void }).rejectFonts(),
  );
  await page.clock.runFor(12000);
  await expect(page.locator(".arcade-loading")).toHaveCount(0);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-ready",
    "true",
  );
});
