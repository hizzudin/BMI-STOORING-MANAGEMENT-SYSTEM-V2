import { OkResponseSchema } from '@bmi/shared';
import {
  Catch,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  Put,
  Req,
  StreamableFile,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';
import { STORAGE_LINKS } from '../../app.tokens.js';
import {
  StorageLinkError,
  StorageMismatchError,
  StorageMissingError,
  StorageOverwriteError,
  type SignedLinkServer,
} from '../../ports/storage.js';
import { ApiContract, ApiFileContract } from '../contract.js';

/** The largest upload a signed link may carry here; the signed size is checked exactly below it. */
const MAX_BODY = 25 * 1024 * 1024;

async function bodyOf(request: Request): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY) throw new StorageMismatchError();
    chunks.push(chunk);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

/**
 * D-03, DEC-135: the signed links of the filesystem adapter (local and tests only; registered when
 * STORAGE_DRIVER is fs). The token is the only permission: it names one key, one operation and its
 * expiry, and is checked by the adapter.
 */
@Controller('storage/fs')
export class FsStorageController {
  constructor(@Inject(STORAGE_LINKS) private readonly fs: SignedLinkServer) {}

  @Put(':token')
  @ApiContract({
    operationId: 'putStoredFile',
    summary: 'Upload through a signed link of the filesystem adapter (15 minutes)',
    response: { name: 'OkResponse', schema: OkResponseSchema },
  })
  async put(
    @Param('token') token: string,
    @Req() request: Request,
  ): Promise<z.infer<typeof OkResponseSchema>> {
    const contentType = request.headers['content-type'] ?? '';
    await this.fs.acceptUpload(token, contentType, await bodyOf(request));
    return { ok: true };
  }

  @Get(':token')
  @ApiFileContract({
    operationId: 'getStoredFile',
    summary: 'Open a file through a signed link of the filesystem adapter (15 minutes)',
    file: ['image/jpeg', 'application/pdf'],
  })
  async get(@Param('token') token: string): Promise<StreamableFile> {
    const file = await this.fs.openDownload(token);
    return new StreamableFile(file.body, { type: file.contentType });
  }
}

/** 403, 400, 404 and 409 of the signed links, each with one sentence. */
@Catch(StorageLinkError, StorageMismatchError, StorageMissingError, StorageOverwriteError)
export class StorageErrorFilter implements ExceptionFilter<Error> {
  catch(error: Error, host: ArgumentsHost): void {
    const status =
      error instanceof StorageLinkError
        ? HttpStatus.FORBIDDEN
        : error instanceof StorageMissingError
          ? HttpStatus.NOT_FOUND
          : error instanceof StorageOverwriteError
            ? HttpStatus.CONFLICT
            : HttpStatus.BAD_REQUEST;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
