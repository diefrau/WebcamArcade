import { test, expect } from "@playwright/test";
test("published music is gesture-gated, loads under the Pages base, and switches from menu to circle", async ({
  page,
}) => {
  await page.route("https://*.supabase.co/**", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: "{}" }),
  );
  await page.addInitScript(() => {
    (window as any).musicMedia = [];
    const AudioConstructor = window.Audio;
    window.Audio = function (...args: any[]) {
      const audio = new AudioConstructor(...args);
      (window as any).musicMedia.push(audio);
      return audio;
    } as any;
  });
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".mp3")) requests.push(request.url());
  });
  const playing = () =>
    page.evaluate(() =>
      (window as any).musicMedia
        .filter((m: HTMLAudioElement) => m.src && !m.paused)
        .map((m: HTMLAudioElement) => m.src),
    );
  await page.goto("/WebcamArcade/games");
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect.poll(() => playing()).toHaveLength(1);
  expect((await playing())[0]).toContain(
    "/WebcamArcade/assets/WebArcMainTitle-",
  );
  await page.getByRole("button", { name: "닫기", exact: true }).last().click();
  await page.locator('.game-card[href="/WebcamArcade/play/circle"]').click();
  await expect
    .poll(async () => {
      const urls = await playing();
      return (
        urls.length === 1 && urls[0].includes("/WebcamArcade/assets/WebArcLTR-")
      );
    })
    .toBe(true);
  expect(
    requests.every((url) =>
      new URL(url).pathname.startsWith("/WebcamArcade/assets/"),
    ),
  ).toBe(true);
});
