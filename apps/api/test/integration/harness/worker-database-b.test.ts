import { describe, expect, it } from 'vitest';
import { assertWorkerDatabaseIsolated } from './isolation-checks.js';

describe('D-02 test database per worker (file B)', () => {
  assertWorkerDatabaseIsolated(it, expect, 'file-b');
});
