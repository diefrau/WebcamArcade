import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://*.supabase.co/**", (r) =>
    r.fulfill({ status: 400, body: "{}" }),
  );
  await page.route("https://fonts.googleapis.com/**", (r) =>
    r.fulfill({ contentType: "text/css", body: "" }),
  );
});

test("home defers game bundles and hover warms only the selected game", async ({
  page,
}) => {
  const scripts: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "script") scripts.push(r.url());
  });
  await page.goto("/WebcamArcade/");
  await expect(page.getByRole("button", { name: "게임 시작!" })).toBeVisible();
  expect(
    scripts.some((url) =>
      /(?:Shoot|Gate|Cham|Circle|Rps|Dodge)GamePage-/.test(url),
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "게임 시작!" }).click();
  const gate = page.getByRole("link", { name: "벽 통과! 지금 플레이!" });
  const loaded = page.waitForResponse((r) =>
    /GateGamePage-.*\.js$/.test(r.url()),
  );
  await gate.hover();
  expect((await loaded).ok()).toBe(true);
  expect(scripts.some((url) => /(?:Circle|Rps|Dodge)GamePage-/.test(url))).toBe(
    false,
  );
  await gate.click();
  await expect(page.locator(".gate-stage .game-dialog")).toBeVisible();
  await expect(page.locator(".arcade-loading")).toHaveCount(0);
});

test("a cold delayed game chunk keeps the previous screen until it is ready", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route(/CircleGamePage-.*\.js$/, async (route) => {
    requested();
    await held;
    await route.continue();
  });
  await page.goto("/WebcamArcade/games");
  await page.getByRole("link", { name: "원 그리기 지금 플레이!" }).click();
  await requestStarted;
  await expect(page.locator(".selection-games")).toBeVisible();
  release();
  await expect(page.locator(".circle-stage")).toBeVisible();
});

test("mobile cards request smaller artwork without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/WebcamArcade/games");
  const art = page.locator('.game-card [data-character="circle"]');
  await art.scrollIntoViewIfNeeded();
  await expect
    .poll(() => art.evaluate((el) => (el as HTMLImageElement).currentSrc))
    .toMatch(/dog-full-circle-320-/);
  expect(
    await art.evaluate((el) => (el as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
