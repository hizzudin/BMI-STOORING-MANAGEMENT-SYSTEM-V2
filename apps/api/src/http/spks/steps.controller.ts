import {
  StepSubmitRequestSchema,
  StepSubmitResponseSchema,
  type StepSubmitRequest,
  type StepSubmitResponse,
} from '@bmi/shared';
import {
  Catch,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  StepConflictError,
  StepInvalidError,
  StepNotFoundError,
  StepService,
} from '../../engine/step-service.js';
import {
  actorOf,
  CurrentSession,
  SessionGuard,
  type SignedIn,
} from '../auth/auth-http.js';
import { ApiContract, ValidBody } from '../contract.js';
import { hashRequest, IdempotencyKey } from '../idempotency-key.decorator.js';
import { ModuleExecuteGuard } from './module-execute.guard.js';

/**
 * DEC-145: the engine's one step route. Its guard asks for an execute capability of a registered
 * module (DEC-149); the capability of the step's own module and the executor check are the step policy.
 */
@Controller('spks/:id/steps')
@UseGuards(SessionGuard)
export class StepsController {
  constructor(@Inject(StepService) private readonly steps: StepService) {}

  @Post(':stepId/submit')
  @HttpCode(200)
  @UseGuards(ModuleExecuteGuard)
  @ApiContract({
    operationId: 'submitStep',
    summary:
      'Submit a step: it becomes Submitted, the next step opens, the SPK moves T7 and T11 (REQ-ENG-002, DEC-145); needs an Idempotency-Key',
    body: { name: 'StepSubmitRequest', schema: StepSubmitRequestSchema },
    response: { name: 'StepSubmitResponse', schema: StepSubmitResponseSchema },
  })
  async submit(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
    @Param('stepId', ParseIntPipe) stepId: number,
    @ValidBody() body: StepSubmitRequest,
    @IdempotencyKey() key: string,
    @Req() request: Request,
  ): Promise<StepSubmitResponse> {
    const outcome = await this.steps.submit(actorOf(session), id, stepId, body, {
      key,
      requestHash: hashRequest('POST', request.path, body),
    });
    return outcome.body as StepSubmitResponse;
  }
}

/** 400, 404 and 409 of the step routes, each with one sentence. */
@Catch(StepNotFoundError, StepConflictError, StepInvalidError)
export class StepErrorFilter implements ExceptionFilter<Error> {
  catch(error: Error, host: ArgumentsHost): void {
    const status =
      error instanceof StepNotFoundError
        ? HttpStatus.NOT_FOUND
        : error instanceof StepConflictError
          ? HttpStatus.CONFLICT
          : HttpStatus.BAD_REQUEST;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
