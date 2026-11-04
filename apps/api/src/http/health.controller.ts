import { HealthResponseSchema, type HealthResponse } from '@bmi/shared';
import { Controller, Get } from '@nestjs/common';
import { ApiContract } from './contract.js';

@Controller('health')
export class HealthController {
  @Get()
  @ApiContract({
    operationId: 'getHealth',
    summary: 'Tells whether the API is running',
    response: { name: 'HealthResponse', schema: HealthResponseSchema },
  })
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
