import {
  PlannerApprovalOffRequestSchema,
  PlannerApprovalRequestSchema,
  PlannerApprovalResponseSchema,
  type PlannerApprovalOffRequest,
  type PlannerApprovalRequest,
  type PlannerApprovalResponse,
} from '@bmi/shared';
import {
  Catch,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Put,
  UseGuards,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  PlannerApprovalInvalidError,
  PlannerApprovalService,
} from '../../core/iam/planner-approval-service.js';
import {
  actorOf,
  CurrentSession,
  RequireCapability,
  SessionGuard,
  type SignedIn,
} from '../auth/auth-http.js';
import { ApiContract, ValidBody } from '../contract.js';

const State = { name: 'PlannerApprovalResponse', schema: PlannerApprovalResponseSchema };

/**
 * REQ-IAM-008, RL-7, TX-20, DEC-118: the Planner approval switch, on Roles and permissions.
 * Only the Access Manager holds iam.planner_approval_switch (DEC-117 locks it for every other role).
 */
@Controller('planner-approval')
@UseGuards(SessionGuard)
@RequireCapability('iam.planner_approval_switch')
export class PlannerApprovalController {
  constructor(@Inject(PlannerApprovalService) private readonly switcher: PlannerApprovalService) {}

  @Get()
  @ApiContract({
    operationId: 'getPlannerApproval',
    summary: 'The Planner approval switch: on or off, the ticked kinds and the end time',
    response: State,
  })
  get(@CurrentSession() session: SignedIn): Promise<PlannerApprovalResponse> {
    return this.switcher.state(actorOf(session));
  }

  @Put()
  @ApiContract({
    operationId: 'setPlannerApproval',
    summary: 'Switch Planner approval on, or change it while on, with a reason (TX-20)',
    body: { name: 'PlannerApprovalRequest', schema: PlannerApprovalRequestSchema },
    response: State,
  })
  set(
    @CurrentSession() session: SignedIn,
    @ValidBody() body: PlannerApprovalRequest,
  ): Promise<PlannerApprovalResponse> {
    return this.switcher.set(actorOf(session), body);
  }

  @Post('switch-off')
  @HttpCode(200)
  @ApiContract({
    operationId: 'switchOffPlannerApproval',
    summary: 'Switch Planner approval off, with a reason',
    body: { name: 'PlannerApprovalOffRequest', schema: PlannerApprovalOffRequestSchema },
    response: State,
  })
  switchOff(
    @CurrentSession() session: SignedIn,
    @ValidBody() body: PlannerApprovalOffRequest,
  ): Promise<PlannerApprovalResponse> {
    return this.switcher.switchOff(actorOf(session), body.reason);
  }
}

/** 400 with one sentence: an end time that already passed. */
@Catch(PlannerApprovalInvalidError)
export class PlannerApprovalErrorFilter implements ExceptionFilter<PlannerApprovalInvalidError> {
  catch(error: PlannerApprovalInvalidError, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.BAD_REQUEST)
      .json({ statusCode: HttpStatus.BAD_REQUEST, message: error.message });
  }
}
