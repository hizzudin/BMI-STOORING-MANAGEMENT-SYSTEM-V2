import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { ConcurrentUpdateError } from '../ports/errors.js';
import { IdempotencyKeyReusedError } from '../ports/idempotency.js';

@Catch(ConcurrentUpdateError, IdempotencyKeyReusedError)
export class ConcurrentUpdateFilter implements ExceptionFilter<Error> {
  catch(error: Error, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.CONFLICT)
      .json({ statusCode: HttpStatus.CONFLICT, message: error.message });
  }
}
