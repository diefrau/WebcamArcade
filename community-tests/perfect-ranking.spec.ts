import { test, expect } from "@playwright/test";
test("online board displays server perfect totals, keeps score and handles old server fallback", async ({
  page,
}) => {
  let legacy = false;
  await page.route("https://arcade-test.supabase.co/**", async (route) => {
    const url = route.request().url();
    let body: unknown = null,
      status = 200;
    if (url.includes("/rpc/arcade_board_mode_v2") && legacy) {
      status = 404;
      body = { code: "PGRST202", message: "function not found" };
    } else if (url.includes("/rpc/arcade_board")) {
      const args = route.request().postDataJSON();
      body =
        args.p_game === "circle"
          ? [
              {
                place: 1,
                nickname: "원고수",
                score: 1000,
                ...(!legacy ? { max_count: 2 } : {}),
              },
              {
                place: 2,
                nickname: "첫만점",
                score: 1000,
                ...(!legacy ? { max_count: 1 } : {}),
              },
            ]
          : [];
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(body),
    });
  });
  await page.goto("/ranking");
  await page.getByRole("button", { name: "온라인", exact: true }).click();
  await page
    .locator(".community-games")
    .first()
    .getByRole("button", { name: "원 그리기", exact: true })
    .click();
  await expect(page.locator(".community-board li").first()).toContainText(
    "원고수",
  );
  await expect(
    page.locator(".community-board li").first().locator("b"),
  ).toHaveText("1,000 × 2");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  legacy = true;
  await page
    .locator(".community-games")
    .first()
    .getByRole("button", { name: "가위바위보", exact: true })
    .click();
  await page
    .locator(".community-games")
    .first()
    .getByRole("button", { name: "원 그리기", exact: true })
    .click();
  await expect(page.locator(".community-board li")).toHaveCount(2);
  await expect(page.locator(".community-board .perfect-count")).toHaveCount(0);
});
