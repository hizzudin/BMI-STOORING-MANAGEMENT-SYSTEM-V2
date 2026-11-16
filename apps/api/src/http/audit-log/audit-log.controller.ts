import {
  AccessHistoryQuerySchema,
  AccessHistoryResponseSchema,
  AuditLogDetailSchema,
  AuditLogExportQuerySchema,
  AuditLogQuerySchema,
  AuditLogResponseSchema,
  type AccessHistoryQuery,
  type AccessHistoryResponse,
  type AuditLogDetail,
  type AuditLogExportQuery,
  type AuditLogQuery,
  type AuditLogResponse,
} from '@bmi/shared';
import {
  Catch,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  StreamableFile,
  UseGuards,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  AuditExportTooLargeError,
  AuditLogNotFoundError,
  AuditLogService,
} from '../../core/audit/audit-log-service.js';
import {
  actorOf,
  CurrentSession,
  RequireCapability,
  SessionGuard,
  type SignedIn,
} from '../auth/auth-http.js';
import { ApiContract, ApiFileContract, ValidQuery } from '../contract.js';

/**
 * REQ-IAM-007, NFR-02, DEC-74, DEC-131: the Audit log, read only, for whoever holds audit.view
 * (the Access Manager, the System Admin and the GM in 2.2).
 */
@Controller('audit-logs')
@UseGuards(SessionGuard)
@RequireCapability('audit.view')
export class AuditLogController {
  constructor(@Inject(AuditLogService) private readonly audit: AuditLogService) {}

  @Get()
  @ApiContract({
    operationId: 'listAuditLogs',
    summary: 'One page of audit records, newest first, under the User, Area and date filters',
    query: { name: 'AuditLogQuery', schema: AuditLogQuerySchema },
    response: { name: 'AuditLogResponse', schema: AuditLogResponseSchema },
  })
  list(
    @CurrentSession() session: SignedIn,
    @ValidQuery() query: AuditLogQuery,
  ): Promise<AuditLogResponse> {
    return this.audit.list(actorOf(session), query);
  }

  // Declared before :id so that "export" is never read as an id.
  @Get('export')
  @ApiFileContract({
    operationId: 'exportAuditLogs',
    summary: 'The filtered audit records as a CSV or xlsx file, at most 10,000 rows; logged',
    query: { name: 'AuditLogExportQuery', schema: AuditLogExportQuerySchema },
    file: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  })
  async export(
    @CurrentSession() session: SignedIn,
    @ValidQuery() query: AuditLogExportQuery,
  ): Promise<StreamableFile> {
    const file = await this.audit.export(actorOf(session), query);
    return new StreamableFile(file.body, {
      type: file.contentType,
      disposition: `attachment; filename="${file.fileName}"`,
    });
  }

  @Get(':id')
  @ApiContract({
    operationId: 'getAuditLog',
    summary: 'One audit record with its full before, after and reason',
    response: { name: 'AuditLogDetail', schema: AuditLogDetailSchema },
  })
  detail(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AuditLogDetail> {
    return this.audit.detail(actorOf(session), id);
  }
}

/** REQ-IAM-003, FLW-AM-05: Users and roles › Access history, accounts.manage only (RL-4). */
@Controller('access-history')
@UseGuards(SessionGuard)
@RequireCapability('accounts.manage')
export class AccessHistoryController {
  constructor(@Inject(AuditLogService) private readonly audit: AuditLogService) {}

  @Get()
  @ApiContract({
    operationId: 'listAccessHistory',
    summary: 'The access changes, newest first, in words',
    query: { name: 'AccessHistoryQuery', schema: AccessHistoryQuerySchema },
    response: { name: 'AccessHistoryResponse', schema: AccessHistoryResponseSchema },
  })
  list(
    @CurrentSession() session: SignedIn,
    @ValidQuery() query: AccessHistoryQuery,
  ): Promise<AccessHistoryResponse> {
    return this.audit.accessHistory(actorOf(session), query);
  }
}

@Catch(AuditLogNotFoundError, AuditExportTooLargeError)
export class AuditLogErrorFilter implements ExceptionFilter<Error> {
  catch(error: Error, host: ArgumentsHost): void {
    const status =
      error instanceof AuditLogNotFoundError ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
