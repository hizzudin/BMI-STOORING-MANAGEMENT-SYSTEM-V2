import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { PLANNER_APPROVAL_END } from './app.tokens.js';
import { PlannerApprovalService } from './core/iam/planner-approval-service.js';
import type { PlannerApprovalEndQueue } from './infra/queue/planner-approval-end-queue.js';

// The second entry point of design.md §1: the BullMQ processors register here.
const worker = await NestFactory.createApplicationContext(AppModule);
worker.enableShutdownHooks();

// DEC-118: the Planner approval switch ends at its end time with one audit record.
const plannerApproval = worker.get(PlannerApprovalService);
worker.get<PlannerApprovalEndQueue>(PLANNER_APPROVAL_END).process(() => plannerApproval.endIfDue());

process.on('SIGTERM', () => void worker.close());
