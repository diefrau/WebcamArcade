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
  expect(new Set(catalog.map((a) => a.id)).size).toBe(107);
  expect(catalog.filter((a) => !a.pending)).toHaveLength(106);
  for (const [game, count] of [["face-hockey", 10], ["slice", 9], ["bubble-shooter", 14]] as const)
    expect(catalog.filter((a) => "gameId" in a && a.gameId === game)).toHaveLength(count);
  for (const id of ["chamMaster", "shootAll", "dodgeMinute", "dodgeDance"])
    expect(catalog.find((a) => a.id === id)?.pending).toBe(false);
  for (const a of catalog) {
    expect((ko.achievements.items as any)[a.id]?.title).toBeTruthy();
    expect((en.achievements.items as any)[a.id]?.description).toBeTruthy();
    expect(a.target).toBeGreaterThan(0);
  }
});
test("new arcade achievements distinguish wins, clean rounds, and Bubble Pop modes", async ({ page }) => {
  await page.goto("/achievements");
  const hockey = { score: 5, misses: 2, duration: 60, metadata: {
    hockeyGoalStreak: 3, hockeyDeficit: 2, hockeyFastGoal: true,
  } };
  const slice = { duration: 30, hits: 30, misses: 0, maxCombo: 10, metadata: {
    sliceFruitAppeared: 30, sliceMaxSwipe: 4,
  } };
  const survival = { gameMode: "time-attack", duration: 61, metadata: {
    bubblePopped: 40, bubbleSurvivedRows: 20, bubbleMouthShots: 1,
    bubbleShotPopped: 6, bubbleMatchStreak: 3, bubbleBankMatch: true,
  } } as const;
  await record(page, [event("face-hockey", hockey), event("slice", slice), event("bubble-shooter", survival)]);
  let unlocked = (await state(page)).unlockedIds;
  expect(unlocked).toEqual(expect.arrayContaining([
    "hockeyFirst", "hockeyStreak", "hockeyComeback", "hockeyLead", "hockeyFast",
    "sliceQuad", "sliceCombo", "sliceThirty", "sliceNoBomb", "slicePerfect",
    "bubbleMouth", "bubbleBigShot", "bubbleStreak", "bubbleBank",
    "bubbleSurvivalTwenty", "bubbleSurvivalCombo",
  ]));
  expect(unlocked).not.toContain("hockeyShutout");
  expect(unlocked).not.toContain("bubbleBothModes");
  expect(unlocked).not.toContain("bubbleEndlessFifty");
  await record(page, [
    ...Array.from({ length: 9 }, () => event("face-hockey", { score: 1, misses: 0 })),
    event("bubble-shooter", { gameMode: "endless", duration: 300, metadata: { bubblePopped: 100 } }),
  ]);
  unlocked = (await state(page)).unlockedIds;
  expect(unlocked).toEqual(expect.arrayContaining([
    "hockeyWins", "hockeyShutout", "bubbleBothModes", "bubbleEndlessHundred", "bubbleEndlessFive",
  ]));
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
  await expect(page.locator(".achievement-grid article")).toHaveCount(107);
  await expect(page.locator(".secret-locked h2")).toHaveText(
    Array(6).fill("???"),
  );
  await expect(page.locator(".achievement-grid")).not.toContainText("어허");
  const filters = page.locator(".achievement-filters button");
  await filters.getByText("원 그리기", { exact: true }).click();
  await expect(page.locator(".achievement-grid article")).toHaveCount(10);
  await expect(page.locator(".secret-achievement")).toHaveCount(0);
  await expect(page.locator(".achievement-play")).toHaveAttribute(
    "href",
    "/play/circle",
  );
  await filters.getByText("벽 통과!", { exact: true }).click();
  await expect(page.locator(".achievement-pending")).toHaveCount(0);
  await expect(page.locator(".achievement-grid article")).toHaveCount(9);
  await expect(page.locator(".achievement-play")).toHaveAttribute(
    "href",
    "/play/gate",
  );
  await filters.getByText("얼굴 하키", { exact: true }).click();
  await expect(page.locator(".achievement-grid article")).toHaveCount(10);
  await filters.getByText("썰어!", { exact: true }).click();
  await expect(page.locator(".achievement-grid article")).toHaveCount(9);
  await filters.getByText("버블 팡!", { exact: true }).click();
  await expect(page.locator(".achievement-grid article")).toHaveCount(14);
  await filters.last().click();
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
  await expect(page.locator(".achievement-grid article")).toHaveCount(107);
  expect((await state(page)).stats.totalGamesCompleted).toBe(0);
});

test("gate achievements require webcam evidence, accumulate across rounds and reset streaks on misses", async ({
  page,
}) => {
  await page.goto("/achievements");
  const outcomes = Array.from({ length: 5 }, (_, i) => ({
    similarity: 100,
    points: 300,
    early: true,
    earlyPerfect: true,
    asymmetric: i === 2 || i === 3,
  }));
  const one = event("gate", {
    score: 1500,
    accuracy: 100,
    inputMode: "body",
    metadata: { gateOutcomes: outcomes },
  });
  expect(
    await record(page, [
      event("gate"),
      { ...one, inputMode: "pointer" },
      { ...one, score: 1501 },
      { ...one, metadata: { gateOutcomes: [null] as any } },
      one,
      one,
    ]),
  ).toEqual([false, false, false, false, true, false]);
  let s = await state(page);
  expect(s.unlockedIds).toEqual(
    expect.arrayContaining([
      "poseFirst",
      "pose80",
      "pose95",
      "poseQuick",
      "poseFive",
      "poseHint",
      "poseFull",
    ]),
  );
  expect(s.unlockedIds).not.toContain("poseTen");
  const miss = event("gate", {
    score: 1200,
    inputMode: "body",
    metadata: {
      gateOutcomes: [
        {
          ...outcomes[0],
          similarity: 0,
          points: 0,
          early: false,
          earlyPerfect: false,
        },
        ...outcomes.slice(1),
      ],
    },
  });
  await record(page, [miss, { ...one, id: crypto.randomUUID() }]);
  s = await state(page);
  expect(s.unlockedIds).not.toContain("poseTen");
  await record(
    page,
    Array.from({ length: 7 }, () => ({ ...one, id: crypto.randomUUID() })),
  );
  s = await state(page);
  expect(s.unlockedIds).toEqual(
    expect.arrayContaining(["poseTen", "poseRegular"]),
  );
  expect(s.stats.gamePlayCount.gate).toBe(10);
  await page.reload();
  expect((await state(page)).unlockedIds).toContain("poseRegular");
});
