import {
  SystemModeResponseSchema,
  SystemModeSwitchRequestSchema,
  type SystemModeResponse,
  type SystemModeSwitchRequest,
} from '@bmi/shared';
import {
  Catch,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SystemModeError, SystemModeService } from '../../core/iam/system-mode-service.js';
import {
  actorOf,
  CurrentSession,
  RequireCapability,
  SessionGuard,
  type SignedIn,
} from '../auth/auth-http.js';
import { ApiContract, ValidBody } from '../contract.js';
import { hashRequest, IdempotencyKey } from '../idempotency-key.decorator.js';

const Status = { name: 'SystemModeResponse', schema: SystemModeResponseSchema };
const Switch = { name: 'SystemModeSwitchRequest', schema: SystemModeSwitchRequestSchema };

/** REQ-IAM-010, DEC-132: Setup and go live, setup.golive only (the System Admin, 2.2). */
@Controller('system-mode')
@UseGuards(SessionGuard)
@RequireCapability('setup.golive')
export class SystemModeController {
  constructor(@Inject(SystemModeService) private readonly modes: SystemModeService) {}

  @Get()
  @ApiContract({
    operationId: 'getSystemMode',
    summary: 'The mode, the latest Go live, the checklist counts and the allowed switch',
    response: Status,
  })
  status(@CurrentSession() session: SignedIn): Promise<SystemModeResponse> {
    return this.modes.status(actorOf(session));
  }

  @Post('go-live')
  @HttpCode(200)
  @ApiContract({
    operationId: 'goLive',
    summary: 'Setup → Live with a reason and GO LIVE typed; needs an Idempotency-Key',
    body: Switch,
    response: Status,
  })
  async goLive(
    @CurrentSession() session: SignedIn,
    @ValidBody() body: SystemModeSwitchRequest,
    @IdempotencyKey() key: string,
    @Req() request: Request,
  ): Promise<SystemModeResponse> {
    const outcome = await this.modes.goLive(actorOf(session), body, {
      key,
      requestHash: hashRequest('POST', request.path, body),
    });
    return outcome.body as SystemModeResponse;
  }

  @Post('back-to-setup')
  @HttpCode(200)
  @ApiContract({
    operationId: 'backToSetup',
    summary: 'Live → Setup with a reason and BACK TO SETUP typed; ends the other sessions',
    body: Switch,
    response: Status,
  })
  async backToSetup(
    @CurrentSession() session: SignedIn,
    @ValidBody() body: SystemModeSwitchRequest,
    @IdempotencyKey() key: string,
    @Req() request: Request,
  ): Promise<SystemModeResponse> {
    const outcome = await this.modes.backToSetup(actorOf(session), body, {
      key,
      requestHash: hashRequest('POST', request.path, body),
    });
    return outcome.body as SystemModeResponse;
  }
}

@Catch(SystemModeError)
export class SystemModeErrorFilter implements ExceptionFilter<SystemModeError> {
  catch(error: SystemModeError, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.BAD_REQUEST)
      .json({ statusCode: HttpStatus.BAD_REQUEST, message: error.message });
  }
}
