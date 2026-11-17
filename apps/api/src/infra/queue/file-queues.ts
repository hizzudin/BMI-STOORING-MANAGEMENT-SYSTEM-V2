import type { OnApplicationShutdown } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import type { FileJobs } from '../../ports/files.js';

export const FILE_PROCESSING_QUEUE = 'file-processing';
export const FILE_CLEANUP_QUEUE = 'file-cleanup';
/** REQ-FUP-013: the first run and up to 3 retries, with growing waits. */
const ATTEMPTS = 4;
const FIRST_RETRY_MS = 5_000;
const CLEANUP_EVERY_MS = 60 * 60 * 1000;
const ENQUEUE_TIMEOUT_MS = 3_000;

/** BullMQ workers block on Redis, which needs unlimited retries per request. */
const workerConnection = (url: string) => ({ url, maxRetriesPerRequest: null });

async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Redis did not answer within ${ENQUEUE_TIMEOUT_MS} ms`)),
      ENQUEUE_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** REQ-FUP-005: one job per file (the job id is the file id). Connects on first use. */
export class FileProcessingQueue implements FileJobs, OnApplicationShutdown {
  private queue: Queue | undefined;
  private worker: Worker | undefined;

  constructor(private readonly redisUrl: string) {}

  async enqueueProcessing(fileId: number): Promise<void> {
    this.queue ??= new Queue(FILE_PROCESSING_QUEUE, { connection: { url: this.redisUrl } });
    await withTimeout(
      this.queue.add(
        FILE_PROCESSING_QUEUE,
        { fileId },
        {
          jobId: `file-${fileId}`,
          attempts: ATTEMPTS,
          backoff: { type: 'exponential', delay: FIRST_RETRY_MS },
          removeOnComplete: true,
        },
      ),
    );
  }

  /** Worker only. */
  process(handler: (fileId: number, lastAttempt: boolean) => Promise<void>): void {
    this.worker = new Worker<{ fileId: number }>(
      FILE_PROCESSING_QUEUE,
      (job) => handler(job.data.fileId, job.attemptsMade + 1 >= ATTEMPTS),
      { connection: workerConnection(this.redisUrl) },
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}

/** REQ-FUP-009: the cleanup runs every hour, so a file goes within 25 hours. Worker only. */
export class FileCleanupQueue implements OnApplicationShutdown {
  private queue: Queue | undefined;
  private worker: Worker | undefined;

  constructor(private readonly redisUrl: string) {}

  async start(run: () => Promise<unknown>): Promise<void> {
    this.queue = new Queue(FILE_CLEANUP_QUEUE, { connection: { url: this.redisUrl } });
    await this.queue.upsertJobScheduler('hourly', { every: CLEANUP_EVERY_MS });
    this.worker = new Worker(FILE_CLEANUP_QUEUE, () => run(), {
      connection: workerConnection(this.redisUrl),
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
