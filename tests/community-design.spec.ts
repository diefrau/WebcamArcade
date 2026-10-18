import { test, expect } from "@playwright/test";
for (const language of ["ko", "en"])
  test(`community headings share the game title treatment and layouts fit (${language})`, async ({
    page,
  }) => {
    await page.addInitScript(
      (lang) => localStorage.setItem("arcade.language", JSON.stringify(lang)),
      language,
    );
    await page.route("**/rest/v1/rpc/arcade_board", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([
          { place: 1, nickname: "플레이어 / Player", score: 1000 },
        ]),
      }),
    );
    for (const width of [320, 390, 768, 1920]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.goto("/games");
      await page.evaluate(() => document.fonts.ready);
      const treatment = await page
        .locator(".page-title .yellow-text")
        .evaluate((el) => {
          const s = getComputedStyle(el);
          return {
            stroke: s.webkitTextStrokeWidth,
            strokeColor: s.webkitTextStrokeColor,
            shadow: s.filter,
            font: s.fontFamily,
            tracking: s.letterSpacing,
          };
        });
      for (const route of ["ranking", "achievements"]) {
        await page.goto("/" + route);
        await page.evaluate(() => document.fonts.ready);
        const title = page.locator(".community-page > h1 > .yellow-text");
        const actual = await title.evaluate((el) => {
          const s = getComputedStyle(el);
          return {
            stroke: s.webkitTextStrokeWidth,
            strokeColor: s.webkitTextStrokeColor,
            shadow: s.filter,
            font: s.fontFamily,
          };
        });
        expect(actual).toEqual({
          stroke: treatment.stroke,
          strokeColor: treatment.strokeColor,
          shadow: treatment.shadow,
          font: treatment.font,
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const rect = await title.boundingBox();
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
        if ((width === 390 || width === 1920) && language === "ko")
          await page.screenshot({
            path: `artifacts/community-design-${route}-${width}.png`,
            fullPage: true,
          });
        if (
          route === "ranking" &&
          (await page
            .getByRole("button", {
              name: language === "ko" ? "온라인" : "Online",
              exact: true,
            })
            .isEnabled())
        ) {
          await page
            .getByRole("button", {
              name: language === "ko" ? "온라인" : "Online",
              exact: true,
            })
            .click();
          await expect(page.locator(".community-board li")).toHaveCount(1);
          await expect(page.locator(".community-profile input")).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
        }
      }
    }
  });
