import { test, expect, type Page } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).musicMedia = [];
    const AudioConstructor = window.Audio;
    window.Audio = function (...args: any[]) {
      const media = new AudioConstructor(...args);
      (window as any).musicMedia.push(media);
      return media;
    } as any;
  });
});
const playing = (page: Page) =>
  page.evaluate(() =>
    (window as any).musicMedia
      .filter((m: HTMLAudioElement) => m.src && !m.paused)
      .map((m: HTMLAudioElement) => m.src),
  );
test("music waits for a gesture, shares menu playback, changes by game and resumes after tab hiding", async ({
  page,
}) => {
  await page.goto("/games");
  expect(await page.evaluate(() => (window as any).musicMedia.length)).toBe(0);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect.poll(() => playing(page)).toHaveLength(1);
  expect((await playing(page))[0]).toContain("WebArcMainTitle");
  await page.getByRole("button", { name: "닫기", exact: true }).last().click();
  await page.locator('.top-nav a[href="/"]').click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => (window as any).musicMedia.length)).toBe(1);
  await page.locator('.game-card[href="/play/shoot"]').click();
  await expect
    .poll(async () => {
      const p = await playing(page);
      return p.length === 1 && p[0].includes("WebArcBounce");
    })
    .toBe(true);
  const position = await page.evaluate(
    () => (window as any).musicMedia.at(-1).currentTime,
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => playing(page)).toHaveLength(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => playing(page)).toHaveLength(1);
  expect(
    await page.evaluate(() => (window as any).musicMedia.at(-1).currentTime),
  ).toBeGreaterThanOrEqual(position);
});
test("music switch and volume persist separately from shared sound mute and fit mobile settings", async ({
  page,
}) => {
  await page.goto("/games");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const music = page.getByRole("checkbox", { name: "배경음악", exact: true });
  await music.uncheck();
  await expect.poll(() => playing(page)).toHaveLength(0);
  await expect(page.getByRole("slider")).toBeDisabled();
  await music.check();
  await expect.poll(() => playing(page)).toHaveLength(1);
  const slider = page.getByRole("slider");
  await slider.focus();
  await slider.press("Home");
  for (let i = 0; i < 5; i++) await slider.press("ArrowRight");
  await expect(page.locator(".music-volume-control output")).toHaveText("5%");
  expect(
    await page.evaluate(() => localStorage.getItem("arcade.music.volume")),
  ).toBe("0.05");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page
        .locator(".settings-dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page
      .getByRole("button", { name: "닫기", exact: true })
      .last()
      .click({ trial: true });
  }
  await page.getByRole("button", { name: "닫기", exact: true }).last().click();
  await page.getByRole("button", { name: "사운드 ON", exact: true }).click();
  await expect.poll(() => playing(page)).toHaveLength(0);
  await page.getByRole("button", { name: "사운드 OFF", exact: true }).click();
  await expect.poll(() => playing(page)).toHaveLength(1);
  await page.reload();
  expect(await playing(page)).toHaveLength(0);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect(page.locator(".music-volume-control output")).toHaveText("5%");
  await expect(music).toBeChecked();
  await music.uncheck();
  await page.reload();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect(music).not.toBeChecked();
  expect(await playing(page)).toHaveLength(0);
});
test("an unavailable music file does not block effects, settings or starting a game", async ({
  page,
}) => {
  await page.route("**/*.mp3", (route) => route.abort());
  await page.goto("/play/shoot");
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  await expect(page.locator(".game-overlay")).toHaveCount(0);
  await expect.poll(() => playing(page)).toHaveLength(0);
});
