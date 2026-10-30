import { test, expect } from "@playwright/test";
const games = ["shoot", "circle", "cham", "rps", "dodge"] as const;
async function seed(page: import("@playwright/test").Page) {
  await page.goto("/games");
  await page.evaluate(async () => {
    const { recordPlay } = await import("/src/community/client.ts");
    recordPlay("shoot", 2000, 100, 30, { hits: 10, shots: 10, maxCombo: 10 });
    recordPlay("circle", 900, 90, 10, { metadata: { drawComplete: true } });
    recordPlay("cham", 900, 0, 0, {
      rounds: Array.from({ length: 10 }, (_, i) => ({
        win: i < 9,
        responseMs: 500,
      })),
    });
    recordPlay("rps", 500, 0, 0, {
      rounds: Array.from({ length: 5 }, () => ({
        win: true,
        choice: "paper" as const,
        webcam: false,
      })),
    });
    recordPlay("dodge", 1300, 0, 30, {
      metadata: { maxSafeSeconds: 30, maxAvoidStreak: 20, dodged: 20 },
    });
    localStorage.setItem(
      "arcade.records",
      JSON.stringify({
        best: 2000,
        plays: 1,
        day: "2026-10-30",
        daily: 1,
        last: {
          score: 2000,
          combo: 10,
          accuracy: 100,
          hits: 10,
          shots: 10,
          newBest: false,
        },
      }),
    );
    localStorage.setItem(
      "arcade.circle.last",
      JSON.stringify({
        score: 900,
        accuracy: 90,
        points: 80,
        duration: 10,
        newBest: false,
      }),
    );
    localStorage.setItem("arcade.circle.best", "900");
    localStorage.setItem(
      "arcade.cham",
      JSON.stringify({
        best: 900,
        plays: 1,
        last: {
          score: 900,
          wins: 9,
          newBest: false,
          saved: true,
          rounds: Array.from({ length: 10 }, (_, i) => ({
            computer: "left",
            player: i < 9 ? "right" : null,
            win: i < 9,
          })),
        },
      }),
    );
    localStorage.setItem(
      "arcade.rps",
      JSON.stringify({
        best: 500,
        plays: 1,
        last: {
          score: 500,
          wins: 5,
          draws: 0,
          newBest: false,
          saved: true,
          rounds: Array.from({ length: 5 }, () => ({
            player: "paper",
            computer: "rock",
            outcome: "win",
          })),
        },
      }),
    );
    localStorage.setItem(
      "arcade.dodge",
      JSON.stringify({
        best: 1300,
        plays: 1,
        last: {
          score: 1300,
          seconds: 30,
          dodged: 20,
          hits: 0,
          cleared: true,
          newBest: false,
          saved: true,
        },
      }),
    );
  });
}
test("each result shows only its game goals and puts this run unlocks first after refresh", async ({
  page,
}) => {
  await seed(page);
  for (const game of games) {
    await page.goto("/result/" + game);
    const panel = page.locator(".result-achievements");
    await expect(panel).toHaveAttribute("data-game", game);
    expect(await panel.locator("li").count()).toBe(
      { shoot: 11, circle: 10, cham: 8, rps: 10, dodge: 9 }[game],
    );
    const rows = await panel.locator("li").evaluateAll((rows) =>
      rows.map((r) => ({
        id: r.getAttribute("data-achievement"),
        fresh: r.getAttribute("data-new") === "true",
      })),
    );
    expect(rows.some((r) => r.fresh)).toBe(true);
    const firstOld = rows.findIndex((r) => !r.fresh);
    expect(rows.slice(firstOld).every((r) => !r.fresh)).toBe(true);
    await expect(panel.locator("li").first()).toHaveAttribute(
      "data-new",
      "true",
    );
    await expect(panel).not.toContainText("???");
  }
  await page.reload();
  await expect(page.locator(".result-achievements li").first()).toHaveAttribute(
    "data-new",
    "true",
  );
});
test("next run clears old NEW flags and only genuinely new goals rise above earlier completions", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(async () => {
    const { recordPlay } = await import("/src/community/client.ts");
    recordPlay("circle", 700, 70, 10, { metadata: { drawComplete: true } });
  });
  await page.goto("/result/circle");
  await expect(
    page.locator(".result-achievements [data-new=true]"),
  ).toHaveCount(0);
  await expect(page.locator(".result-achievement-summary")).toHaveCount(0);
  await page.evaluate(async () => {
    const { recordPlay } = await import("/src/community/client.ts");
    recordPlay("circle", 950, 95, 10, { metadata: { drawComplete: true } });
  });
  await page.reload();
  const panel = page.locator(".result-achievements");
  await expect(panel.locator("li").first()).toHaveAttribute(
    "data-achievement",
    "circle950",
  );
  await expect(panel.locator("[data-new=true]")).toHaveCount(1);
  await expect(panel.locator("[data-achievement=artist]")).toHaveClass(
    /is-unlocked/,
  );
  const statuses = await panel
    .locator("li")
    .evaluateAll((rows) =>
      rows.map((row) => row.classList.contains("is-unlocked")),
    );
  const firstLocked = statuses.indexOf(false);
  expect(statuses.slice(firstLocked).every((unlocked) => !unlocked)).toBe(true);
  const before = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("arcade.achievements.v1")!).stats
        .totalGamesCompleted,
  );
  await page.reload();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("arcade.achievements.v1")!).stats
          .totalGamesCompleted,
    ),
  ).toBe(before);
});
test("result panels fit Korean and English layouts and move below results on narrow screens", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page);
  for (const language of ["ko", "en"]) {
    await page.evaluate(
      (language) =>
        localStorage.setItem("arcade.language", JSON.stringify(language)),
      language,
    );
    for (const game of games) {
      await page.goto("/result/" + game);
      for (const width of [320, 390, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1080 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          game + " " + width + " " + language,
        ).toBe(true);
        const layout = await page.evaluate(() => {
          const result = document
              .querySelector(".result-panel, .cham-result-panel")!
              .getBoundingClientRect(),
            side = document
              .querySelector(".result-achievements")!
              .getBoundingClientRect();
          return {
            right: side.left >= result.right,
            below: side.top >= result.bottom,
          };
        });
        if (width >= 1440) expect(layout.right, game).toBe(true);
        if (width <= 390) expect(layout.below, game).toBe(true);
      }
      if (language === "ko")
        await page.screenshot({
          path: "artifacts/result-achievements-" + game + ".png",
          fullPage: true,
        });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/result-achievements-mobile.png",
    fullPage: true,
  });
});
test("legacy results show lists without fabricating new unlocks or rendering lists on empty results", async ({
  page,
}) => {
  await page.goto("/result/shoot");
  await expect(page.locator(".empty-state")).toBeVisible();
  await expect(page.locator(".result-achievements")).toHaveCount(0);
  await page.evaluate(() =>
    localStorage.setItem(
      "arcade.circle.last",
      JSON.stringify({
        score: 850,
        accuracy: 85,
        points: 60,
        duration: 10,
        newBest: false,
      }),
    ),
  );
  await page.goto("/result/circle");
  await expect(page.locator(".result-achievements li")).toHaveCount(10);
  await expect(page.locator("[data-new=true]")).toHaveCount(0);
});
