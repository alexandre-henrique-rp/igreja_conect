import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — Igreja Conect.
 *
 * Os specs E2E entram a partir da S01 (auth flow). Por ora a config está
 * pronta e vazia: rodar `pnpm test:e2e` não falha (sem specs) mas permite
 * `pnpm playwright codegen` para criar novos testes.
 *
 * Servidor de dev sobe automaticamente em http://localhost:5173 via
 * `pnpm dev` antes de cada run.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
