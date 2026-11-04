import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BullMqQueue } from '../../../src/infra/queue/bullmq-queue.js';

const LOCAL_REDIS_URL = 'redis://localhost:6379';

describe('queue adapter', () => {
  let queue: BullMqQueue;

  beforeEach(() => {
    queue = new BullMqQueue(`test-${randomUUID()}`, process.env.REDIS_URL ?? LOCAL_REDIS_URL);
  });

  afterEach(async () => {
    await queue.destroy();
  });

  it('delivers a job with its payload to the processor', async () => {
    const received = new Promise<unknown>((resolve) => {
      queue.process((payload) => {
        resolve(payload);
        return Promise.resolve();
      });
    });
    await queue.enqueue({ documentId: 7 }, { jobId: 'job-1' });
    await expect(received).resolves.toEqual({ documentId: 7 });
  });

  it('NFR-01 enqueues the same job id only once, so a retried request adds no second job', async () => {
    await queue.enqueue({ documentId: 7 }, { jobId: 'job-1' });
    await queue.enqueue({ documentId: 7 }, { jobId: 'job-1' });
    expect(await queue.pendingCount()).toBe(1);
  });
});
