import { test, expect } from "@playwright/test";
test("built first entry supports start, title, home reveal and immediate skip with local assets", async ({
  page,
}) => {
  await page.route("https://*.supabase.co/**", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: "{}" }),
  );
  await page.addInitScript(() => {
    localStorage.removeItem("arcade.intro.seen.v1");
    (window as any).introMedia = [];
    const Original = window.Audio;
    window.Audio = function (...args: any[]) {
      const audio = new Original(...args);
      (window as any).introMedia.push(audio);
      return audio;
    } as any;
  });
  await page.clock.install();
  await page.goto("/WebcamArcade/");
  await expect(
    page.getByRole("button", { name: "START!", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".hero")).toHaveCount(0);
  await page.getByRole("button", { name: "START!", exact: true }).click();
  await page.clock.runFor(3200);
  await expect(page.locator(".intro-sequence")).toHaveAttribute(
    "data-phase",
    "title",
  );
  expect(
    await page
      .locator(".intro-aki")
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  ).toBe(true);
  const playing = () =>
    page.evaluate(
      () =>
        (window as any).introMedia.filter(
          (m: HTMLAudioElement) => m.src && !m.muted && !m.paused,
        ).length,
    );
  await expect.poll(playing).toBe(1);
  const musicCount = await page.evaluate(
    () => (window as any).introMedia.length,
  );
  await page
    .getByRole("button", { name: "인트로 건너뛰기", exact: true })
    .click();
  await expect(page.locator(".intro-sequence")).toHaveCount(0);
  await expect(page.locator(".hero")).toBeVisible();
  await expect.poll(playing).toBe(1);
  expect(await page.evaluate(() => (window as any).introMedia.length)).toBe(
    musicCount,
  );
  expect(
    await page.evaluate(() => localStorage.getItem("arcade.intro.seen.v1")),
  ).toBe("true");
});
