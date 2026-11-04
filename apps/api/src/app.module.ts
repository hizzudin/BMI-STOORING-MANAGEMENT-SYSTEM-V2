import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConcurrentUpdateFilter } from './http/concurrent-update.filter.js';
import { HealthController } from './http/health.controller.js';

@Module({
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ConcurrentUpdateFilter }],
})
export class AppModule {}
