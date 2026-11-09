import { UNIT_TEST_TIMEOUT_MS, coverage, CRITICAL_THRESHOLD } from '@bmi/config/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: UNIT_TEST_TIMEOUT_MS,
    hookTimeout: UNIT_TEST_TIMEOUT_MS,
    include: ['src/**/*.test.ts'],
    coverage: coverage({ include: ['src/**/*.ts'], thresholds: CRITICAL_THRESHOLD }),
  },
});
