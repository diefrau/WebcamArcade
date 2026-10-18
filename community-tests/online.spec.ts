import { test, expect } from "@playwright/test";
test("anonymous opt-in syncs pending records once, shows rankings, and recovers from network errors", async ({
  page,
}) => {
  let profile = false,
    submits = 0,
    signups = 0,
    broken = false,
    nickname = "";
  const uid = "11111111-1111-4111-8111-111111111111";
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    is_anonymous: true,
    created_at: new Date().toISOString(),
    app_metadata: { provider: "anonymous" },
    user_metadata: {},
  };
  await page.route("https://arcade-test.supabase.co/**", async (route) => {
    const url = route.request().url(),
      data = route.request().postDataJSON();
    let body: unknown = {};
    let status = 200;
    if (url.includes("/signup")) {
      signups++;
      const payload = Buffer.from(
        JSON.stringify({
          sub: uid,
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          aud: "authenticated",
          role: "authenticated",
          is_anonymous: true,
        }),
      ).toString("base64url");
      body = {
        access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`,
        refresh_token: "test-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      };
    } else if (url.includes("/rpc/arcade_join")) {
      profile = true;
      nickname = data.p_nickname;
      body = null;
    } else if (url.includes("/arcade_profiles"))
      body = profile ? { nickname } : null;
    else if (url.includes("/rpc/arcade_submit")) {
      submits++;
      body = null;
    } else if (url.includes("/rpc/arcade_progress"))
      body = {
        first: true,
        five: false,
        variety: false,
        sharp: false,
        artist: false,
        reflex: false,
        rps: true,
        survivor: false,
      };
    else if (url.includes("/rpc/arcade_board")) {
      status = broken ? 500 : 200;
      body = broken
        ? { message: "offline" }
        : [{ place: 1, nickname: nickname || "익명", score: 400 }];
    } else if (url.includes("/auth/v1/user")) body = user;
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(body),
    });
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "arcade.community.runs",
      JSON.stringify([
        {
          id: "33333333-3333-4333-8333-333333333333",
          game: "rps",
          score: 400,
          accuracy: 0,
          seconds: 0,
          date: new Date().toISOString(),
        },
      ]),
    ),
  );
  await page.goto("/ranking");
  await page.getByRole("button", { name: "온라인", exact: true }).click();
  await expect(page.locator(".community-board li")).toHaveCount(1);
  expect(signups).toBe(0);
  expect(submits).toBe(0);
  await page
    .getByRole("button", { name: "익명으로 참가", exact: true })
    .click();
  await expect(page.getByText("참가 중 ·", { exact: false })).toBeVisible();
  await expect.poll(() => submits).toBe(1);
  expect(signups).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("arcade.community.runs")!)[0].synced,
      ),
    )
    .toBe(true);
  await page.getByRole("textbox").fill("<img src=x>");
  await page.getByRole("button", { name: "닉네임 저장 / 동기화" }).click();
  await expect(page.locator(".community-board li")).toContainText(
    "<img src=x>",
  );
  await expect(page.locator(".community-board img")).toHaveCount(0);
  expect(submits).toBe(1);
  broken = true;
  await page.getByRole("button", { name: "원 그리기", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  broken = false;
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.locator(".community-board li")).toHaveCount(1);
  await page.getByRole("link", { name: "도전과제", exact: true }).click();
  await page.getByRole("button", { name: "온라인", exact: true }).click();
  await expect(page.locator(".achievement.unlocked")).toHaveCount(2);
  expect(submits).toBe(1);
});
