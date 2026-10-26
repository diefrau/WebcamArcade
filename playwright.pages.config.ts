import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./pages-tests",
  outputDir: "test-results/pages",
  use: {
    baseURL: "http://127.0.0.1:4175",
    viewport: { width: 1440, height: 1000 },
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:4175",
          localStorage: [
            { name: "arcade.intro.seen.v1", value: "true" },
            {
              name: "arcade.player.choice",
              value: JSON.stringify({
                nickname: "테스트",
                anonymousName: "익명1000",
              }),
            },
          ],
        },
      ],
    },
  },
  webServer: {
    command: "node scripts/serve-pages.mjs",
    url: "http://127.0.0.1:4175/WebcamArcade/",
    reuseExistingServer: false,
  },
  reporter: "list",
});
