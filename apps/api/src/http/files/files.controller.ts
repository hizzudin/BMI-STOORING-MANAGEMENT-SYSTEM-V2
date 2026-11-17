import {
  StoredFileResponseSchema,
  UploadLinkRequestSchema,
  UploadLinkResponseSchema,
  type StoredFileResponse,
  type UploadLinkRequest,
  type UploadLinkResponse,
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
  Post,
  Req,
  UseGuards,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileNotFoundError, FileRefusedError, FileService } from '../../core/files/file-service.js';
import {
  actorOf,
  CurrentSession,
  RequireCapability,
  SessionGuard,
  type SignedIn,
} from '../auth/auth-http.js';
import { ApiContract, ValidBody } from '../contract.js';
import { hashRequest, IdempotencyKey } from '../idempotency-key.decorator.js';

const One = { name: 'StoredFileResponse', schema: StoredFileResponseSchema };

/** 8.1 steps 4, 6 and 8 (REQ-FUP-004, REQ-FUP-005): files.upload only (DEC-115, DEC-136). */
@Controller('files')
@UseGuards(SessionGuard)
@RequireCapability('files.upload')
export class FilesController {
  constructor(@Inject(FileService) private readonly files: FileService) {}

  @Post('upload-links')
  @ApiContract({
    operationId: 'requestUploadLink',
    summary: 'A Pending file and a signed upload link for one profile; needs an Idempotency-Key',
    body: { name: 'UploadLinkRequest', schema: UploadLinkRequestSchema },
    response: { name: 'UploadLinkResponse', schema: UploadLinkResponseSchema },
  })
  async requestUpload(
    @CurrentSession() session: SignedIn,
    @ValidBody() body: UploadLinkRequest,
    @IdempotencyKey() key: string,
    @Req() request: Request,
  ): Promise<UploadLinkResponse> {
    const outcome = await this.files.requestUpload(actorOf(session), body, {
      key,
      requestHash: hashRequest('POST', request.path, body),
    });
    return outcome.body as UploadLinkResponse;
  }

  @Post(':id/uploaded')
  @HttpCode(200)
  @ApiContract({
    operationId: 'markFileUploaded',
    summary: 'The bytes are in storage: the worker checks them; needs an Idempotency-Key',
    response: One,
  })
  async uploaded(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
    @IdempotencyKey() key: string,
    @Req() request: Request,
  ): Promise<StoredFileResponse> {
    const outcome = await this.files.markUploaded(actorOf(session), id, {
      key,
      requestHash: hashRequest('POST', request.path, null),
    });
    return outcome.body as StoredFileResponse;
  }

  @Get(':id')
  @ApiContract({
    operationId: 'getFile',
    summary: 'The file detail: status, reason, sizes, and links when Ready',
    response: One,
  })
  async get(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StoredFileResponse> {
    return { file: await this.files.get(actorOf(session), id) };
  }
}

/** 400 and 404 of the file routes, each with one sentence. */
@Catch(FileRefusedError, FileNotFoundError)
export class FileErrorFilter implements ExceptionFilter<Error> {
  catch(error: Error, host: ArgumentsHost): void {
    const status =
      error instanceof FileNotFoundError ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
