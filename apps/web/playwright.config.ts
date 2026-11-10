import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const SERVER_START_MS = 120_000;
const inCi = Boolean(process.env.CI);
const API_PORT = 3001;
const LOCAL_TEST_DATABASE_URL = 'postgres://bmi:bmi_local_dev@localhost:5432/bmi_dev';

// The API under test runs on the bmi_e2e database that e2e/global-setup.ts rebuilds (TASK-104).
function e2eDatabaseUrl(): string {
  const url = new URL(process.env.TEST_DATABASE_URL ?? LOCAL_TEST_DATABASE_URL);
  url.pathname = '/bmi_e2e';
  return url.toString();
}

// Runs against the production build: `pnpm e2e` builds first through Turborepo.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  forbidOnly: inCi,
  retries: inCi ? 1 : 0,
  // Every spec shares one e2e database and accounts whose roles change during the run (FLW-AM-03
  // moves the System Admin role), so the specs run one at a time.
  workers: 1,
  reporter: inCi ? 'github' : 'list',
  // A sign-in hashes with the production scrypt cost, which takes seconds on a slow machine.
  expect: { timeout: 20_000 },
  use: { baseURL: BASE_URL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // The web app's /api proxy points at this port (next.config.ts); stop a local dev API first.
      command: 'node ../api/dist/main.js',
      url: `http://localhost:${API_PORT}/health`,
      env: { PORT: String(API_PORT), DATABASE_URL: e2eDatabaseUrl(), WEB_ORIGIN: BASE_URL },
      reuseExistingServer: false,
      timeout: SERVER_START_MS,
    },
    {
      command: `pnpm exec next start -p ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: !inCi,
      timeout: SERVER_START_MS,
    },
  ],
});
