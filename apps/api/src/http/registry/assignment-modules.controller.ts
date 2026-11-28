import {
  AssignmentModuleListResponseSchema,
  AssignmentModuleSchema,
  ModuleStatusChangeRequestSchema,
  type AssignmentModule,
  type AssignmentModuleListResponse,
  type ModuleStatusChangeRequest,
} from '@bmi/shared';
import {
  Catch,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ModuleNotFoundError,
  ModuleStateConflictError,
  ModuleUnavailableError,
  RegistryService,
} from '../../engine/registry/registry-service.js';
import {
  actorOf,
  CurrentSession,
  RequireCapability,
  SessionGuard,
  type SignedIn,
} from '../auth/auth-http.js';
import { ApiContract, ValidBody } from '../contract.js';
import { hashRequest, IdempotencyKey } from '../idempotency-key.decorator.js';

const One = { name: 'AssignmentModule', schema: AssignmentModuleSchema };
const Reason = { name: 'ModuleStatusChangeRequest', schema: ModuleStatusChangeRequestSchema };

/** TASK-203, REQ-REG-002, REQ-REG-005, DEC-148: the module registry for `registry.manage`. */
@Controller('assignment-modules')
@UseGuards(SessionGuard)
export class AssignmentModulesController {
  constructor(@Inject(RegistryService) private readonly registry: RegistryService) {}

  @Get()
  @RequireCapability('registry.manage')
  @ApiContract({
    operationId: 'listAssignmentModules',
    summary:
      'Every module row with whether it is implemented and offered in Create SPK (REQ-REG-002, DEC-148)',
    response: { name: 'AssignmentModuleListResponse', schema: AssignmentModuleListResponseSchema },
  })
  async list(): Promise<AssignmentModuleListResponse> {
    return { items: await this.registry.list() };
  }

  @Post(':code/deactivate')
  @HttpCode(200)
  @RequireCapability('registry.manage')
  @ApiContract({
    operationId: 'deactivateAssignmentModule',
    summary:
      'Deactivate a module with a reason: no new step may use it, old SPKs stay readable (REQ-REG-005); needs an Idempotency-Key',
    body: Reason,
    response: One,
  })
  deactivate(
    @CurrentSession() session: SignedIn,
    @Param('code') code: string,
    @ValidBody() body: ModuleStatusChangeRequest,
    @IdempotencyKey() key: string,
    @Req() request: Request,
  ): Promise<AssignmentModule> {
    return this.change('deactivate', session, code, body, key, request);
  }

  @Post(':code/activate')
  @HttpCode(200)
  @RequireCapability('registry.manage')
  @ApiContract({
    operationId: 'activateAssignmentModule',
    summary: 'Activate a module again with a reason (REQ-REG-005); needs an Idempotency-Key',
    body: Reason,
    response: One,
  })
  activate(
    @CurrentSession() session: SignedIn,
    @Param('code') code: string,
    @ValidBody() body: ModuleStatusChangeRequest,
    @IdempotencyKey() key: string,
    @Req() request: Request,
  ): Promise<AssignmentModule> {
    return this.change('activate', session, code, body, key, request);
  }

  private async change(
    action: 'deactivate' | 'activate',
    session: SignedIn,
    code: string,
    body: ModuleStatusChangeRequest,
    key: string,
    request: Request,
  ): Promise<AssignmentModule> {
    const outcome = await this.registry[action](actorOf(session), code, body, {
      key,
      requestHash: hashRequest('POST', request.path, body),
    });
    return outcome.body as AssignmentModule;
  }
}

/** 404 and 409 of the registry routes, each with one sentence. */
@Catch(ModuleNotFoundError, ModuleStateConflictError, ModuleUnavailableError)
export class RegistryErrorFilter implements ExceptionFilter<Error> {
  catch(error: Error, host: ArgumentsHost): void {
    const status =
      error instanceof ModuleNotFoundError ? HttpStatus.NOT_FOUND : HttpStatus.CONFLICT;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
