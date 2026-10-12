import { test, expect } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

for (const language of ["ko", "en"]) {
  test(`home remains readable and navigable across widths (${language})`, async ({
    page,
  }) => {
    await page.addInitScript(
      (lang) => localStorage.setItem("arcade.language", JSON.stringify(lang)),
      language,
    );
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    for (const width of [
      320, 390, 640, 768, 960, 1024, 1280, 1440, 1920, 2560,
    ]) {
      await page.setViewportSize({ width, height: 1080 });
      const layout = await page.evaluate(() => {
        const cta = document
          .querySelector(".hero-cta")!
          .getBoundingClientRect();
        const heading = document
          .querySelector(".section-heading")!
          .getBoundingClientRect();
        const smile = document
          .querySelector(".comic-smile circle")!
          .getBoundingClientRect();
        const shapes = document.querySelector(
          ".comic-decor-shapes",
        ) as SVGSVGElement;
        const matrix = shapes.getScreenCTM()!;
        const button = document
          .querySelector(".view-all-button")!
          .getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          gap: heading.top - cta.bottom,
          smileRatio: smile.width / smile.height,
          shapeScaleRatio: matrix.a / matrix.d,
          buttonHeight: button.height,
        };
      });
      expect(layout.overflow, `${width}px horizontal overflow`).toBe(false);
      expect(layout.gap, `${width}px heading obscured by CTA`).toBeGreaterThan(
        12,
      );
      expect(layout.smileRatio).toBeCloseTo(1, 3);
      expect(layout.shapeScaleRatio).toBeCloseTo(1, 3);
      expect(layout.buttonHeight).toBeGreaterThanOrEqual(44);
      await page.locator(".view-all-button").click({ trial: true });
    }
    await page.locator(".view-all-button").click();
    await expect(page).toHaveURL(/\/games$/);
  });
}
