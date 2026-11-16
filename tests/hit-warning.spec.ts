import { test, expect } from "@playwright/test";
import {
  advanceDodge,
  newDodge,
  dodgeLevel,
  dodgeScore,
} from "../src/games/dodgeRules";

test("warnings freeze obstacles without collisions, then release them; hard scores fit stored bounds", () => {
  let state = {
    ...newDodge(),
    spawnIn: 10,
    obstacles: [{ id: 0, x: 0.5, y: 0.87, warning: 0.65 }],
  };
  state = advanceDodge(state, 0.25, 0.5) as typeof state;
  expect(state.hits).toBe(0);
  expect(state.obstacles[0].y).toBe(0.87);
  for (let i = 0; i < 3; i++)
    state = advanceDodge(state, 0.25, 0.5) as typeof state;
  expect(state.hits).toBe(1);
  expect(dodgeLevel(14.99)).toBe(1);
  expect(dodgeLevel(15)).toBe(2);
  let hard = newDodge();
  for (let i = 0; i < 120; i++) hard = advanceDodge(hard, 0.25, 0.5, () => 0);
  expect(hard.elapsed).toBeCloseTo(30);
  expect(dodgeScore(hard)).toBeLessThanOrEqual(3000);
});

test("shoot clicks miss transparent artwork and hit opaque artwork", async ({
  page,
}) => {
  await page.goto("/play/shoot");
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  const target = page.getByTestId("target-1");
  const points = await target
    .locator("img:not([hidden])")
    .evaluate(async (element) => {
      const img = element as HTMLImageElement;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const alpha = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const rect = img.getBoundingClientRect();
      const scale = Math.min(
        rect.width / canvas.width,
        rect.height / canvas.height,
      );
      const toScreen = (x: number, y: number) => ({
        x:
          rect.left +
          (rect.width - canvas.width * scale) / 2 +
          (x + 0.5) * scale,
        y:
          rect.top +
          (rect.height - canvas.height * scale) / 2 +
          (y + 0.5) * scale,
      });
      const y = Math.floor(canvas.height / 2);
      let x = 0;
      while (alpha[(y * canvas.width + x) * 4 + 3] < 255) x++;
      return { opaque: toScreen(x + 5, y), transparent: toScreen(1, 1) };
    });
  await page.mouse.click(points.transparent.x, points.transparent.y);
  await expect(page.locator(".game-command")).toContainText("아깝");
  await page.mouse.click(points.opaque.x, points.opaque.y);
  await expect(page.locator(".hud-panel.pink strong")).toContainText("100");
});

test("image alpha rejects transparent pixels and contain padding at different sizes", async ({
  page,
}) => {
  await page.goto("/play/shoot");
  const hits = await page.evaluate(async () => {
    const { imageHitTest } = await import("/src/games/imageHitTest.ts");
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext("2d")!;
    ctx.fillRect(20, 20, 60, 60);
    const img = document.createElement("img");
    img.src = canvas.toDataURL();
    img.style.cssText =
      "position:fixed;left:0;top:0;width:200px;height:100px;object-fit:contain";
    document.body.append(img);
    await img.decode();
    return [
      imageHitTest(img, 100, 50),
      imageHitTest(img, 55, 5),
      imageHitTest(img, 5, 50),
    ];
  });
  expect(hits).toEqual([true, false, false]);
});

test("survival previews incoming obstacles and announces the next level", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto("/play/dodge");
  await page.getByRole("button", { name: "게임 시작!", exact: true }).click();
  await page.clock.runFor(2300);
  await expect(page.locator(".dodge-warning").first()).toBeVisible();
  await expect(page.locator(".dodge-level b")).toHaveText("LEVEL 1");
  await page.clock.runFor(15000);
  await expect(page.locator(".dodge-level b")).toHaveText("LEVEL 2");
  await expect(page.locator(".dodge-level-up")).toHaveText("속도 UP!");
});
