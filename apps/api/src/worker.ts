import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

// The second entry point of design.md §1: BullMQ processors register here from TASK-114 on.
const worker = await NestFactory.createApplicationContext(AppModule);
process.on('SIGTERM', () => void worker.close());
