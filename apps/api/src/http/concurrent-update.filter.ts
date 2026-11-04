import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { ConcurrentUpdateError } from '../ports/errors.js';

@Catch(ConcurrentUpdateError)
export class ConcurrentUpdateFilter implements ExceptionFilter<ConcurrentUpdateError> {
  catch(error: ConcurrentUpdateError, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.CONFLICT)
      .json({ statusCode: HttpStatus.CONFLICT, message: error.message });
  }
}
