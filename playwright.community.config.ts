import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./community-tests",
  outputDir: "test-results/community",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5176",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:5176",
          localStorage: [{ name: "arcade.intro.seen.v1", value: "true" }],
        },
      ],
    },
  },
  webServer: {
    command: "npm run dev -- --port 5176 --strictPort",
    url: "http://127.0.0.1:5176",
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: "https://arcade-test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    },
  },
});
