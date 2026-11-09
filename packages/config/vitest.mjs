// Coverage gates of design.md D-09: 80 % global, 90 % for the critical tier (PRD §8.4).
const percent = (value) => ({ lines: value, functions: value, branches: value, statements: value });

// A slow disk can take seconds to load a test the first time; 30 s keeps that from reading as a failure.
export const UNIT_TEST_TIMEOUT_MS = 30_000;

export const GLOBAL_THRESHOLD = percent(80);
export const CRITICAL_THRESHOLD = percent(90);

export function coverage({ include, exclude = [], thresholds = GLOBAL_THRESHOLD }) {
  return {
    provider: 'v8',
    include,
    exclude: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', ...exclude],
    reporter: ['text-summary', 'lcov'],
    thresholds,
  };
}
