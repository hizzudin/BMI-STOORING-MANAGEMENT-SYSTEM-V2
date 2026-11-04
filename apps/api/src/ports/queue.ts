export interface EnqueueOptions {
  /** The same id enqueues only once, so a retried request adds no second job. */
  jobId: string;
}

export interface QueuePort<Payload> {
  enqueue(payload: Payload, options: EnqueueOptions): Promise<void>;
  process(handler: (payload: Payload) => Promise<void>): void;
}
