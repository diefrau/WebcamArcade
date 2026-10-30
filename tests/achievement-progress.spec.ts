import { test, expect } from "@playwright/test";
import { countProgress, progressFor, type Run } from "../src/community/store";
const run = (game: Run["game"]): Run => ({
  id: crypto.randomUUID(),
  game,
  score: 0,
  accuracy: 0,
  seconds: 0,
  date: new Date().toISOString(),
});
test("count challenges report partial values, distinct games and completed caps", () => {
  const p = progressFor([run("shoot"), run("shoot")]);
  expect(countProgress(p, "five")).toEqual({ value: 2, target: 5 });
  expect(countProgress(p, "variety")).toEqual({ value: 1, target: 3 });
  expect(
    countProgress(
      progressFor([run("shoot"), run("circle"), run("rps")]),
      "variety",
    ),
  ).toEqual({ value: 3, target: 3 });
  expect(
    countProgress(
      progressFor(Array.from({ length: 8 }, () => run("circle"))),
      "five",
    ),
  ).toEqual({ value: 5, target: 5 });
  expect(
    countProgress({ ...p, five: true, counts: undefined }, "five"),
  ).toEqual({ value: 5, target: 5 });
  expect(countProgress(p, "artist")).toBeNull();
});
test("device progress bars persist across reload and preserve game variety beyond the history window", async ({
  page,
}) => {
  await page.addInitScript(
    (runs) => {
      if (!localStorage.getItem("arcade.community.runs"))
        localStorage.setItem("arcade.community.runs", JSON.stringify(runs));
    },
    [run("shoot"), run("shoot")],
  );
  await page.goto("/achievements");
  await expect(
    page.getByRole("progressbar", { name: "슬슬 몸 풀렸지?", exact: true }),
  ).toHaveAttribute("value", "2");
  await expect(
    page.getByRole("progressbar", {
      name: "이것저것 해보는 중",
      exact: true,
    }),
  ).toHaveAttribute("value", "1");
  await page.reload();
  await expect(
    page.getByRole("progressbar", { name: "슬슬 몸 풀렸지?", exact: true }),
  ).toHaveAttribute("value", "2");
  await page.evaluate(async () => {
    const client = await import("/src/community/client.ts");
    client.recordPlay("circle", 0);
    for (let i = 0; i < 100; i++) client.recordPlay("rps", 0);
  });
  await page.reload();
  await expect(
    page.getByRole("progressbar", { name: "슬슬 몸 풀렸지?", exact: true }),
  ).toHaveAttribute("value", "5");
  await expect(
    page.getByRole("progressbar", {
      name: "이것저것 해보는 중",
      exact: true,
    }),
  ).toHaveAttribute("value", "3");
  for (const width of [320, 390, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "artifacts/achievement-progress-after.png",
    fullPage: true,
  });
});
