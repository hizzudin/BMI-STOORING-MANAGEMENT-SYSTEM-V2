import {
  FILE_NOT_FOUND,
  UPLOAD_PROFILES,
  checkUpload,
  storageKey,
  type SniffedType,
  type StoredFile,
  type UploadLinkRequest,
  type UploadLinkResponse,
} from '@bmi/shared';
import { randomUUID } from 'node:crypto';
import type { ClockPort } from '../../ports/clock.js';
import type { FileGateways, FileJobs, StoredFileRow } from '../../ports/files.js';
import type { IdempotentRequest } from '../../ports/idempotency.js';
import type { StoragePort } from '../../ports/storage.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { runIdempotent, type IdempotentResponse } from '../idempotency/run-idempotent.js';
import { ActionRefusedError, NOT_ALLOWED, type Actor } from '../iam/actions.js';

/** REQ-FUP-002: a file the profile does not take; HTTP 400 with the one sentence. */
export class FileRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileRefusedError';
  }
}

/** No such file, or not the caller's; HTTP 404. */
export class FileNotFoundError extends Error {
  constructor() {
    super(FILE_NOT_FOUND);
    this.name = 'FileNotFoundError';
  }
}

/** The type the device declares, named as the sniffer names it (DEC-31: video is unknown). */
const DECLARED: Record<string, SniffedType> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/heic': 'image/heic',
  'image/heif': 'image/heic',
  'application/pdf': 'application/pdf',
};

/** DEC-136: the device uploads here; the worker writes the checked file under the storage key. */
export const incomingKey = (key: string) => `incoming/${key}`;
/** §9.12 thumb_key: the 320 px JPEG next to the file. */
export const thumbKeyOf = (key: string) => key.replace(/\.(jpg|pdf)$/, '-thumb.jpg');

/** 8.1 steps 4 and 8: upload links, the uploaded signal and the file's detail. */
export class FileService {
  constructor(
    private readonly unitOfWork: UnitOfWork<FileGateways>,
    private readonly storage: StoragePort,
    private readonly jobs: FileJobs,
    private readonly clock: ClockPort,
    private readonly keyEnv: string,
  ) {}

  /** REQ-FUP-004: a Pending row and a signed link, for holders of files.upload (DEC-136). */
  requestUpload(
    actor: Actor,
    request: UploadLinkRequest,
    key: Omit<IdempotentRequest, 'userId'>,
  ): Promise<IdempotentResponse> {
    this.requireUploader(actor);
    const contentType = request.contentType.toLowerCase();
    const check = checkUpload(request.profile, {
      type: DECLARED[contentType] ?? 'unknown',
      bytes: request.bytes,
    });
    if (!check.ok) throw new FileRefusedError(check.reason);
    return runIdempotent(this.unitOfWork, { ...key, userId: actor.user.id }, async ({ files }) => {
      const now = this.clock.now();
      const output = UPLOAD_PROFILES[request.profile].output;
      const storage = storageKey({
        env: this.keyEnv,
        at: now,
        entity: 'files',
        id: randomUUID(),
        ext: output === 'application/pdf' ? 'pdf' : 'jpg',
      });
      const id = await files.insert({
        storageKey: storage,
        profile: request.profile,
        mimeType: output,
        originalName: request.originalName,
        originalBytes: request.originalBytes ?? request.bytes,
        captureSource: request.captureSource,
        capturedAt: request.capturedAt ? new Date(request.capturedAt) : null,
        uploadedBy: actor.user.id,
        createdAt: now,
      });
      const link = await this.storage.signUpload(incomingKey(storage), {
        contentType,
        bytes: request.bytes,
      });
      const row = await this.load(files, actor, id);
      const body: UploadLinkResponse = {
        file: await this.view(row),
        upload: { ...link, expiresAt: link.expiresAt.toISOString() },
      };
      return { status: 201, body };
    });
  }

  /** 8.1 step 6: the bytes landed, so the worker checks them (one job per file). */
  markUploaded(
    actor: Actor,
    id: number,
    key: Omit<IdempotentRequest, 'userId'>,
  ): Promise<IdempotentResponse> {
    this.requireUploader(actor);
    return runIdempotent(this.unitOfWork, { ...key, userId: actor.user.id }, async ({ files }) => {
      const row = await this.load(files, actor, id);
      if (row.status === 'Pending') await this.jobs.enqueueProcessing(row.id);
      return { status: 200, body: { file: await this.view(row) } };
    });
  }

  /** REQ-FUP-007: the detail panel. Until a record attaches it, only its uploader sees it. */
  get(actor: Actor, id: number): Promise<StoredFile> {
    this.requireUploader(actor);
    return this.unitOfWork.run(async ({ files }) => this.view(await this.load(files, actor, id)));
  }

  private async load(
    files: FileGateways['files'],
    actor: Actor,
    id: number,
  ): Promise<StoredFileRow> {
    const row = await files.findById(id);
    if (!row || row.uploadedBy !== actor.user.id) throw new FileNotFoundError();
    return row;
  }

  private requireUploader(actor: Actor): void {
    if (!actor.capabilities.has('files.upload')) {
      throw new ActionRefusedError('files.upload', NOT_ALLOWED);
    }
  }

  private async view(row: StoredFileRow): Promise<StoredFile> {
    const ready = row.status === 'Ready';
    return {
      id: row.id,
      profile: row.profile,
      status: row.status,
      rejectReason: row.rejectReason,
      originalName: row.originalName,
      originalBytes: row.originalBytes,
      storedBytes: row.storedBytes,
      width: row.width,
      height: row.height,
      pageCount: row.pageCount,
      capturedAt: row.capturedAt?.toISOString() ?? null,
      thumbnailUrl:
        ready && row.thumbKey ? (await this.storage.signDownload(row.thumbKey)).url : null,
      fileUrl: ready ? (await this.storage.signDownload(row.storageKey)).url : null,
      uploadedBy: { name: row.uploaderName, role: row.uploaderRole },
      uploadedAt: row.createdAt.toISOString(),
    };
  }
}
