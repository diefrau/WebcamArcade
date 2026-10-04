import { test, expect } from "@playwright/test";

const result = {
  score: 930,
  accuracy: 93,
  points: 80,
  duration: 10,
  newBest: true,
};

test("result animation waits for loading, counts to exact values and preserves records", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-05T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-05T00:01:00Z"));
  await page.addInitScript((value) => {
    localStorage.setItem("arcade.circle.last", JSON.stringify(value));
    localStorage.setItem("arcade.circle.best", "930");
    localStorage.setItem("arcade.circle.plays", "1");
    const original = document.fonts.load.bind(document.fonts);
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const loads: Promise<FontFace[]>[] = [];
    document.fonts.load = (...args) => {
      const load = wait.then(() => original(...args));
      loads.push(load);
      return load;
    };
    (window as unknown as { releaseFonts: () => Promise<void> }).releaseFonts =
      async () => {
        release();
        await Promise.all(loads);
        await document.fonts.ready;
      };
  }, result);
  await page.goto("/result/circle");
  await expect(page.locator(".arcade-loading")).toBeVisible();
  await page.clock.runFor(1500);
  await expect(page.locator(".count-up").first()).toHaveText("0");
  await page.evaluate(() =>
    (window as unknown as { releaseFonts: () => Promise<void> }).releaseFonts(),
  );
  await page.evaluate(() =>
    Promise.all(Array.from(document.images, (image) => image.decode())),
  );
  await page.clock.runFor(1500);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-state",
    "exiting",
  );
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-ready",
    "false",
  );
  await expect(page.locator(".count-up").first()).toHaveText("0");
  await page.clock.runFor(600);
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.clock.runFor(250);
  const count = Number(await page.locator(".count-up").first().textContent());
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(930);
  await page.clock.runFor(1000);
  await expect(page.locator(".count-up").first()).toHaveText("930");
  await expect(page.locator(".reward-sticker.is-record")).toBeVisible();
  await expect(page.locator(".reward-confetti")).toBeVisible();
  expect(
    await page
      .locator(".reward-confetti")
      .evaluate((el) => getComputedStyle(el).pointerEvents),
  ).toBe("none");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("arcade.circle.last")!),
    ),
  ).toEqual(result);
  await page.screenshot({
    path: "artifacts/phase11-reward.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "게임 고르기" }).click();
  await expect(page).toHaveURL(/\/games$/);
  expect(
    await page.evaluate(() => localStorage.getItem("arcade.circle.plays")),
  ).toBe("1");
});

for (const preference of ["system", "setting"] as const) {
  test(`reduced motion (${preference}) shows final scores without confetti`, async ({
    page,
  }) => {
    if (preference === "system")
      await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      ({ value, preference }) => {
        localStorage.setItem("arcade.circle.last", JSON.stringify(value));
        localStorage.setItem(
          "arcade.motion",
          JSON.stringify(preference === "setting"),
        );
      },
      { value: result, preference },
    );
    await page.goto("/result/circle");
    await expect(page.locator(".route-content")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(page.locator(".count-up").first()).toHaveText("930");
    await expect(page.locator(".reward-confetti")).toHaveCount(0);
    expect(
      await page
        .locator(".reward-sticker")
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
  });
}

test("zero score receives encouragement without a record celebration", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "arcade.circle.last",
      JSON.stringify({
        score: 0,
        accuracy: 0,
        points: 0,
        duration: 20,
        newBest: false,
      }),
    ),
  );
  await page.goto("/result/circle");
  await expect(page.locator(".route-content")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator(".reward-sticker")).toBeVisible();
  await expect(page.locator(".reward-sticker.is-record")).toHaveCount(0);
  await expect(page.locator(".reward-confetti")).toHaveCount(0);
  await expect(page.locator(".count-up").first()).toHaveText("0");
});
