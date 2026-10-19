import { test, expect } from "@playwright/test";
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});
test("built desktop home runs both real local models and keeps one camera stream", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.route("https://*.supabase.co/**", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: '{"message":"Isolated artifact check"}',
    }),
  );
  const models = new Set<string>();
  page.on("response", (response) => {
    if (response.url().endsWith(".task") && response.status() === 200)
      models.add(new URL(response.url()).pathname.split("/").pop()!);
  });
  await page.goto("/WebcamArcade/");
  await page
    .getByRole("button", { name: "카메라 연결", exact: true })
    .first()
    .click();
  await expect(page.locator(".home-motion-status")).toBeVisible({
    timeout: 40000,
  });
  expect(models.has("hand_landmarker.task")).toBe(true);
  expect(models.has("face_landmarker.task")).toBe(true);
  await expect(page.locator(".camera-note")).not.toHaveClass(/warning/);
  const id = await page
    .locator(".camera-video")
    .evaluate((el) =>
      (el as HTMLVideoElement).srcObject instanceof MediaStream
        ? (
            (el as HTMLVideoElement).srcObject as MediaStream
          ).getVideoTracks()[0].id
        : "",
    );
  await page.getByRole("button", { name: "게임 시작!", exact: true }).click();
  await page
    .getByRole("link", { name: "쏴! 지금 플레이!", exact: true })
    .click();
  await expect(page.locator(".camera-note")).toContainText(
    "손바닥을 카메라에 보여주세요!",
    { timeout: 15000 },
  );
  expect(
    await page
      .locator(".camera-video")
      .evaluate(
        (el) =>
          (
            (el as HTMLVideoElement).srcObject as MediaStream
          ).getVideoTracks()[0].id,
      ),
  ).toBe(id);
  await page.getByRole("button", { name: "카메라 끄기", exact: true }).click();
});
