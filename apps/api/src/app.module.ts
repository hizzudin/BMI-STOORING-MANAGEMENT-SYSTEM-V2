import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConcurrentUpdateFilter } from './http/concurrent-update.filter.js';
import { ContractInterceptor } from './http/contract.interceptor.js';
import { HealthController } from './http/health.controller.js';

@Module({
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: ConcurrentUpdateFilter },
    { provide: APP_INTERCEPTOR, useClass: ContractInterceptor },
  ],
})
export class AppModule {}
