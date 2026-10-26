import { test, expect } from "@playwright/test";
test("built audio files resolve under the Pages base and play decoded samples after a gesture", async ({
  page,
}) => {
  await page.route("https://*.supabase.co/**", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: "{}" }),
  );
  await page.addInitScript(() => {
    (window as any).audioProof = { decoded: 0, started: 0 };
    const decode = OfflineAudioContext.prototype.decodeAudioData;
    OfflineAudioContext.prototype.decodeAudioData = function (
      bytes: ArrayBuffer,
    ) {
      return decode.call(this, bytes).then((buffer) => {
        (window as any).audioProof.decoded++;
        return buffer;
      });
    };
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      (window as any).audioProof.started++;
      return create.call(this);
    };
  });
  const paths = new Set<string>();
  page.on("response", (response) => {
    if (response.url().endsWith(".wav") && response.ok())
      paths.add(new URL(response.url()).pathname);
  });
  await page.goto("/WebcamArcade/games");
  await expect
    .poll(() => page.evaluate(() => (window as any).audioProof.decoded))
    .toBeGreaterThanOrEqual(18);
  expect(paths.size).toBe(16); // Two tiny WAVs are inlined by Vite.
  expect(
    [...paths].every((path) => path.startsWith("/WebcamArcade/assets/")),
  ).toBe(true);
  expect(await page.evaluate(() => (window as any).audioProof.started)).toBe(0);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).audioProof.started))
    .toBeGreaterThan(0);
});
