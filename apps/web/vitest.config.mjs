import { UNIT_TEST_TIMEOUT_MS, coverage } from '@bmi/config/vitest';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    testTimeout: UNIT_TEST_TIMEOUT_MS,
    hookTimeout: UNIT_TEST_TIMEOUT_MS,
    include: ['app/**/*.test.tsx', 'components/**/*.test.tsx', 'lib/**/*.test.{ts,tsx}'],
    // layout.tsx renders <html>, which only a real browser can host: the E2E layer covers it.
    coverage: coverage({
      include: ['app/**/*.tsx', 'components/**/*.tsx', 'lib/**/*.{ts,tsx}'],
      exclude: ['app/layout.tsx'],
    }),
  },
});
