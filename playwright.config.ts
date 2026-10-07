import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/auth.spec.ts", "**/planning.spec.ts", "**/search.spec.ts", "**/consignment.spec.ts", "**/labels.spec.ts", "**/users.spec.ts"],
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://127.0.0.1:3011", locale: "th-TH", timezoneId: "Asia/Bangkok", trace: "retain-on-failure" },
  webServer: {
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3011",
    url: "http://127.0.0.1:3011/api/health/live", reuseExistingServer: false, timeout: 60000,
  },
});
