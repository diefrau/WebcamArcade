import { test, expect } from "@playwright/test";
import catalog from "../src/achievements/catalog.json" with { type: "json" };
import ko from "../src/locales/ko.json" with { type: "json" };
import en from "../src/locales/en.json" with { type: "json" };
import type { GameResultEvent } from "../src/achievements/types";
import type { Page } from "@playwright/test";
const event = (
  gameId: GameResultEvent["gameId"],
  extra: Partial<GameResultEvent> = {},
): GameResultEvent => ({
  id: crypto.randomUUID(),
  gameId,
  completed: true,
  score: 100,
  accuracy: 0,
  duration: 10,
  date: new Date().toISOString(),
  ...extra,
});
async function record(page: Page, events: GameResultEvent[]) {
  return page.evaluate(async (events) => {
    const m = await import("/src/achievements/achievementManager.ts");
    return events.map((e) => m.recordGameResult(e));
  }, events);
}
async function state(page: Page) {
  return page.evaluate(async () =>
    structuredClone(
      (
        await import("/src/achievements/achievementManager.ts")
      ).readAchievementState(),
    ),
  );
}
test("catalog has translated stable unique entries and excludes unavailable conditions from completion", () => {
  expect(new Set(catalog.map((a) => a.id)).size).toBe(74);
  expect(catalog.filter((a) => !a.pending)).toHaveLength(60);
  for (const a of catalog) {
    expect((ko.achievements.items as any)[a.id]?.title).toBeTruthy();
    expect((en.achievements.items as any)[a.id]?.description).toBeTruthy();
    expect(a.target).toBeGreaterThan(0);
  }
});
test("real counters persist past history limits, reject malformed results and ignore duplicate events", async ({
  page,
}) => {
  await page.goto("/achievements");
  const one = event("shoot", { hits: 1, shots: 1, accuracy: 100 });
  expect(
    await record(page, [
      { ...one, completed: false },
      { ...one, rounds: [null] as any },
      { ...one, hits: 2 },
      { ...one, metadata: { dodged: -1 } },
      one,
      one,
    ]),
  ).toEqual([false, false, false, false, true, false]);
  let s = await state(page);
  expect(s.stats.totalGamesCompleted).toBe(1);
  expect(s.unlockedIds).toContain("sharp");
  expect(s.unlockedIds).not.toContain("shootPrecise");
  expect(s.unlockedIds).not.toContain("shootPerfect");
  await record(
    page,
    Array.from({ length: 104 }, () => event("shoot", { hits: 1, shots: 1 })),
  );
  await page.reload();
  s = await state(page);
  expect(s.stats.totalGamesCompleted).toBe(105);
  expect(s.stats.totalShootHits).toBe(105);
  expect(s.unlockedIds).toEqual(
    expect.arrayContaining(["resident", "shootHundred", "replayFive"]),
  );
});
test("shoot precision needs ten shots and round streaks reset on failure while observed peaks unlock", async ({
  page,
}) => {
  await page.goto("/achievements");
  await record(page, [
    event("shoot", { hits: 9, shots: 10, accuracy: 90 }),
    event("shoot", {
      hits: 10,
      shots: 10,
      accuracy: 100,
      maxCombo: 10,
      fastestSuccessMs: 350,
    }),
    event("cham", {
      rounds: [{ win: true }, { win: true }, { win: true }, { win: false }],
    }),
  ]);
  let s = await state(page);
  expect(s.unlockedIds).toEqual(
    expect.arrayContaining([
      "shootPrecise",
      "shootPerfect",
      "shootCombo",
      "shootFast",
      "chamStreak3",
    ]),
  );
  expect(s.progress.chamStreak5).toBe(0);
  await record(page, [
    event("rps", {
      rounds: Array.from({ length: 5 }, () => ({
        win: true,
        choice: "rock" as const,
        webcam: true,
        responseMs: 400,
      })),
      recognitionFailures: 1,
    }),
  ]);
  s = await state(page);
  expect(s.unlockedIds).toContain("rpsStreak5");
  expect(s.unlockedIds).not.toContain("rpsRecognized");
  await record(page, [
    event("rps", {
      rounds: Array.from({ length: 5 }, () => ({
        win: true,
        choice: "paper" as const,
        webcam: true,
        responseMs: 400,
      })),
      recognitionFailures: 0,
    }),
  ]);
  s = await state(page);
  expect(s.unlockedIds).toEqual(
    expect.arrayContaining([
      "rpsStreak10",
      "rpsRecognized",
      "rpsRock",
      "rpsPaper",
    ]),
  );
});
test("circle needs observed hand tracking and complete drawing; session goals reset only when not yet earned", async ({
  page,
}) => {
  await page.goto("/achievements");
  await record(page, [
    event("circle", {
      score: 900,
      duration: 2,
      inputMode: "hand",
      trackingLosses: 1,
      metadata: { drawComplete: true, passed: true },
    }),
    event("cham", { metadata: { passed: true } }),
  ]);
  let s = await state(page);
  expect(s.unlockedIds).toContain("circleFast");
  expect(s.unlockedIds).not.toContain("circleUnbroken");
  expect(s.progress.sessionAll).toBe(2);
  expect(s.progress.warmup).toBe(2);
  await page.reload();
  s = await state(page);
  expect(s.progress.sessionAll).toBe(0);
  expect(s.progress.warmup).toBe(0);
  await record(page, [
    event("circle", {
      score: 800,
      inputMode: "hand",
      trackingLosses: 0,
      metadata: { drawComplete: true, passed: true },
    }),
    event("cham", { metadata: { passed: true } }),
    event("shoot", { metadata: { passed: true } }),
    event("rps"),
    event("dodge"),
  ]);
  s = await state(page);
  expect(s.unlockedIds).toEqual(
    expect.arrayContaining([
      "circleUnbroken",
      "sessionAll",
      "allrounder",
      "warmup",
    ]),
  );
  await page.reload();
  expect((await state(page)).unlockedIds).toContain("sessionAll");
});
test("legacy unlocks and dates survive migration without inventing missing webcam or accuracy evidence", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "arcade.community.progress",
      JSON.stringify({
        first: true,
        sharp: true,
        artist: true,
        counts: { plays: 5, games: 1 },
        playedGames: ["circle"],
      }),
    );
    localStorage.setItem(
      "arcade.community.secrets",
      JSON.stringify([{ id: "manners", date: "2026-10-01T00:00:00Z" }]),
    );
  });
  await page.goto("/achievements");
  const s = await state(page);
  expect(s.unlockedIds).toEqual(
    expect.arrayContaining(["first", "sharp", "artist", "manners"]),
  );
  expect(s.unlockedIds).not.toContain("shootPrecise");
  expect(s.unlockedIds).not.toContain("circleUnbroken");
  expect(s.unlockedAt.manners).toBe(Date.parse("2026-10-01T00:00:00Z"));
  expect(s.stats.totalGamesCompleted).toBe(5);
});
test("filters hide secrets, pending goals cannot unlock, localized mobile layouts stay within viewport", async ({
  page,
}) => {
  await page.goto("/achievements");
  await expect(page.locator(".achievement-grid article")).toHaveCount(74);
  await expect(page.locator(".secret-locked h2")).toHaveText(
    Array(6).fill("???"),
  );
  await expect(page.locator(".achievement-grid")).not.toContainText("어허");
  const filters = page.locator(".achievement-filters button");
  await filters.nth(2).click();
  await expect(page.locator(".achievement-grid article")).toHaveCount(10);
  await expect(page.locator(".secret-achievement")).toHaveCount(0);
  await expect(page.locator(".achievement-play")).toHaveAttribute(
    "href",
    "/play/circle",
  );
  await filters.last().click();
  await expect(page.locator(".achievement-pending")).toHaveCount(9);
  await expect(page.locator(".achievement-play")).toHaveCount(0);
  await filters.first().click();
  for (const width of [320, 390, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "artifacts/achievements-expanded-1920.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/achievements-expanded-390.png",
    fullPage: true,
  });
});
test("damaged cached stats recover from valid history instead of crashing the page", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "arcade.achievements.v1",
      JSON.stringify({
        version: 1,
        stats: {
          totalGamesCompleted: 4,
          completedGameIds: null,
          gamePlayCount: null,
        },
        processedIds: [],
        unlockedAt: {},
        progress: {},
      }),
    ),
  );
  await page.goto("/achievements");
  await expect(page.locator(".achievement-grid article")).toHaveCount(74);
  expect((await state(page)).stats.totalGamesCompleted).toBe(0);
});
