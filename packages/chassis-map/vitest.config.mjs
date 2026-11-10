import { UNIT_TEST_TIMEOUT_MS, coverage } from '@bmi/config/vitest';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    testTimeout: UNIT_TEST_TIMEOUT_MS,
    hookTimeout: UNIT_TEST_TIMEOUT_MS,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: coverage({ include: ['src/**/*.{ts,tsx}'], exclude: ['src/test-support/**'] }),
  },
});
