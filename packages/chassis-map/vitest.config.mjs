import { UNIT_TEST_TIMEOUT_MS, coverage } from '@bmi/config/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: UNIT_TEST_TIMEOUT_MS,
    hookTimeout: UNIT_TEST_TIMEOUT_MS,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: coverage({ include: ['src/**/*.{ts,tsx}'] }),
  },
});
