import { describe, expect, it } from 'vitest';
import { assertWorkerDatabaseIsolated } from './isolation-checks.js';

describe('D-02 test database per worker (file A)', () => {
  assertWorkerDatabaseIsolated(it, expect, 'file-a');
});
