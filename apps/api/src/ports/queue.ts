export interface EnqueueOptions {
  /** The same id enqueues only once, so a retried request adds no second job. */
  jobId: string;
  /** Runs the job this many milliseconds from now (DEC-118 end time). */
  delayMs?: number;
}

export interface QueuePort<Payload> {
  enqueue(payload: Payload, options: EnqueueOptions): Promise<void>;
  process(handler: (payload: Payload) => Promise<void>): void;
}
