import { test, expect } from "@playwright/test";
test("ordinary and secret rewards queue, survive navigation and slide out after three seconds", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-20T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-20T00:00:01Z"));
  await page.goto("/");
  await page.evaluate(async () => {
    const client = await import("/src/community/client.ts");
    client.recordPlay("circle", 800, 0, 20);
  });
  const toast = page.locator(".achievement-toast");
  await expect(toast).toContainText("첫 게임 완료");
  await expect(toast).toHaveAttribute("data-state", "visible");
  await page.getByRole("link", { name: "도전과제", exact: true }).click();
  await expect(toast).toContainText("첫 게임 완료");
  await page.evaluate(async () => {
    const client = await import("/src/community/client.ts");
    client.unlockSecret("manners");
  });
  await page.clock.runFor(2999);
  await expect(toast).toHaveAttribute("data-state", "visible");
  await page.clock.runFor(1);
  await expect(toast).toHaveAttribute("data-state", "leaving");
  expect(await toast.evaluate((el) => getComputedStyle(el).animationName)).toBe(
    "achievement-exit",
  );
  await page.clock.runFor(350);
  await expect(toast).toContainText("원 그리기 800점");
  await expect(toast).toHaveAttribute("data-state", "visible");
  await page.clock.runFor(3350);
  await expect(toast).toContainText("어허, 그건 안돼요~");
  await expect(toast).toHaveClass(/secret-reward/);
  await page.clock.runFor(3350);
  await expect(toast).toHaveCount(0);
  await expect(page.locator(".achievement-grid")).toHaveCount(1);
  await expect(page.locator(".achievement-grid article")).toHaveCount(14);
  await expect(
    page.getByText(
      "PC 홈에서 웹캠을 켜고, 손과 표정으로 숨겨진 순간을 찾아보세요.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "비밀 도전과제", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(toast).toHaveCount(0);
  await page.evaluate(async () => {
    const client = await import("/src/community/client.ts");
    client.recordPlay("circle", 800, 0, 20);
    client.unlockSecret("manners");
  });
  await expect(toast).toHaveCount(0);
});

test("player stays at bottom left and reward stays on the right across screen sizes and scrolling", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date("2026-10-20T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-20T00:00:01Z"));
  await page.goto("/");
  await page.evaluate(async () => {
    const client = await import("/src/community/client.ts");
    client.unlockSecret("manners");
  });
  for (const width of [320, 390, 768, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.clock.runFor(10);
    for (const scroll of [0, 99999]) {
      await page.evaluate((scroll) => window.scrollTo(0, scroll), scroll);
      const bounds = await page.evaluate(() => {
        const p = document
          .querySelector(".player-strip")!
          .getBoundingClientRect();
        const t = document
          .querySelector(".achievement-toast")!
          .getBoundingClientRect();
        return {
          left: p.left,
          right: innerWidth - t.right,
          playerBottom: innerHeight - p.bottom,
          overlap:
            p.left < t.right &&
            p.right > t.left &&
            p.top < t.bottom &&
            p.bottom > t.top,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(bounds.left).toBe(width <= 600 ? 12 : 18);
      expect(bounds.playerBottom).toBe(width <= 600 ? 12 : 18);
      expect(bounds.right).toBe(width <= 600 ? 12 : 20);
      expect(bounds.overlap).toBe(false);
      expect(bounds.overflow).toBe(false);
    }
  }
  await page.screenshot({ path: "artifacts/achievement-toast-corners.png" });
});
