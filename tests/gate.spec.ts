import { test, expect } from "@playwright/test";
import {
  normalizePose,
  poseSimilarity,
} from "../src/vision/shared/poseNormalization";
import { mockPose, mockVision, gateTargets } from "../src/input/mockPose";
import { adaptGameInput } from "../src/input/GameInputAdapter";
import {
  newGate,
  advanceGate,
  judgeGate,
  gateScore,
} from "../src/games/gateRules";
import { trajectory, recentPoints } from "../src/vision/shared/trajectory";
import { lineCircle } from "../src/vision/shared/collision";
import { visionProfile } from "../src/vision/visionProfiles";
test("normalized pose comparison ignores position scale and torso tilt and rejects missing joints", () => {
  const p = mockPose(90, 0),
    a = normalizePose(p),
    angle = 0.2;
  const transformed = p.map((v) => ({
    ...v,
    x: (v.x * Math.cos(angle) - v.y * Math.sin(angle)) * 0.7 + 0.2,
    y: (v.x * Math.sin(angle) + v.y * Math.cos(angle)) * 0.7 + 0.1,
  }));
  expect(poseSimilarity(a, normalizePose(transformed))).toBe(100);
  expect(normalizePose([])).toBeNull();
  const hidden = p.map((v) => ({ ...v }));
  hidden[15].visibility = 0;
  expect(normalizePose(hidden)).toBeNull();
  expect(poseSimilarity(a, normalizePose(mockPose(-60, -60)))).toBeLessThan(80);
  expect(judgeGate(95).points).toBe(300);
  expect(judgeGate(80).points).toBe(150);
  expect(judgeGate(60).grade).toBe("close");
  expect(judgeGate(null).grade).toBe("fail");
});
test("five wall crossings score once and finish identically at different render steps", () => {
  for (const dt of [0.02, 0.1, 0.25]) {
    let s = newGate();
    for (let i = 0; i < 2000 && s.phase !== "finished"; i++) {
      const target = gateTargets[s.round];
      s = advanceGate(
        s,
        dt,
        adaptGameInput(mockVision(target.left, target.right), "mock"),
      );
    }
    expect(s.phase).toBe("finished");
    expect(s.outcomes).toHaveLength(5);
    expect(gateScore(s)).toBe(1500);
    expect(
      advanceGate(s, 0.25, adaptGameInput(mockVision(0, 0), "mock")),
    ).toEqual(s);
  }
});
test("trajectory and collision math handle closed loops and zero-length lines", () => {
  const p = [
    { x: 0, y: 0, time: 0 },
    { x: 1, y: 0, time: 100 },
    { x: 2, y: 0, time: 200 },
  ];
  expect(trajectory(p).linearity).toBe(1);
  expect(trajectory(p).velocity).toBe(10);
  expect(recentPoints(p, 200, 100)).toHaveLength(2);
  expect(lineCircle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 0.1)).toBe(
    true,
  );
  expect(visionProfile("/play/gate").detector).toBe("body");
  expect(visionProfile("/play/gate", "?input=mock").detector).toBeNull();
  expect(visionProfile("/play/cham", "?role=seeker").detector).toBe("hand");
  expect(visionProfile("/result/shoot").detector).toBeNull();
});
test("mock gate completes, pauses, saves, reloads and replays without camera or online submission", async ({
  page,
}) => {
  let submits = 0;
  await page.route("**/rest/v1/rpc/arcade_submit*", (r) => {
    submits++;
    return r.abort();
  });
  await page.clock.install();
  await page.goto("/games");
  await page.getByRole("link", { name: "뚫어! 지금 플레이!" }).click();
  await page.getByRole("button", { name: "체험 입력", exact: true }).click();
  await expect(
    page
      .getByText(
        "이번 체험판은 웹캠 없이 플레이해요. 체험 기록은 이 기기에 저장돼요.",
      )
      .first(),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/gate-ready-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "시작!", exact: true }).click();
  await page.clock.runFor(3200);
  await page.screenshot({
    path: "artifacts/gate-play-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.clock.runFor(5000);
  await page
    .locator(".game-dialog")
    .getByRole("button", { name: "계속하기", exact: true })
    .click();
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole("button", { name: new RegExp(`^${i + 1}\\.`) })
      .click();
    await page.clock.runFor(4500);
  }
  await expect(page).toHaveURL(/result\/gate/);
  const record = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.gate.prototype") || "null"),
  );
  expect(record.last.score).toBe(1500);
  expect(submits).toBe(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "1,500 점" })).toBeVisible();
  await page.getByRole("link", { name: "다시 하기", exact: true }).click();
  await expect(page).toHaveURL(/play\/gate/);
  await expect(
    page.getByRole("button", { name: "시작!", exact: true }),
  ).toBeEnabled();
});
test("gate mobile controls fit and English translations exist", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/gate?input=mock");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "시작!", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: "artifacts/gate-ready-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "한국어 / EN" }).click();
  await expect(
    page.getByRole("heading", { name: "FIT THROUGH!", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .locator(".game-dialog")
      .getByText(
        "This prototype uses no webcam. Prototype scores stay on this device.",
      ),
  ).toBeVisible();
});
