import {
  ApprovalCountResponseSchema,
  ApprovalDecisionRequestSchema,
  ApprovalHistoryQuerySchema,
  ApprovalHistoryResponseSchema,
  ApprovalInboxQuerySchema,
  ApprovalInboxResponseSchema,
  ApprovalReviewResponseSchema,
  type ApprovalCountResponse,
  type ApprovalDecisionRequest,
  type ApprovalHistoryQuery,
  type ApprovalHistoryResponse,
  type ApprovalInboxQuery,
  type ApprovalInboxResponse,
  type ApprovalReviewResponse,
} from '@bmi/shared';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApprovalService } from '../../core/approvals/approval-service.js';
import {
  actorOf,
  CurrentSession,
  RequireCapability,
  SessionGuard,
  type SignedIn,
} from '../auth/auth-http.js';
import { ApiContract, ValidBody, ValidQuery } from '../contract.js';
import { hashRequest, IdempotencyKey } from '../idempotency-key.decorator.js';

const Review = { name: 'ApprovalReviewResponse', schema: ApprovalReviewResponseSchema };
const Decision = { name: 'ApprovalDecisionRequest', schema: ApprovalDecisionRequestSchema };

/** REQ-SPK-005 to REQ-SPK-007, REQ-APR-001 to REQ-APR-007, T3, T4, C-24, C-25, DEC-128. */
@Controller('approvals')
@UseGuards(SessionGuard)
export class ApprovalsController {
  constructor(@Inject(ApprovalService) private readonly approvals: ApprovalService) {}

  @Get('count')
  @RequireCapability('spk.approve', 'count.approve')
  @ApiContract({
    operationId: 'countApprovals',
    summary: 'The count beside the Approvals menu item (REQ-APR-001)',
    response: { name: 'ApprovalCountResponse', schema: ApprovalCountResponseSchema },
  })
  count(@CurrentSession() session: SignedIn): Promise<ApprovalCountResponse> {
    return this.approvals.count(actorOf(session));
  }

  @Get('history')
  @RequireCapability('spk.approve', 'count.approve')
  @ApiContract({
    operationId: 'listApprovalHistory',
    summary: 'History: every Approver’s past decisions, newest first (DEC-128)',
    query: { name: 'ApprovalHistoryQuery', schema: ApprovalHistoryQuerySchema },
    response: { name: 'ApprovalHistoryResponse', schema: ApprovalHistoryResponseSchema },
  })
  history(
    @CurrentSession() session: SignedIn,
    @ValidQuery() query: ApprovalHistoryQuery,
  ): Promise<ApprovalHistoryResponse> {
    return this.approvals.history(actorOf(session), query);
  }

  @Get('spk')
  @RequireCapability('spk.approve')
  @ApiContract({
    operationId: 'listSpkApprovals',
    summary: 'The Surat Perintah Kerja tab: SPKs waiting for a decision (REQ-APR-002)',
    query: { name: 'ApprovalInboxQuery', schema: ApprovalInboxQuerySchema },
    response: { name: 'ApprovalInboxResponse', schema: ApprovalInboxResponseSchema },
  })
  inbox(
    @CurrentSession() session: SignedIn,
    @ValidQuery() query: ApprovalInboxQuery,
  ): Promise<ApprovalInboxResponse> {
    return this.approvals.inbox(actorOf(session), query);
  }

  @Get('spk/:id')
  @RequireCapability('spk.approve')
  @ApiContract({ operationId: 'getSpkApproval', summary: 'ApprovalReview', response: Review })
  review(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApprovalReviewResponse> {
    return this.approvals.review(actorOf(session), id);
  }

  @Post('spk/:id/approve')
  @HttpCode(200)
  @RequireCapability('spk.approve')
  @ApiContract({
    operationId: 'approveSpk',
    summary: 'Approve SPK creation (T3, C-24); needs an Idempotency-Key',
    body: Decision,
    response: Review,
  })
  async approve(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
    @ValidBody() body: ApprovalDecisionRequest,
    @IdempotencyKey() key: string,
    @Req() request: Request,
  ): Promise<ApprovalReviewResponse> {
    const outcome = await this.approvals.approve(actorOf(session), id, body, {
      key,
      requestHash: hashRequest('POST', request.path, body),
    });
    return outcome.body as ApprovalReviewResponse;
  }

  @Post('spk/:id/reject')
  @HttpCode(200)
  @RequireCapability('spk.approve')
  @ApiContract({
    operationId: 'rejectSpk',
    summary: 'Reject SPK creation with a reason (T4, C-25); needs an Idempotency-Key',
    body: Decision,
    response: Review,
  })
  async reject(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
    @ValidBody() body: ApprovalDecisionRequest,
    @IdempotencyKey() key: string,
    @Req() request: Request,
  ): Promise<ApprovalReviewResponse> {
    const outcome = await this.approvals.reject(actorOf(session), id, body, {
      key,
      requestHash: hashRequest('POST', request.path, body),
    });
    return outcome.body as ApprovalReviewResponse;
  }
}
