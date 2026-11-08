import { test, expect } from "@playwright/test";
import { perfectScore } from "../src/community/perfectScores";
test("only actual finite gameplay maxima count as perfect scores", () => {
  expect(perfectScore("circle")).toBe(1000);
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
