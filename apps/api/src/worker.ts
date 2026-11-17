import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { FILE_JOBS, PLANNER_APPROVAL_END } from './app.tokens.js';
import { FileCleanup, FileProcessor } from './core/files/file-jobs.js';
import { StorageUsageCheck } from './core/files/storage-usage.js';
import { PlannerApprovalService } from './core/iam/planner-approval-service.js';
import {
  FileCleanupQueue,
  StorageUsageQueue,
  type FileProcessingQueue,
} from './infra/queue/file-queues.js';
import type { PlannerApprovalEndQueue } from './infra/queue/planner-approval-end-queue.js';

// The second entry point of design.md §1: the BullMQ processors register here.
const worker = await NestFactory.createApplicationContext(AppModule);
worker.enableShutdownHooks();

// DEC-118: the Planner approval switch ends at its end time with one audit record.
const plannerApproval = worker.get(PlannerApprovalService);
worker.get<PlannerApprovalEndQueue>(PLANNER_APPROVAL_END).process(() => plannerApproval.endIfDue());

// REQ-FUP-005, REQ-FUP-013: each uploaded file is checked, with up to 3 retries.
const fileProcessor = worker.get(FileProcessor);
worker
  .get<FileProcessingQueue>(FILE_JOBS)
  .process((fileId, lastAttempt) => fileProcessor.process(fileId, lastAttempt));

// REQ-FUP-009: every hour, files never attached for 24 hours are removed.
const fileCleanup = worker.get(FileCleanup);
await worker.get(FileCleanupQueue).start(() => fileCleanup.run());

// NFR-13, DEC-137: at 00:30 WIB the storage use is read; every run is logged (NFR-12).
const storageUsage = worker.get(StorageUsageCheck);
const usageLog = new Logger('StorageUsage');
await worker.get(StorageUsageQueue).start(async () => {
  const result = await storageUsage.run();
  usageLog.log(
    `used ${result.usedBytes} bytes, ${result.pct}% of ${result.budgetGb} GB, ` +
      `step ${result.step ?? 'none'}, notified ${result.notified}`,
  );
});

process.on('SIGTERM', () => void worker.close());
