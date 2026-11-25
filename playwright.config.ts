import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.CI,
);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3009/numbers-game/",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx vp build && npx vp preview --port 3009",
    url: "http://localhost:3009/numbers-game/",
    reuseExistingServer: !isCI,
  },
});
