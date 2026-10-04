import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./pages-tests",
  use: {
    baseURL: "http://127.0.0.1:4175",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "node scripts/serve-pages.mjs",
    url: "http://127.0.0.1:4175/WebcamArcade/",
    reuseExistingServer: false,
  },
  reporter: "list",
});
