import { defineConfig } from 'vitest/config';

// TASK-127: plain TypeScript modules of the app (no React Native renderer), in Node.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/**/*.ts'], exclude: ['src/**/*.test.ts'] },
  },
});
