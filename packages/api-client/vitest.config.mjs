import { coverage } from '@bmi/config/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: coverage({ include: ['src/**/*.ts'], exclude: ['src/schema.gen.ts'] }),
  },
});
