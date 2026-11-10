import {
  DocumentTypeListResponseSchema,
  DocumentTypeRequestSchema,
  DocumentTypeResponseSchema,
  DocumentTypeUpdateRequestSchema,
  OkResponseSchema,
  type DocumentTypeListResponse,
  type DocumentTypeRequest,
  type DocumentTypeResponse,
  type DocumentTypeUpdateRequest,
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
import type { z } from 'zod';
import {
  DocumentTypeConflictError,
  DocumentTypeInvalidError,
  DocumentTypeNotFoundError,
  DocumentTypeService,
} from '../../core/fleet/document-type-service.js';
import {
  actorOf,
  CurrentSession,
  RequireCapability,
  SessionGuard,
  type SignedIn,
} from '../auth/auth-http.js';
import { ApiContract, ValidBody } from '../contract.js';

const One = { name: 'DocumentTypeResponse', schema: DocumentTypeResponseSchema };

/** REQ-DOC-001, REQ-DOC-002, DEC-121: Settings › Document types (masterdata.manage). */
@Controller('document-types')
@UseGuards(SessionGuard)
@RequireCapability('masterdata.manage')
export class DocumentTypesController {
  constructor(@Inject(DocumentTypeService) private readonly types: DocumentTypeService) {}

  @Get()
  @ApiContract({
    operationId: 'listDocumentTypes',
    summary: 'Active document types with their required classes',
    response: { name: 'DocumentTypeListResponse', schema: DocumentTypeListResponseSchema },
  })
  list(@CurrentSession() session: SignedIn): Promise<DocumentTypeListResponse> {
    return this.types.list(actorOf(session));
  }

  @Post()
  @ApiContract({
    operationId: 'createDocumentType',
    summary: 'New document type (C-31)',
    body: { name: 'DocumentTypeRequest', schema: DocumentTypeRequestSchema },
    response: One,
  })
  async create(
    @CurrentSession() session: SignedIn,
    @ValidBody() body: DocumentTypeRequest,
  ): Promise<DocumentTypeResponse> {
    return { documentType: await this.types.create(actorOf(session), body) };
  }

  @Patch(':id')
  @ApiContract({
    operationId: 'updateDocumentType',
    summary: 'Save a document type: fields and required classes (C-17)',
    body: { name: 'DocumentTypeUpdateRequest', schema: DocumentTypeUpdateRequestSchema },
    response: One,
  })
  async update(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
    @ValidBody() body: DocumentTypeUpdateRequest,
  ): Promise<DocumentTypeResponse> {
    return { documentType: await this.types.update(actorOf(session), id, body) };
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @ApiContract({
    operationId: 'deactivateDocumentType',
    summary: 'Deactivate a document type (C-32)',
    response: { name: 'OkResponse', schema: OkResponseSchema },
  })
  async deactivate(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<z.infer<typeof OkResponseSchema>> {
    await this.types.deactivate(actorOf(session), id);
    return { ok: true };
  }
}

/** 400, 404 and 409 of the document type routes, each with one sentence. */
@Catch(DocumentTypeNotFoundError, DocumentTypeConflictError, DocumentTypeInvalidError)
export class DocumentTypeErrorFilter implements ExceptionFilter<Error> {
  catch(error: Error, host: ArgumentsHost): void {
    const status =
      error instanceof DocumentTypeNotFoundError
        ? HttpStatus.NOT_FOUND
        : error instanceof DocumentTypeConflictError
          ? HttpStatus.CONFLICT
          : HttpStatus.BAD_REQUEST;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
