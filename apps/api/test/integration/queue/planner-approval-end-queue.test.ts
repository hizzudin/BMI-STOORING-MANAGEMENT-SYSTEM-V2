import { afterEach, describe, expect, it } from 'vitest';
import { BullMqQueue } from '../../../src/infra/queue/bullmq-queue.js';
import {
  PLANNER_APPROVAL_END_QUEUE,
  PlannerApprovalEndQueue,
} from '../../../src/infra/queue/planner-approval-end-queue.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const NOW = new Date('2026-11-11T01:00:00.000Z');

describe('DEC-118 the Planner approval end job', () => {
  const schedulers: PlannerApprovalEndQueue[] = [];
  const scheduler = (url = REDIS_URL) => {
    const made = new PlannerApprovalEndQueue(url, () => NOW);
    schedulers.push(made);
    return made;
  };

  afterEach(async () => {
    for (const made of schedulers.splice(0)) await made.onApplicationShutdown();
    await new BullMqQueue(PLANNER_APPROVAL_END_QUEUE, REDIS_URL).destroy();
  });

  it('schedules one delayed job per end time, so a retried save adds no second job', async () => {
    const until = new Date('2026-11-11T11:00:00.000Z');
    const queue = scheduler();
    await queue.scheduleEnd(until);
    await queue.scheduleEnd(until);
    const inspect = new BullMqQueue(PLANNER_APPROVAL_END_QUEUE, REDIS_URL);
    expect(await inspect.pendingCount()).toBe(1);
    await inspect.close();
  });

  it('runs the end when its job is due', async () => {
    const queue = scheduler();
    const ran = new Promise<string>((resolve) => {
      queue.process(() => {
        resolve('ended');
        return Promise.resolve();
      });
    });
    await queue.scheduleEnd(NOW);
    await expect(ran).resolves.toBe('ended');
  });

  it('an unreachable Redis does not hold the save: it gives up within the timeout', async () => {
    const started = Date.now();
    await scheduler('redis://127.0.0.1:1').scheduleEnd(new Date('2026-11-11T11:00:00.000Z'));
    expect(Date.now() - started).toBeLessThan(5_000);
  }, 10_000);
});
