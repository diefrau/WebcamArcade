import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Routing tests should depend only on the uploaded Pages artifact.
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
});

const routes = [
  ["/games", ".selection-games"],
  ["/play/shoot", ".playfield"],
  ["/play/circle", ".circle-stage"],
  ["/play/cham", ".cham-stage"],
  ["/result/shoot", ".empty-state"],
  ["/result/circle", ".empty-state"],
  ["/result/cham", ".empty-state"],
] as const;

for (const [route, screen] of routes) {
  test(`${route} supports direct access and refresh with query and hash`, async ({
    page,
  }) => {
    const path = `/WebcamArcade${route}`;
    const response = await page.goto(`${path}?from=shared&name=a%20b#arcade`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(
      `http://127.0.0.1:4175${path}?from=shared&name=a%20b#arcade`,
    );
    await expect(page.locator(".route-content")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(page.locator(screen)).toBeVisible();
    expect((await page.reload())?.status()).toBe(200);
    await expect(page).toHaveURL(
      `http://127.0.0.1:4175${path}?from=shared&name=a%20b#arcade`,
    );
    await expect(page.locator(screen)).toBeVisible();
  });
}

test("the directory slash opens the correct game and navigation retains the base", async ({
  page,
}) => {
  await page.goto("/WebcamArcade/play/cham/?from=directory");
  await expect(page).toHaveURL(
    "http://127.0.0.1:4175/WebcamArcade/play/cham?from=directory",
  );
  await page.getByRole("link", { name: /뒤로/ }).click();
  await expect(page).toHaveURL("http://127.0.0.1:4175/WebcamArcade/games");
  await page.getByRole("link", { name: "원 그리기 지금 플레이!" }).click();
  await expect(page).toHaveURL(
    "http://127.0.0.1:4175/WebcamArcade/play/circle",
  );
  await expect(page.locator(".circle-stage")).toBeVisible();
});

test("unknown routes recover through the built 404 page and local vision assets exist", async ({
  page,
  request,
}) => {
  const response = await page.goto("/WebcamArcade/missing/page?from=old-link");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveURL("http://127.0.0.1:4175/WebcamArcade/games");
  await expect(page.locator(".selection-games")).toBeVisible();
  for (const asset of [
    "vision/hand_landmarker.task",
    "vision/face_landmarker.task",
    "vision/wasm/vision_wasm_internal.wasm",
  ]) {
    expect((await request.get(`/WebcamArcade/${asset}`)).status()).toBe(200);
  }
  expect(
    (await request.get("/WebcamArcade/assets/missing-script.js")).status(),
  ).toBe(404);
});
