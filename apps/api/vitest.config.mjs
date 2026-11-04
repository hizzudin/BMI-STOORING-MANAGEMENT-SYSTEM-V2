import { coverage, CRITICAL_THRESHOLD, GLOBAL_THRESHOLD } from '@bmi/config/vitest';
import { defineConfig } from 'vitest/config';

const SLOW_DATABASE_MS = 60_000;

export default defineConfig({
  test: {
    coverage: coverage({
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/worker.ts', 'src/infra/db/migrate-cli.ts'],
      thresholds: { ...GLOBAL_THRESHOLD, 'src/engine/**': CRITICAL_THRESHOLD },
    }),
    projects: [
      { test: { name: 'unit', include: ['src/**/*.spec.ts'] } },
      {
        test: {
          name: 'int',
          include: ['test/integration/**/*.test.ts'],
          globalSetup: ['test/integration/harness/global-setup.ts'],
          setupFiles: ['test/integration/harness/worker-setup.ts'],
          hookTimeout: SLOW_DATABASE_MS,
          testTimeout: SLOW_DATABASE_MS,
        },
      },
    ],
  },
});
