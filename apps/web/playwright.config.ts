import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const SERVER_START_MS = 120_000;
const inCi = Boolean(process.env.CI);

// Runs against the production build: `pnpm e2e` builds first through Turborepo.
export default defineConfig({
  testDir: './e2e',
  forbidOnly: inCi,
  retries: inCi ? 1 : 0,
  reporter: inCi ? 'github' : 'list',
  use: { baseURL: BASE_URL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !inCi,
    timeout: SERVER_START_MS,
  },
});
