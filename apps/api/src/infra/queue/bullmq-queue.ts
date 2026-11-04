import { Queue, Worker } from 'bullmq';
import type { EnqueueOptions, QueuePort } from '../../ports/queue.js';

type Payload = Record<string, unknown>;

export class BullMqQueue implements QueuePort<Payload> {
  private readonly queue: Queue;
  private worker: Worker | undefined;

  constructor(
    private readonly name: string,
    private readonly redisUrl: string,
  ) {
    this.queue = new Queue(name, { connection: { url: redisUrl } });
  }

  async enqueue(payload: Payload, { jobId }: EnqueueOptions): Promise<void> {
    await this.queue.add(this.name, payload, { jobId });
  }

  process(handler: (payload: Payload) => Promise<void>): void {
    this.worker = new Worker<Payload>(this.name, (job) => handler(job.data), {
      // BullMQ workers block on Redis, which needs unlimited retries per request.
      connection: { url: this.redisUrl, maxRetriesPerRequest: null },
    });
  }

  pendingCount(): Promise<number> {
    return this.queue.getJobCountByTypes('waiting', 'delayed', 'active');
  }

  /** Removes the queue and its jobs: for tests and for a queue that is retired. */
  async destroy(): Promise<void> {
    await this.worker?.close();
    await this.queue.obliterate({ force: true });
    await this.queue.close();
  }
}
