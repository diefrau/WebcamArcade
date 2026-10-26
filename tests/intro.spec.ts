import { test, expect, type Page } from "@playwright/test";
import { introPhaseAt } from "../src/components/intro/timeline";
test("intro has fixed beats rather than a loading-progress gate", () => {
  const times = [
    0, 199, 200, 899, 900, 1450, 2000, 2550, 2900, 3000, 4500, 5100, 5800,
  ];
  expect(times.map(introPhaseAt)).toEqual([
    "blank",
    "blank",
    "ready",
    "ready",
    "three",
    "two",
    "one",
    "go",
    "flash",
    "title",
    "fade",
    "reveal",
    "complete",
  ]);
});
async function firstVisit(page: Page, nickname = true) {
  await page.addInitScript((nickname) => {
    if (!sessionStorage.getItem("intro-test-initialized")) {
      localStorage.removeItem("arcade.intro.seen.v1");
      if (!nickname) localStorage.removeItem("arcade.player.choice");
      sessionStorage.setItem("intro-test-initialized", "true");
    }
    (window as any).introMedia = [];
    const Original = window.Audio;
    window.Audio = function (...args: any[]) {
      const media = new Original(...args);
      (window as any).introMedia.push(media);
      return media;
    } as any;
  }, nickname);
}
test("first entry follows all beats, starts one title track, reduces its mix and reveals home", async ({
  page,
}) => {
  await firstVisit(page);
  await page.clock.install();
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "START!", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".hero")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).introMedia.length)).toBe(0);
  await page.evaluate(async () => {
    const { SoundManager } = await import("/src/audio/soundManager.ts");
    (window as any).introCalls = [];
    const play = SoundManager.prototype.play;
    SoundManager.prototype.play = function (cue: any, options: any) {
      (window as any).introCalls.push(cue);
      return play.call(this, cue, options);
    };
    const mix = SoundManager.prototype.setMusicMix;
    SoundManager.prototype.setMusicMix = function (
      value: number,
      seconds: number,
    ) {
      (window as any).introCalls.push(["mix", value, seconds]);
      return mix.call(this, value, seconds);
    };
  });
  await page.getByRole("button", { name: "START!", exact: true }).click();
  const sequence = page.locator(".intro-sequence");
  await page.clock.runFor(224);
  await expect(sequence).toHaveAttribute("data-phase", "ready");
  for (const phase of ["three", "two", "one", "go"]) {
    await page.clock.runFor(phase === "three" ? 700 : 550);
    await expect(sequence).toHaveAttribute("data-phase", phase);
  }
  expect(
    await page.evaluate(() =>
      (window as any).introMedia.every(
        (m: HTMLAudioElement) => m.paused || m.muted,
      ),
    ),
  ).toBe(true);
  await page.clock.runFor(450);
  await expect(sequence).toHaveAttribute("data-phase", "title");
  await expect(
    page.locator('.intro-title-card [data-character="landing"]'),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).introMedia.filter(
            (m: HTMLAudioElement) => !m.paused && !m.muted,
          ).length,
      ),
    )
    .toBe(1);
  const count = await page.evaluate(() => (window as any).introMedia.length);
  await page.clock.runFor(1500);
  await expect(sequence).toHaveAttribute("data-phase", "fade");
  await expect(page.locator(".entry-home-reveal")).toHaveAttribute("inert", "");
  await page.clock.runFor(600);
  await expect(sequence).toHaveAttribute("data-phase", "reveal");
  await page.clock.runFor(750);
  await expect(sequence).toHaveCount(0);
  await expect(page.locator(".hero")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("arcade.intro.seen.v1")),
  ).toBe("true");
  expect(await page.evaluate(() => (window as any).introMedia.length)).toBe(
    count,
  );
  const events = await page.evaluate(() => (window as any).introCalls);
  expect(events.filter((x: any) => x === "game.countdown")).toHaveLength(3);
  expect(events.filter((x: any) => x === "game.start")).toHaveLength(1);
  expect(events).toContainEqual(["mix", 0.7, 0.8]);
  expect(
    await page.evaluate(() => localStorage.getItem("arcade.music.volume")),
  ).toBe("0.65");
});
test("skipping cancels later cues and nickname entry waits until the sequence finishes", async ({
  page,
}) => {
  await firstVisit(page, false);
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page.getByRole("button", { name: "START!", exact: true }).click();
  await page.clock.runFor(1000);
  await page.keyboard.press("Escape");
  await expect(page.locator(".intro-sequence")).toHaveCount(0);
  await expect(page.locator("dialog[open]")).toBeVisible();
  await page.clock.runFor(8000);
  await expect(page.locator(".intro-sequence")).toHaveCount(0);
});
test("revisits bypass entry, direct game links stay playable, and settings can replay", async ({
  page,
}) => {
  await firstVisit(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "인트로 건너뛰기", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".intro-sequence")).toHaveCount(0);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page
    .getByRole("button", { name: "인트로 다시 보기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "START!", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/play/circle");
  await expect(page.locator(".intro-sequence")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "시작!", exact: true }),
  ).toBeVisible();
});
test("entry fits touch screens and reduced motion removes large movement and flash", async ({
  page,
}) => {
  await firstVisit(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const width of [320, 390, 1920]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "START!", exact: true })
      .click({ trial: true });
    await page
      .getByRole("button", { name: "인트로 건너뛰기", exact: true })
      .click({ trial: true });
  }
  await page.clock.install();
  await page.getByRole("button", { name: "START!", exact: true }).click();
  await page.clock.runFor(260);
  expect(
    await page
      .locator(".intro-word")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.keyboard.press("Space");
  await expect(page.locator(".intro-sequence")).toHaveCount(0);
});

for (const key of ["Enter", "Space", "click"]) {
  test(
    "keyboard start and " + key + " skip leave no delayed countdown sounds",
    async ({ page }) => {
      await firstVisit(page);
      await page.clock.install();
      await page.goto("/");
      await page.keyboard.press("Enter");
      await page.clock.runFor(300);
      await expect(page.locator(".intro-sequence")).toHaveAttribute(
        "data-phase",
        "ready",
      );
      await page.evaluate(async () => {
        const { SoundManager } = await import("/src/audio/soundManager.ts");
        (window as any).afterSkipCues = 0;
        const original = SoundManager.prototype.play;
        SoundManager.prototype.play = function (cue: any, options: any) {
          (window as any).afterSkipCues++;
          return original.call(this, cue, options);
        };
      });
      if (key === "click") await page.locator(".intro-word").click();
      else await page.keyboard.press(key);
      await expect(page.locator(".intro-sequence")).toHaveCount(0);
      const count = await page.evaluate(() => (window as any).afterSkipCues);
      await page.clock.runFor(8000);
      expect(await page.evaluate(() => (window as any).afterSkipCues)).toBe(
        count,
      );
    },
  );
}
test("saved sound off stays silent throughout the intro and home reveal", async ({
  page,
}) => {
  await firstVisit(page);
  await page.clock.install();
  await page.addInitScript(() => {
    localStorage.setItem("arcade.sound", "false");
    (window as any).introSources = 0;
    const original = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      (window as any).introSources++;
      return original.call(this);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "START!", exact: true }).click();
  await page.clock.runFor(6000);
  await expect(page.locator(".intro-sequence")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).introSources)).toBe(0);
  expect(await page.evaluate(() => (window as any).introMedia.length)).toBe(0);
  await expect(
    page.getByRole("button", { name: "사운드 OFF", exact: true }),
  ).toBeVisible();
});

test("skipping from the title continues the same music immediately at home volume", async ({
  page,
}) => {
  await firstVisit(page);
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "START!", exact: true }).click();
  await page.clock.runFor(3300);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).introMedia.filter(
            (m: HTMLAudioElement) => m.src && !m.paused && !m.muted,
          ).length,
      ),
    )
    .toBe(1);
  const before = await page.evaluate(() => ({
    count: (window as any).introMedia.length,
    time: (window as any).introMedia.at(-1).currentTime,
  }));
  await page
    .getByRole("button", { name: "인트로 건너뛰기", exact: true })
    .click();
  await expect(page.locator(".intro-sequence")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).introMedia.filter(
            (m: HTMLAudioElement) => m.src && !m.paused && !m.muted,
          ).length,
      ),
    )
    .toBe(1);
  expect(await page.evaluate(() => (window as any).introMedia.length)).toBe(
    before.count,
  );
  expect(
    await page.evaluate(() => (window as any).introMedia.at(-1).currentTime),
  ).toBeGreaterThanOrEqual(before.time);
});
