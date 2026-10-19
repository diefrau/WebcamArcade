import { test, expect } from "@playwright/test";
import {
  handPose,
  HomeSecretDetector,
  type HomeMotionFrame,
} from "../src/vision/homeSecrets";
import type { Landmark } from "../src/vision/gestures";
function hand(kind: "middle" | "peace" | "open", offset = 0): Landmark[] {
  const p = Array.from({ length: 21 }, () => ({ x: 0.5 + offset, y: 0.7 }));
  p[0] = { x: 0.5 + offset, y: 0.8 };
  p[4] = {
    x: (kind === "open" ? 0.3 : 0.5) + offset,
    y: kind === "open" ? 0.5 : 0.65,
  };
  for (let f = 0; f < 4; f++) {
    const i = 5 + f * 4,
      x = 0.44 + f * 0.05 + offset,
      open = kind === "open" || f === 1 || (kind === "peace" && f === 0);
    p[i] = { x, y: 0.58 };
    p[i + 1] = { x, y: 0.46 };
    p[i + 2] = { x, y: open ? 0.36 : 0.6 };
    p[i + 3] = { x, y: open ? 0.25 : 0.67 };
  }
  return p;
}
function frame(
  time: number,
  hands: Landmark[][] = [],
  expressions: Record<string, number> = {},
): HomeMotionFrame {
  const face = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.4 }));
  face[33].x = 0.38;
  face[263].x = 0.62;
  return { time, hands, face, expressions, aspect: 4 / 3 };
}
function held(
  hands: Landmark[][],
  expression: Record<string, number>,
  duration: number,
) {
  const detector = new HomeSecretDetector();
  let unlocked: string[] = [];
  for (let t = 0; t <= duration; t += 100)
    unlocked = detector.update(frame(t, hands, expression));
  return unlocked;
}
test("sustained geometry distinguishes the six secrets; gaps and ambiguous hands cannot unlock", () => {
  expect(handPose(hand("middle"))?.middle).toBe(true);
  expect(handPose(hand("peace"))?.middle).toBe(false);
  expect(handPose(hand("open"))?.open).toBe(true);
  expect(held([hand("middle")], {}, 1100)).not.toContain("manners");
  expect(held([hand("middle")], {}, 1200)).toContain("manners");
  expect(held([hand("open"), hand("open", -0.25)], {}, 2000)).toContain("jazz");
  expect(held([hand("peace"), hand("peace", -0.25)], {}, 1500)).toContain(
    "doublePeace",
  );
  expect(
    held([hand("peace")], { eyeBlinkLeft: 0.9, eyeBlinkRight: 0.05 }, 1000),
  ).toContain("winkPeace");
  expect(
    held([hand("peace")], { eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 }, 1500),
  ).not.toContain("winkPeace");
  expect(
    held([hand("open"), hand("open", -0.25)], { jawOpen: 0.8 }, 1000),
  ).toContain("surprise");
  const detector = new HomeSecretDetector();
  detector.update(frame(0, [hand("middle")]));
  expect(detector.update(frame(6000, [hand("middle")]))).not.toContain(
    "manners",
  );
  const collapsed = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  expect(handPose(collapsed)).toBeNull();
  expect(held([collapsed], {}, 3000)).not.toContain("manners");
});
test("five-second flicker requires reacquisition, a visible face and a stable centered hand", () => {
  const detector = new HomeSecretDetector();
  let result: string[] = [];
  for (let t = 0; t <= 6000; t += 100)
    result = detector.update(frame(t, t % 600 < 300 ? [hand("peace")] : []));
  expect(result).toContain("mystery");
  for (const mode of ["empty", "absentFace", "longLoss", "moving", "edge"]) {
    const d = new HomeSecretDetector();
    const awards: string[] = [];
    for (let t = 0; t <= 8000; t += 100) {
      const value = frame(
        t,
        mode === "empty" ||
          (mode === "longLoss" ? t % 2000 > 500 : t % 600 >= 300)
          ? []
          : [
              hand(
                "peace",
                mode === "moving"
                  ? t % 1200 < 600
                    ? -0.25
                    : 0.2
                  : mode === "edge"
                    ? -0.45
                    : 0,
              ),
            ],
      );
      if (mode === "absentFace") value.face = [];
      awards.push(...d.update(value));
    }
    expect(awards, mode).not.toContain("mystery");
  }
});

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});
test.describe("desktop home combined tracking", () => {
  test("home tracks two hands and face, reveals a secret once, persists it, and resets on navigation", async ({
    page,
  }) => {
    await page.clock.install();
    await page.addInitScript(() => {
      (window as any).homeInits = [];
      const OriginalWorker = window.Worker;
      window.Worker = class {
        onmessage: ((e: MessageEvent) => void) | null = null;
        listener = (e: Event) =>
          this.onmessage?.(
            new MessageEvent("message", {
              data: {
                type: "result",
                ...(e as CustomEvent).detail,
                time: performance.now(),
                aspect: 4 / 3,
              },
            }),
          );
        constructor(url: string | URL, options?: WorkerOptions) {
          if (
            !String(url).includes("hand.worker") &&
            !String(url).includes("home.worker")
          )
            return new OriginalWorker(url, options) as any;
          window.addEventListener("home-frame", this.listener);
        }
        postMessage(message: any) {
          if (message.type === "init") {
            (window as any).homeInits.push(message.home);
            setTimeout(
              () =>
                this.onmessage?.(
                  new MessageEvent("message", { data: { type: "ready" } }),
                ),
              0,
            );
          }
          message.bitmap?.close();
        }
        terminate() {
          window.removeEventListener("home-frame", this.listener);
        }
      } as any;
    });
    await page.goto("/achievements");
    await expect(page.locator(".secret-locked h3")).toHaveCount(6);
    await expect(page.locator(".secret-section")).not.toContainText("어허");
    await page.getByRole("link", { name: "홈", exact: true }).click();
    await page
      .getByRole("button", { name: "카메라 연결", exact: true })
      .first()
      .click();
    await expect(page.locator(".home-motion-status")).toBeVisible();
    expect(await page.evaluate(() => (window as any).homeInits)).toEqual([
      true,
    ]);
    const send = async (value: HomeMotionFrame) => {
      await page.evaluate(
        (value) =>
          window.dispatchEvent(
            new CustomEvent("home-frame", {
              detail: {
                hands: value.hands,
                landmarks: value.hands[0],
                face: value.face,
                expressions: value.expressions,
              },
            }),
          ),
        value,
      );
      await page.clock.runFor(100);
    };
    for (let i = 0; i < 15; i++) await send(frame(i * 100, [hand("middle")]));
    await expect(page.locator(".secret-toast")).toContainText(
      "어허, 그건 안돼요~",
    );
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("arcade.community.secrets") || "[]")
            .length,
      ),
    ).toBe(1);
    for (let i = 0; i < 15; i++) await send(frame(i * 100, [hand("middle")]));
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("arcade.community.secrets") || "[]")
            .length,
      ),
    ).toBe(1);
    await send(frame(4000, [hand("open"), hand("open", -0.25)]));
    await expect(page.locator(".tracked-hand")).toHaveCount(2);
    await expect(page.locator(".face-overlay circle")).toHaveCount(7);
    await page.getByRole("link", { name: "도전과제", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => (window as any).homeInits))
      .toContain(false);
    await expect(page.locator(".secret-achievement.unlocked")).toHaveCount(1);
    await expect(page.locator(".secret-locked h3")).toHaveCount(5);
    await expect(page.locator(".secret-achievement.unlocked")).toContainText(
      "어허, 그건 안돼요~",
    );
    await page.reload();
    await expect(page.locator(".secret-achievement.unlocked")).toHaveCount(1);
    for (const width of [320, 390, 1920]) {
      await page.setViewportSize({ width, height: 1080 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    }
    await page.screenshot({
      path: "artifacts/secret-achievements.png",
      fullPage: true,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page
        .locator(".secret-achievement.unlocked")
        .evaluate((el) => getComputedStyle(el, "::before").animationName),
    ).toBe("none");
  });
});

test.describe("touch home", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  test("keeps the lightweight hand pipeline instead of launching combined tracking", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const OriginalWorker = window.Worker;
      (window as any).trackingWorkers = [];
      window.Worker = class {
        onmessage: ((e: MessageEvent) => void) | null = null;
        constructor(url: string | URL, options?: WorkerOptions) {
          (window as any).trackingWorkers.push(String(url));
          if (!String(url).includes("hand.worker"))
            return new OriginalWorker(url, options) as any;
        }
        postMessage(message: any) {
          if (message.type === "init")
            setTimeout(
              () =>
                this.onmessage?.(
                  new MessageEvent("message", { data: { type: "ready" } }),
                ),
              0,
            );
          message.bitmap?.close();
        }
        terminate() {}
      } as any;
    });
    await page.goto("/");
    await page
      .getByRole("button", { name: "카메라 연결", exact: true })
      .first()
      .click();
    await expect(page.locator(".camera-note")).toContainText(
      "손바닥을 카메라에 보여주세요!",
    );
    await expect(page.locator(".home-motion-status")).toHaveCount(0);
    const workers = await page.evaluate(
      () => (window as any).trackingWorkers as string[],
    );
    expect(workers.some((url) => url.includes("hand.worker"))).toBe(true);
    expect(workers.some((url) => /home.worker|face.worker/.test(url))).toBe(
      false,
    );
    await page
      .getByRole("button", { name: "카메라 끄기", exact: true })
      .click();
  });
});
