import {
  SpkFormOptionsResponseSchema,
  SpkRequestSchema,
  SpkResponseSchema,
  SpkSubmitRequestSchema,
  SpkUpdateRequestSchema,
  type SpkFormOptionsResponse,
  type SpkRequest,
  type SpkResponse,
  type SpkSubmitRequest,
  type SpkUpdateRequest,
} from '@bmi/shared';
import {
  Catch,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { SpkInvalidError, SpkNotFoundError, SpkService } from '../../core/spk/spk-service.js';
import {
  actorOf,
  CurrentSession,
  RequireCapability,
  SessionGuard,
  type SignedIn,
} from '../auth/auth-http.js';
import { ApiContract, ValidBody } from '../contract.js';

const One = { name: 'SpkResponse', schema: SpkResponseSchema };

/** REQ-SPK-001, REQ-SPK-002, REQ-SPK-013, REQ-SPK-015, T1, T2, T5, DEC-126: Create SPK. */
@Controller('spks')
@UseGuards(SessionGuard)
export class SpksController {
  constructor(@Inject(SpkService) private readonly spks: SpkService) {}

  @Get('options')
  @RequireCapability('spk.create')
  @ApiContract({
    operationId: 'spkFormOptions',
    summary: 'The vehicles Create SPK offers (never an Inactive one)',
    response: { name: 'SpkFormOptionsResponse', schema: SpkFormOptionsResponseSchema },
  })
  options(@CurrentSession() session: SignedIn): Promise<SpkFormOptionsResponse> {
    return this.spks.options(actorOf(session));
  }

  @Post()
  @RequireCapability('spk.create')
  @ApiContract({
    operationId: 'createSpk',
    summary: 'Save a new SPK as Draft (T1)',
    body: { name: 'SpkRequest', schema: SpkRequestSchema },
    response: One,
  })
  async create(
    @CurrentSession() session: SignedIn,
    @ValidBody() body: SpkRequest,
  ): Promise<SpkResponse> {
    return { spk: await this.spks.create(actorOf(session), body) };
  }

  @Get(':id')
  @RequireCapability('spk.view', 'spk.create')
  @ApiContract({ operationId: 'getSpk', summary: 'One SPK', response: One })
  async get(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SpkResponse> {
    return { spk: await this.spks.get(actorOf(session), id) };
  }

  @Patch(':id')
  @RequireCapability('spk.create')
  @ApiContract({
    operationId: 'updateSpk',
    summary: 'Save draft (C-15)',
    body: { name: 'SpkUpdateRequest', schema: SpkUpdateRequestSchema },
    response: One,
  })
  async update(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
    @ValidBody() body: SpkUpdateRequest,
  ): Promise<SpkResponse> {
    return { spk: await this.spks.update(actorOf(session), id, body) };
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequireCapability('spk.create')
  @ApiContract({
    operationId: 'submitSpk',
    summary: 'Submit for approval (T2, T5)',
    body: { name: 'SpkSubmitRequest', schema: SpkSubmitRequestSchema },
    response: One,
  })
  async submit(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
    @ValidBody() body: SpkSubmitRequest,
  ): Promise<SpkResponse> {
    return { spk: await this.spks.submit(actorOf(session), id, body) };
  }
}

/** 400 and 404 of the SPK routes, each with one sentence. */
@Catch(SpkNotFoundError, SpkInvalidError)
export class SpkErrorFilter implements ExceptionFilter<Error> {
  catch(error: Error, host: ArgumentsHost): void {
    const status =
      error instanceof SpkNotFoundError ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
