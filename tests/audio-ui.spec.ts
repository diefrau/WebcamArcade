import { test, expect, type Page } from "@playwright/test";
async function trace(page: Page) {
  await page.evaluate(async () => {
    const module = await import("/src/audio/soundManager.ts");
    const original = module.SoundManager.prototype.play;
    (window as any).soundCalls = [];
    module.SoundManager.prototype.play = function (cue: any, options: any) {
      (window as any).soundCalls.push({ cue, options });
      return original.call(this, cue, options);
    };
  });
}
const calls = (page: Page, cue: string) =>
  page.evaluate(
    (cue) =>
      (window as any).soundCalls.filter((x: any) => x.cue === cue).length,
    cue,
  );
test("real decoded WAVs and oscillators play through one engine; mute persists and autoplay stays silent", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const counts = { samples: 0, synth: 0 };
    (window as any).audioCounts = counts;
    const proto = AudioContext.prototype;
    const sample = proto.createBufferSource,
      oscillator = proto.createOscillator;
    proto.createBufferSource = function () {
      counts.samples++;
      return sample.call(this);
    };
    proto.createOscillator = function () {
      counts.synth++;
      return oscillator.call(this);
    };
  });
  await page.goto("/games");
  await trace(page);
  await page.evaluate(async () => {
    const { sampleFiles } = await import("/src/audio/sounds.ts");
    const offline = new OfflineAudioContext(1, 1, 44100);
    for (const url of Object.values(sampleFiles)) {
      const response = await fetch(url);
      if (!response.ok) throw Error(url);
      const buffer = await offline.decodeAudioData(
        await response.arrayBuffer(),
      );
      if (buffer.duration <= 0 || buffer.duration > 0.65)
        throw Error("Invalid sample duration");
    }
  });
  expect(await page.evaluate(() => (window as any).audioCounts)).toEqual({
    samples: 0,
    synth: 0,
  });
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).audioCounts.samples))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "닫기", exact: true }).last().click();
  await page.locator(".top-nav a").first().hover();
  await expect
    .poll(() => page.evaluate(() => (window as any).audioCounts.synth))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "사운드 ON", exact: true }).click();
  const before = await page.evaluate(() => (window as any).audioCounts.samples);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  expect(await page.evaluate(() => (window as any).audioCounts.samples)).toBe(
    before,
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "사운드 OFF", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).audioCounts)).toEqual({
    samples: 0,
    synth: 0,
  });
});
test("countdown follows visible beats and commands do not repeat on pause/resume", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/play/dodge");
  await trace(page);
  await page.getByRole("button", { name: "게임 시작!", exact: true }).click();
  expect(await calls(page, "game.ready")).toBe(1);
  expect(await calls(page, "game.countdown")).toBe(1);
  await page.clock.runFor(1100);
  expect(await calls(page, "game.countdown")).toBe(2);
  await page.keyboard.press("Escape");
  await page.clock.runFor(1000);
  expect(await calls(page, "game.countdown")).toBe(2);
  await page
    .getByRole("button", { name: "계속하기", exact: true })
    .last()
    .click();
  await page.clock.runFor(2100);
  expect(await calls(page, "game.countdown")).toBe(3);
  expect(await calls(page, "game.start")).toBe(1);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "계속하기", exact: true })
    .last()
    .click();
  expect(await calls(page, "game.start")).toBe(1);
});
test("camera permission is silent and a reused stream does not replay the connection chime", async ({
  page,
}) => {
  await page.goto("/play/shoot");
  await trace(page);
  await page.getByRole("button", { name: "카메라 연결", exact: true }).click();
  await expect.poll(() => calls(page, "camera.ready")).toBe(1);
  expect(await calls(page, "ui.click")).toBe(0);
  await page.getByRole("link", { name: "← 뒤로", exact: true }).click();
  await expect(page).toHaveURL(/\/games$/);
  expect(await calls(page, "camera.ready")).toBe(1);
});
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});
