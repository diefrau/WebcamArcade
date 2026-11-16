import { test, expect } from "@playwright/test";
import { perfectScore } from "../src/community/perfectScores";
test("only actual finite gameplay maxima count as perfect scores", () => {
  expect(perfectScore("circle")).toBe(1000);
  expect(perfectScore("gate")).toBe(1500);
  expect(perfectScore("cham", "seeker")).toBe(1000);
  expect(perfectScore("rps")).toBe(500);
  expect(perfectScore("shoot", "wave")).toBe(2500);
  expect(perfectScore("shoot", "standard")).toBeNull();
  expect(perfectScore("dodge", "endless")).toBeNull();
});
test("perfect counts survive history eviction, ignore retries and separate modes", async ({
  page,
}) => {
  await page.goto("/ranking");
  await page.evaluate(async () => {
    const { recordPlay } = await import("/src/community/client.ts");
    recordPlay("circle", 1000);
    recordPlay("circle", 1000);
    recordPlay("circle", 999);
    const { recordPerfectRun } =
      await import("/src/community/perfectScores.ts");
    const runs = JSON.parse(
      localStorage.getItem("arcade.community.runs") || "[]",
    );
    recordPerfectRun(runs[0], runs);
    localStorage.setItem("arcade.community.runs", "[]");
  });
  await page.reload();
  await page
    .locator(".community-games")
    .first()
    .getByRole("button", { name: "원 그리기", exact: true })
    .click();
  await expect(page.locator(".local-score")).toContainText("1,000");
  await expect(page.locator(".local-score .perfect-count")).toHaveText("× 2");
  await page
    .locator(".community-games")
    .first()
    .getByRole("button", { name: "쏴!", exact: true })
    .click();
  await expect(page.locator(".perfect-count")).toHaveCount(0);
});

test("gate ranking filter shows its own best and repeated perfect count", async ({
  page,
}) => {
  await page.goto("/ranking");
  await page.evaluate(async () => {
    const { recordPlay } = await import("/src/community/client.ts");
    const gateOutcomes = Array.from({ length: 5 }, (_, i) => ({
      similarity: 100,
      points: 300,
      early: true,
      earlyPerfect: true,
      asymmetric: i === 2 || i === 3,
    }));
    for (let i = 0; i < 2; i++)
      recordPlay("gate", 1500, 100, 22.5, {
        inputMode: "body",
        gameMode: "standard",
        metadata: { gateOutcomes },
      });
  });
  await page.reload();
  await page
    .locator(".community-games")
    .getByRole("button", { name: "벽 통과!", exact: true })
    .click();
  await expect(page.locator(".community-page")).toContainText("1,500");
  await expect(page.locator(".community-page")).toContainText(/×\s*2/);
});
