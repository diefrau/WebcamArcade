import { test, expect } from "@playwright/test";

async function mockCommunity(page: import("@playwright/test").Page) {
  const state = {
    signups: 0,
    authFail: false,
    nickname: "",
    profile: false,
    fail: false,
    submissions: [] as string[],
    hold: null as Promise<void> | null,
  };
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
    const url = route.request().url();
    const payload = route.request().postDataJSON();
    let body: unknown = null;
    let status = 200;
    if (url.includes("/signup")) {
      state.signups++;
      if (state.authFail) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ message: "Temporarily unavailable" }),
        });
        return;
      }
      const jwt = Buffer.from(
        JSON.stringify({
          sub: uid,
          exp: Math.floor(Date.now() / 1000) + 3600,
          aud: "authenticated",
          role: "authenticated",
        }),
      ).toString("base64url");
      body = {
        access_token: `eyJhbGciOiJIUzI1NiJ9.${jwt}.signature`,
        refresh_token: "test-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      };
    } else if (url.includes("/rpc/arcade_join")) {
      state.profile = true;
      state.nickname = payload.p_nickname;
    } else if (url.includes("/arcade_profiles"))
      body = state.profile
        ? { nickname: state.nickname, anonymous_name: "익명2352" }
        : null;
    else if (url.includes("/rpc/arcade_submit")) {
      if (state.fail) {
        status = 503;
        body = { message: "Disconnected" };
      } else {
        await state.hold;
        state.submissions.push(payload.p_id);
      }
    } else if (url.includes("/auth/v1/user")) body = user;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return state;
}

async function record(page: import("@playwright/test").Page, game = "circle") {
  await page.evaluate(async (game) => {
    const client = await import("/src/community/client.ts");
    client.recordPlay(game, 800, 0, 20);
  }, game);
}
const runs = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("arcade.community.runs") || "[]"),
  );

test("first home visit asks once; anonymous name is stable and keyboard/mobile layouts fit", async ({
  page,
}) => {
  const state = await mockCommunity(page);
  await page.goto("/");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(state.signups).toBe(0);
  await expect(page.getByLabel("닉네임", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  for (const width of [320, 390, 768, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "익명으로 시작", exact: true }),
    ).toBeInViewport();
  }
  await page.screenshot({
    path: "artifacts/player-welcome.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "익명으로 시작", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".player-strip strong")).toHaveText("익명2352");
  await expect(page.locator(".player-strip")).toContainText("동기화 완료");
  await page.reload();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".player-strip strong")).toHaveText("익명2352");
  expect(state.signups).toBe(1);
  await page.getByRole("button", { name: "이름 변경", exact: true }).click();
  await page.getByLabel("닉네임", { exact: true }).fill("토끼 플레이어");
  await page
    .getByRole("button", { name: "이 이름으로 시작!", exact: true })
    .click();
  await expect(page.locator(".player-strip strong")).toHaveText(
    "토끼 플레이어",
  );
  await expect.poll(() => state.nickname).toBe("토끼 플레이어");
  expect(state.signups).toBe(1);
});

test("each finish syncs without a manual action; overlapping finishes drain and a failed result retries", async ({
  page,
}) => {
  const state = await mockCommunity(page);
  await page.goto("/");
  await page.getByLabel("닉네임", { exact: true }).fill("고양이");
  await page
    .getByRole("button", { name: "이 이름으로 시작!", exact: true })
    .click();
  await expect(page.locator(".player-strip")).toContainText("동기화 완료");
  let release!: () => void;
  state.hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await record(page);
  await expect
    .poll(() => page.locator(".player-strip").innerText())
    .toContain("자동 동기화 중");
  await record(page, "shoot");
  release();
  state.hold = null;
  await expect.poll(() => state.submissions.length).toBe(2);
  await expect
    .poll(async () =>
      (await runs(page)).every((r: { synced?: boolean }) => r.synced),
    )
    .toBe(true);
  expect(new Set(state.submissions).size).toBe(2);
  state.fail = true;
  await record(page);
  await expect(page.locator(".player-strip")).toContainText(
    "연결되면 자동 동기화",
  );
  expect(
    (await runs(page)).filter((r: { synced?: boolean }) => !r.synced),
  ).toHaveLength(1);
  state.fail = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => state.submissions.length).toBe(3);
  await expect
    .poll(async () =>
      (await runs(page)).every((r: { synced?: boolean }) => r.synced),
    )
    .toBe(true);
  await expect(page.locator(".player-strip")).toContainText("동기화 완료");
  await page.reload();
  await expect(page.locator(".player-strip")).toContainText("동기화 완료");
  expect(state.submissions.length).toBe(3);
  expect(state.signups).toBe(1);
});

test("a first-visit connection failure preserves the choice and recovers without another popup", async ({
  page,
}) => {
  const state = await mockCommunity(page);
  state.authFail = true;
  await page.goto("/");
  await page.getByLabel("닉네임", { exact: true }).fill("오프라인 친구");
  await page
    .getByRole("button", { name: "이 이름으로 시작!", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".player-strip")).toContainText(
    "연결되면 자동 동기화",
  );
  await record(page);
  expect((await runs(page))[0].synced).not.toBe(true);
  state.authFail = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".player-strip")).toContainText("동기화 완료");
  await expect.poll(() => state.nickname).toBe("오프라인 친구");
  await expect.poll(() => state.submissions.length).toBe(1);
  await page.reload();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".player-strip strong")).toHaveText(
    "오프라인 친구",
  );
});
