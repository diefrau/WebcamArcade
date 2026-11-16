import { test, expect } from "@playwright/test";
import { cutoutPlacement, maskAlpha } from "../src/vision/bodyCutout";
import { mockPose } from "../src/input/mockPose";
import { visionProfile } from "../src/vision/visionProfiles";

test("cutout alpha feathers background and shoulder placement stays aligned across camera sizes", () => {
  expect([0, 0.35, 0.55, 0.75, 1].map(maskAlpha)).toEqual([
    0, 0, 128, 255, 255,
  ]);
  const p = mockPose(0, 0);
  const small = cutoutPlacement(p, 640, 480)!;
  const large = cutoutPlacement(p, 1280, 960)!;
  expect(small.scale / large.scale).toBeCloseTo(2);
  expect(small.x * small.scale).toBeCloseTo(large.x * large.scale);
  expect(cutoutPlacement([], 640, 480)).toBeNull();
  expect(
    cutoutPlacement(
      p.map((v) => ({ ...v, visibility: 0 })),
      640,
      480,
    ),
  ).toBeNull();
  expect(visionProfile("/play/gate").segmentation).toBe(true);
  for (const [path, search] of [
    ["/play/gate", "?input=mock"],
    ["/result/gate", ""],
    ["/play/dodge", ""],
  ])
    expect(visionProfile(path, search).segmentation).toBe(false);
});

test("real pose worker removes a sample photo background and still returns joints", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/play/gate?input=mock");
  const result = await page.evaluate(async () => {
    const worker = new Worker(
      new URL("/src/vision/body.worker.ts", location.href),
      { type: "module" },
    );
    try {
      const ready = new Promise<any>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("model startup timeout")),
          30000,
        );
        worker.onerror = (e) => {
          clearTimeout(timer);
          reject(new Error(e.message));
        };
        worker.onmessage = (e) => {
          clearTimeout(timer);
          e.data.type === "error"
            ? reject(new Error("model error"))
            : resolve(e.data);
        };
      });
      worker.postMessage({
        type: "init",
        base: new URL("/", location.href).href,
        segmentation: true,
      });
      const initialized = await ready;
      const bitmap = await createImageBitmap(
        await (await fetch("/tests/fixtures/pose.jpg")).blob(),
      );
      const start = performance.now();
      const processed = new Promise<any>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("inference timeout")),
          15000,
        );
        worker.onmessage = (e) => {
          clearTimeout(timer);
          e.data.type === "error"
            ? reject(new Error("inference error"))
            : resolve(e.data);
        };
      });
      worker.postMessage({ type: "frame", bitmap, time: performance.now() }, [
        bitmap,
      ]);
      const data = await processed;
      if (!data.cutout) throw new Error("no segmentation cutout returned");
      const canvas = document.createElement("canvas");
      canvas.width = data.cutout.width;
      canvas.height = data.cutout.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(data.cutout, 0, 0);
      const corner = ctx.getImageData(0, 0, 1, 1).data[3];
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let opaque = 0,
        transparent = 0;
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] > 240) opaque++;
        if (pixels[i] === 0) transparent++;
      }
      data.cutout.close();
      return {
        initialized: initialized.segmentation,
        landmarks: data.landmarks.length,
        width: canvas.width,
        corner,
        opaque,
        transparent,
        ms: performance.now() - start,
      };
    } finally {
      worker.terminate();
    }
  });
  expect(result.initialized).toBe(true);
  expect(result.landmarks).toBe(33);
  expect(result.width).toBeLessThanOrEqual(512);
  expect(result.corner).toBe(0);
  expect(result.opaque).toBeGreaterThan(1000);
  expect(result.transparent).toBeGreaterThan(result.opaque);
  console.log("Real worker segmentation", result);
});

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

test("game composites matching frame pixels, clears stale cutouts and falls back on missing segmentation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    (window as any).segmentationInits = [];
    window.Worker = class extends EventTarget {
      onmessage: ((e: MessageEvent) => void) | null = null;
      listener = (event: Event) =>
        this.onmessage?.(
          new MessageEvent("message", { data: (event as CustomEvent).detail }),
        );
      constructor(url: string | URL, options?: WorkerOptions) {
        super();
        if (!String(url).includes("body.worker"))
          return new OriginalWorker(url, options) as unknown as typeof this;
        window.addEventListener("test-cutout", this.listener);
      }
      postMessage(m: any) {
        if (m.type === "init") {
          (window as any).segmentationInits.push(m.segmentation);
          setTimeout(
            () =>
              this.onmessage?.(
                new MessageEvent("message", {
                  data: { type: "ready", segmentation: true },
                }),
              ),
            0,
          );
        }
        m.bitmap?.close();
      }
      terminate() {
        window.removeEventListener("test-cutout", this.listener);
      }
    } as unknown as typeof Worker;
  });
  await page.goto("/play/gate");
  await page
    .locator(".game-dialog")
    .getByRole("button", { name: "카메라 연결", exact: true })
    .click();
  await expect(page.locator(".webcam-frame")).toHaveClass(/is-live/);
  const send = async (withImage = true, segmentation = true) =>
    page.evaluate(
      async ({ withImage, segmentation }) => {
        const points = Array.from({ length: 33 }, () => ({
          x: 0.5,
          y: 0.5,
          visibility: 1,
        }));
        points[0] = { x: 0.5, y: 0.15, visibility: 1 };
        points[11] = { x: 0.65, y: 0.45, visibility: 1 };
        points[12] = { x: 0.35, y: 0.45, visibility: 1 };
        points[13] = { x: 0.8, y: 0.4, visibility: 1 };
        points[15] = { x: 0.9, y: 0.3, visibility: 1 };
        points[14] = { x: 0.2, y: 0.4, visibility: 1 };
        points[16] = { x: 0.1, y: 0.3, visibility: 1 };
        const source = new OffscreenCanvas(400, 300),
          ctx = source.getContext("2d")!;
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(90, 100, 40, 100);
        ctx.fillStyle = "#00ff00";
        ctx.fillRect(240, 100, 40, 100);
        const cutout = withImage ? await createImageBitmap(source) : undefined;
        (window as any).lastTestCutout = cutout;
        window.dispatchEvent(
          new CustomEvent("test-cutout", {
            detail: {
              type: "result",
              segmentation,
              landmarks: points,
              cutout,
              time: performance.now(),
              aspect: 4 / 3,
            },
          }),
        );
      },
      { withImage, segmentation },
    );
  await send();
  await expect(page.locator(".gate-world")).toHaveAttribute(
    "data-cutout",
    "live",
  );
  const pixels = await page.locator(".gate-cutout").evaluate((el) => {
    const ctx = (el as HTMLCanvasElement).getContext("2d")!;
    return {
      left: Array.from(ctx.getImageData(410, 280, 1, 1).data),
      right: Array.from(ctx.getImageData(630, 280, 1, 1).data),
      empty: ctx.getImageData(50, 50, 1, 1).data[3],
      bottom: ctx.getImageData(410, 560, 1, 1).data[3],
    };
  });
  expect(pixels.left).toEqual([0, 255, 0, 255]);
  expect(pixels.right).toEqual([255, 0, 0, 255]);
  expect(pixels.empty).toBe(0);
  expect(pixels.bottom).toBe(0);
  await expect(page.locator(".gate-world")).toHaveAttribute(
    "data-cutout",
    "fallback",
    { timeout: 3000 },
  );
  await expect
    .poll(() => page.evaluate(() => (window as any).lastTestCutout.width))
    .toBe(0);
  await send(false, false);
  await expect(page.locator(".gate-cutout-status")).toHaveText(
    "자세 안내로 플레이 중",
  );
  await send();
  await expect(page.locator(".gate-world")).toHaveAttribute(
    "data-cutout",
    "live",
  );
  await page.getByRole("link", { name: /뒤로/ }).click();
  await expect(page).toHaveURL(/games$/);
  await expect
    .poll(() => page.evaluate(() => (window as any).lastTestCutout.width))
    .toBe(0);
  expect(await page.evaluate(() => (window as any).segmentationInits)).toEqual([
    true,
  ]);
});
