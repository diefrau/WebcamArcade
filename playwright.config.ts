import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results/main",
  use: {
    baseURL: "http://127.0.0.1:5177",
    viewport: { width: 1440, height: 1000 },
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:5177",
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
    command: "npm run dev -- --port 5177 --strictPort",
    url: "http://127.0.0.1:5177",
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
  },
  reporter: "list",
});
