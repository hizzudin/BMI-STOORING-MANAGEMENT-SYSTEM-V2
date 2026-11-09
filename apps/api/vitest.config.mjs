import {
  coverage,
  CRITICAL_THRESHOLD,
  GLOBAL_THRESHOLD,
  UNIT_TEST_TIMEOUT_MS,
} from '@bmi/config/vitest';
import { defineConfig } from 'vitest/config';

const SLOW_DATABASE_MS = 180_000;

export default defineConfig({
  test: {
    coverage: coverage({
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/worker.ts',
        'src/infra/db/migrate-cli.ts',
        'src/http/openapi/emit.ts',
      ],
      // D-09: the critical tier of PRD 8.4; the registry service lives in src/engine/registry/.
      thresholds: { ...GLOBAL_THRESHOLD, 'src/engine/**': CRITICAL_THRESHOLD },
    }),
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
          testTimeout: UNIT_TEST_TIMEOUT_MS,
          hookTimeout: UNIT_TEST_TIMEOUT_MS,
        },
      },
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
