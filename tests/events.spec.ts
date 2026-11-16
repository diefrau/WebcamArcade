import { test, expect } from "@playwright/test";
import { weeklyEvent, nextKstMidnight } from "../src/events/weekly";
test("weekly themes switch at Monday KST midnight and mute expires at KST midnight", () => {
  const before = Date.parse("2026-11-22T14:59:59Z"),
    after = before + 1000;
  expect(weeklyEvent(before).title[0]).toContain("개장");
  expect(weeklyEvent(after).title[0]).toContain("정확");
  expect(nextKstMidnight(before)).toBe(after);
});
test("popup mutes until midnight and remains reachable through the event tab", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.removeItem("arcade.event.hiddenUntil"),
  );
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "이번 주 이벤트" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("checkbox", { name: "오늘 하루 보지 않기" }).check();
  await dialog.getByRole("button", { name: "플레이하기", exact: true }).click();
  await expect(page).toHaveURL(/events$/);
  await expect(page.locator(".event-missions article")).toHaveCount(3);
  expect(
    await page.evaluate(
      () =>
        Number(localStorage.getItem("arcade.event.hiddenUntil")) > Date.now(),
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "홈", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.screenshot({
    path: "artifacts/weekly-event-detail.png",
    fullPage: true,
  });
});
test("event waits for nickname selection and close dismisses for this session", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.removeItem("arcade.event.hiddenUntil");
    localStorage.removeItem("arcade.player.choice");
  });
  await page.goto("/");
  await expect(page.locator(".player-dialog")).toBeVisible();
  await expect(page.locator(".event-popup")).not.toBeVisible();
  await page
    .locator(".player-dialog")
    .getByRole("button", { name: /익명/ })
    .click();
  await expect(page.locator(".event-popup")).toBeVisible();
  await page.screenshot({ path: "artifacts/weekly-event-popup.png" });
  await page.locator(".event-close").click();
  await page.reload();
  await expect(page.locator(".event-popup")).not.toBeVisible();
});
test("weekly missions award a stamp and retain completion when recent history is cleared", async ({
  page,
}) => {
  await page.goto("/events");
  await page.evaluate(async () => {
    const { recordPlay } = await import("/src/community/client.ts");
    const { weeklyEvent } = await import("/src/events/weekly.ts");
    const event = weeklyEvent();
    for (const game of ["shoot", "circle", "rps", event.game, "shoot"])
      recordPlay(
        game as any,
        game === "circle" ? 800 : 100,
        100,
        game === "dodge" ? 45 : 10,
        {
          gameMode:
            game === "cham"
              ? "seeker"
              : game === "dodge"
                ? "endless"
                : "standard",
        },
      );
  });
  await expect(page.locator(".event-stamp")).toHaveClass(/earned/);
  await page.evaluate(() =>
    localStorage.setItem("arcade.community.runs", "[]"),
  );
  await page.reload();
  await expect(page.locator(".event-stamp")).toHaveClass(/earned/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
