import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiContract, ValidQuery } from '../contract.js';
import { RequireCapability, SessionGuard, CurrentSession, type SignedIn, actorOf } from '../auth/auth-http.js';
import { SpkListService } from '../../core/spk/spk-list-service.js';
import type { SpkListQuery, SpkListResponse } from '@bmi/shared';
import { SpkListQuerySchema, SpkListResponseSchema } from '@bmi/shared';

/** REQ-SPK-010: SPK List with tabs, filters, pagination. */
@Controller('spks')
@UseGuards(SessionGuard)
export class SpkListController {
  constructor(private readonly list: SpkListService) {}

  @Get()
  @RequireCapability('spk.view')
  @ApiContract({
    operationId: 'listSpks',
    summary: 'List SPKs with tabs, filters, pagination',
    query: { name: 'SpkListQuery', schema: SpkListQuerySchema },
    response: { name: 'SpkListResponse', schema: SpkListResponseSchema },
  })
  async listSpks(
    @CurrentSession() session: SignedIn,
    @ValidQuery(SpkListQuerySchema) query: SpkListQuery,
  ): Promise<SpkListResponse> {
    return this.list.list(actorOf(session), query);
  }
}

/** 400 and 404 of the SPK routes, each with one sentence. */
import { Catch, ArgumentsHost, HttpStatus, ExceptionFilter } from '@nestjs/common';
import { SpkNotFoundError, SpkInvalidError } from '../../core/spk/spk-service.js';

@Catch(SpkNotFoundError, SpkInvalidError)
export class SpkErrorFilter implements ExceptionFilter<Error> {
  catch(error: Error, host: ArgumentsHost): void {
    const status =
      error instanceof SpkNotFoundError ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
    host
      .switchToHttp()
      .getResponse()
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}