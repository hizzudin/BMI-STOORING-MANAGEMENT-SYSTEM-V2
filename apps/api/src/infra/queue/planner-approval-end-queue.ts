import { Logger, type OnApplicationShutdown } from '@nestjs/common';
import type { PlannerApprovalEndScheduler } from '../../ports/planner-approval.js';
import { BullMqQueue } from './bullmq-queue.js';

export const PLANNER_APPROVAL_END_QUEUE = 'planner-approval-end';
const SCHEDULE_TIMEOUT_MS = 3_000;

/**
 * DEC-118: one delayed job per end time (the job id is the end time, so a retried save adds no
 * second job). The queue connects on first use, so a process that never schedules never opens Redis.
 */
export class PlannerApprovalEndQueue implements PlannerApprovalEndScheduler, OnApplicationShutdown {
  private queue: BullMqQueue | undefined;
  private readonly logger = new Logger(PlannerApprovalEndQueue.name);

  constructor(
    private readonly redisUrl: string,
    private readonly now: () => Date,
  ) {}

  async scheduleEnd(until: Date): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const enqueued = this.connect().enqueue(
        {},
        {
          jobId: `end-${until.getTime()}`,
          delayMs: Math.max(0, until.getTime() - this.now().getTime()),
        },
      );
      // An unreachable Redis would hold the add (and the Access Manager's save) indefinitely.
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Redis did not answer within ${SCHEDULE_TIMEOUT_MS} ms`)),
          SCHEDULE_TIMEOUT_MS,
        );
      });
      await Promise.race([enqueued, timeout]);
    } catch (error) {
      // The switch is saved: capabilities stop at the end time on their own, and the switch page
      // writes the end record when it is opened. Only the timely audit record waits for that.
      this.logger.error(
        `Could not schedule the Planner approval end at ${until.toISOString()}`,
        error,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /** Worker only: runs `end` for every job. */
  process(end: () => Promise<void>): void {
    this.connect().process(() => end());
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue?.close();
  }

  private connect(): BullMqQueue {
    this.queue ??= new BullMqQueue(PLANNER_APPROVAL_END_QUEUE, this.redisUrl);
    return this.queue;
  }
}
