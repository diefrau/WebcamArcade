import { test, expect, type Page } from "@playwright/test";
import { PracticeSession } from "../src/components/practiceSession";
import {
  emptyHand,
  type HandSample,
  type Landmark,
} from "../src/vision/gestures";
import type { RpsChoice } from "../src/games/rpsRules";
const hand = (pinched = false, x = 0.72, y = 0.44): HandSample => ({
  ...emptyHand,
  detected: true,
  pinched,
  x,
  y,
  landmarks: Array.from({ length: 21 }, () => ({
    x: 1 - (x * 0.76 + 0.12),
    y: y * 0.76 + 0.12,
  })),
});
function posePoints(pose: RpsChoice): Landmark[] {
  const p = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8 }));
  p[0] = { x: 0.5, y: 0.9 };
  p[4] = { x: 0.2, y: 0.6 };
  [5, 9, 13, 17].forEach((mcp, f) => {
    const x = 0.38 + f * 0.08,
      open = pose === "paper" || (pose === "scissors" && f < 2);
    p[mcp] = { x, y: 0.65 };
    p[mcp + 1] = { x, y: 0.5 };
    p[mcp + 2] = { x: x + (open ? 0 : 0.03), y: open ? 0.35 : 0.6 };
    p[mcp + 3] = { x, y: open ? 0.22 : 0.7 };
  });
  return p;
}
test("practice shooting requires an open hand, real new pinch and accurate aim", () => {
  const session = new PracticeSession("shoot");
  expect(session.hand(hand(true), 1, 0).complete).toBe(false);
  session.hand(hand(false), 1, 100);
  expect(session.hand(hand(true, 0.1, 0.1), 2, 200).complete).toBe(false);
  expect(session.hand(hand(true), 2, 300).complete).toBe(false);
  session.hand(hand(false), 2, 400);
  expect(session.hand(hand(true), 3, 500).complete).toBe(true);
});
test("practice circle draws only while pinched and never bridges a lost hand", () => {
  const session = new PracticeSession("circle");
  expect(session.hand(hand(true), 1, 0).path).toHaveLength(0);
  session.hand(hand(false), 1, 100);
  for (let i = 0; i < 18; i++)
    session.hand(
      hand(
        true,
        0.5 + 0.3 * Math.cos((i / 17) * Math.PI * 2),
        0.5 + 0.3 * Math.sin((i / 17) * Math.PI * 2),
      ),
      2,
      200 + i * 50,
    );
  expect(session.view().steps).toContain("draw");
  const length = session.view().path.length;
  session.hand({ ...emptyHand }, 2, 1100);
  session.hand(hand(true), 2, 1150);
  expect(session.view().path).toHaveLength(length);
  expect(session.view().complete).toBe(false);
  session.hand(hand(false), 2, 1200);
  session.hand(hand(true), 3, 1300);
  expect(session.hand(hand(false), 3, 1400).complete).toBe(true);
  const path = session.view().path.length;
  session.hand(hand(false, 0.1, 0.1), 3, 1500);
  expect(session.view().path).toHaveLength(path);
});
test("practice shape hold resets on missing samples and requires all three shapes", () => {
  const s = new PracticeSession("rps");
  let time = 0;
  for (const pose of ["rock", "paper", "scissors"] as const) {
    const sample = { ...hand(false), landmarks: posePoints(pose) };
    s.hand(sample, 0, time);
    s.hand(sample, 0, time + 200);
    expect(s.view().steps).not.toContain(pose);
    s.hand(sample, 0, time + 300);
    expect(s.view().steps).toContain(pose);
    time += 400;
  }
  expect(s.view().complete).toBe(true);
  const missing = new PracticeSession("rps");
  const rock = { ...hand(), landmarks: posePoints("rock") };
  missing.hand(rock, 0, 0);
  missing.hand(rock, 0, 700);
  expect(missing.view().done).toBe(0);
  missing.hand({ ...emptyHand }, 0, 800);
  expect(missing.view().hold).toBe(0);
});
test("face practice needs calibration; body practice follows mirrored relative movement", () => {
  const face = new PracticeSession("cham");
  const neutral = { x: 0, y: 0 };
  expect(
    face.face({ detected: true, x: -0.2, y: 0, time: 0 }, null, 0).message,
  ).toBe("calibrate");
  face.face({ detected: true, x: -0.2, y: 0, time: 100 }, neutral, 100);
  face.face({ detected: true, x: 0.2, y: 0, time: 200 }, neutral, 200);
  expect(
    face.face({ detected: false, x: 0, y: 0, time: 300 }, neutral, 300)
      .complete,
  ).toBe(false);
  expect(
    face.face({ detected: true, x: 0, y: 0, time: 400 }, neutral, 400).complete,
  ).toBe(true);
  const body = new PracticeSession("dodge");
  const sample = (x: number) => ({
    detected: true,
    x,
    width: 0.2,
    landmarks: [],
  });
  body.body(sample(0.5), 0);
  body.body(sample(0.4), 100);
  expect(body.view().cursor.x).toBeLessThan(0.32);
  body.body(sample(0.6), 200);
  expect(body.view().cursor.x).toBeGreaterThan(0.68);
  expect(body.body(sample(0.5), 300).complete).toBe(true);
});
async function records(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      Object.entries(localStorage).filter(([key]) =>
        /^arcade\.(records|circle|cham|rps|dodge|community\.(runs|progress|secrets))/.test(
          key,
        ),
      ),
    ),
  );
}
test("all five pointer practices complete or skip without changing game records", async ({
  page,
}) => {
  for (const game of ["shoot", "circle", "cham", "rps", "dodge"]) {
    await page.goto(`/play/${game}`);
    const before = await records(page);
    await page.getByRole("button", { name: "입력 연습", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "입력 연습", exact: true });
    if (game === "shoot")
      await dialog
        .locator(".practice-field")
        .click({ position: { x: 390, y: 123 } });
    if (game === "circle") {
      const rect = (await dialog.locator(".practice-field").boundingBox())!;
      await page.mouse.move(
        rect.x + rect.width * 0.8,
        rect.y + rect.height * 0.5,
      );
      await page.mouse.down();
      for (let i = 1; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        await page.mouse.move(
          rect.x + rect.width * (0.5 + 0.3 * Math.cos(a)),
          rect.y + rect.height * (0.5 + 0.3 * Math.sin(a)),
        );
      }
      await page.mouse.up();
    }
    if (game === "rps")
      for (const name of ["바위 연습", "보 연습", "가위 연습"])
        await dialog.getByRole("button", { name, exact: true }).click();
    if (game === "cham" || game === "dodge")
      for (const name of ["왼쪽 연습", "오른쪽 연습", "가운데 연습"])
        await dialog.getByRole("button", { name, exact: true }).click();
    await expect(dialog.getByRole("status")).toHaveText("연습 완료!");
    await dialog
      .getByRole("button", { name: "연습 마치기", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    expect(await records(page)).toEqual(before);
    await expect(page.locator(".achievement-toast")).toHaveCount(0);
    await page.getByRole("button", { name: "입력 연습", exact: true }).click();
    await page.getByRole("button", { name: "건너뛰기", exact: true }).click();
    expect(await records(page)).toEqual(before);
  }
});
test("coaches fit narrow screens, reduced motion is static, and cards identify their input", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const game of ["shoot", "circle", "cham", "rps", "dodge"]) {
    await page.goto(`/play/${game}`);
    await page.evaluate(() => document.fonts.ready);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      await page
        .getByRole("button", { name: "입력 연습", exact: true })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "입력 연습",
        exact: true,
      });
      expect(
        await dialog.evaluate((el) => el.scrollWidth > el.clientWidth),
      ).toBe(false);
      await dialog
        .getByRole("button", { name: "건너뛰기", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: game === "dodge" ? "게임 시작!" : "시작!",
          exact: true,
        })
        .click({ trial: true });
    }
    expect(
      await page
        .locator(".input-demo")
        .evaluate((el) =>
          Array.from(el.querySelectorAll("*")).every(
            (child) => getComputedStyle(child).animationName === "none",
          ),
        ),
    ).toBe(true);
  }
  await page.goto("/games");
  await expect(page.locator(".selection-games .input-badge")).toHaveCount(5);
  await expect(page.getByLabel("웹캠 입력: 손", { exact: true })).toHaveCount(
    3,
  );
  await expect(page.getByLabel("웹캠 입력: 얼굴", { exact: true })).toHaveCount(
    1,
  );
  await expect(page.getByLabel("웹캠 입력: 몸", { exact: true })).toHaveCount(
    1,
  );
});
