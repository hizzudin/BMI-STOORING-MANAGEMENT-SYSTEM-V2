import {
  SpkDetailResponseSchema,
  SpkFormOptionsResponseSchema,
  SpkListQuerySchema,
  SpkListResponseSchema,
  SpkRequestSchema,
  SpkResponseSchema,
  SpkSubmitRequestSchema,
  SpkUpdateRequestSchema,
  type SpkDetailResponse,
  type SpkFormOptionsResponse,
  type SpkListQuery,
  type SpkListResponse,
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
import { SpkListService } from '../../core/spk/spk-list-service.js';
import { SpkInvalidError, SpkNotFoundError, SpkService } from '../../core/spk/spk-service.js';
import {
  actorOf,
  CurrentSession,
  RequireCapability,
  SessionGuard,
  type SignedIn,
} from '../auth/auth-http.js';
import { ApiContract, ValidBody, ValidQuery } from '../contract.js';

const One = { name: 'SpkResponse', schema: SpkResponseSchema };

/** REQ-SPK-001, REQ-SPK-002, REQ-SPK-010, REQ-SPK-011, REQ-SPK-013, REQ-SPK-015, T1, T2, T5, DEC-126, DEC-127. */
@Controller('spks')
@UseGuards(SessionGuard)
export class SpksController {
  constructor(
    @Inject(SpkService) private readonly spks: SpkService,
    @Inject(SpkListService) private readonly lists: SpkListService,
  ) {}

  @Get()
  @RequireCapability('spk.view')
  @ApiContract({
    operationId: 'listSpks',
    summary: 'SPKList: one page of a tab, with every tab count (DEC-127)',
    query: { name: 'SpkListQuery', schema: SpkListQuerySchema },
    response: { name: 'SpkListResponse', schema: SpkListResponseSchema },
  })
  list(
    @CurrentSession() session: SignedIn,
    @ValidQuery() query: SpkListQuery,
  ): Promise<SpkListResponse> {
    return this.lists.list(actorOf(session), query);
  }

  @Get(':id/detail')
  @RequireCapability('spk.view')
  @ApiContract({
    operationId: 'getSpkDetail',
    summary: 'SPKDetail: steps, approval rows and costs (read only)',
    response: { name: 'SpkDetailResponse', schema: SpkDetailResponseSchema },
  })
  async detail(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SpkDetailResponse> {
    return { detail: await this.lists.detail(actorOf(session), id) };
  }

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
