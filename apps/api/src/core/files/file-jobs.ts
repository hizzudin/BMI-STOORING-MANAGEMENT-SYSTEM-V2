import { FILE_MESSAGES, UPLOAD_PROFILES, checkUpload, sniffFileType } from '@bmi/shared';
import { createHash } from 'node:crypto';
import type { ClockPort } from '../../ports/clock.js';
import type {
  FileGateways,
  MediaProcessor,
  ReadyFields,
  StoredFileRow,
} from '../../ports/files.js';
import { StorageOverwriteError, type StoragePort } from '../../ports/storage.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { incomingKey, thumbKeyOf } from './file-service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * REQ-FUP-005, 8.1 step 6: the worker checks the uploaded bytes again, compresses them when the
 * device did not, writes the thumbnail and the hash, and sets Ready or Rejected with a reason.
 */
export class FileProcessor {
  constructor(
    private readonly unitOfWork: UnitOfWork<FileGateways>,
    private readonly storage: StoragePort,
    private readonly media: MediaProcessor,
  ) {}

  /**
   * `lastAttempt`: an error on this run sets Rejected; on an earlier run it is thrown, so the queue
   * retries with growing waits (REQ-FUP-013).
   */
  async process(fileId: number, lastAttempt: boolean): Promise<void> {
    const row = await this.unitOfWork.run(({ files }) => files.findById(fileId));
    if (row?.status !== 'Pending') return;
    try {
      const outcome = await this.finish(row);
      await this.unitOfWork.run(async ({ files }) => {
        const current = await files.findById(fileId, { forUpdate: true });
        if (current?.status !== 'Pending') return;
        if (outcome.ready) await files.setReady(fileId, outcome.ready);
        else await files.setRejected(fileId, outcome.reason);
      });
      await this.storage.remove(incomingKey(row.storageKey));
    } catch (error) {
      if (!lastAttempt) throw error;
      await this.unitOfWork.run(({ files }) => files.setRejected(fileId, FILE_MESSAGES.unreadable));
      await this.storage.remove(incomingKey(row.storageKey));
    }
  }

  private async finish(
    row: StoredFileRow,
  ): Promise<{ ready: ReadyFields; reason?: never } | { ready?: never; reason: string }> {
    const input = await this.storage.read(incomingKey(row.storageKey));
    const type = sniffFileType(input);
    const check = checkUpload(row.profile, { type, bytes: input.byteLength });
    if (!check.ok) return { reason: check.reason };

    if (row.profile === 'PDF') {
      const rules = UPLOAD_PROFILES.PDF;
      const pages = await this.media.pdfPageCount(input);
      const pageCheck = checkUpload('PDF', { type, bytes: input.byteLength, pages });
      if (!pageCheck.ok) return { reason: pageCheck.reason };
      const thumb = await this.media.pdfThumbnail(
        input,
        rules.thumbnail.longSide,
        rules.thumbnail.quality,
      );
      const stored = await this.put(row.storageKey, input, 'application/pdf');
      await this.put(thumbKeyOf(row.storageKey), thumb, 'image/jpeg');
      return { ready: this.readyFields(row, stored, { pageCount: pages }) };
    }

    if (type === 'application/pdf' || type === 'unknown') return { reason: FILE_MESSAGES.type };
    const image = await this.media.image(input, type, UPLOAD_PROFILES[row.profile]);
    const stored = await this.put(row.storageKey, image.bytes, 'image/jpeg');
    await this.put(thumbKeyOf(row.storageKey), image.thumbnail, 'image/jpeg');
    return {
      ready: this.readyFields(row, stored, {
        width: image.width,
        height: image.height,
        capturedAt: image.capturedAt,
      }),
    };
  }

  /** A rerun after a crash finds its own output already written: it keeps that one (REQ-FUP-008). */
  private async put(key: string, bytes: Uint8Array, contentType: string): Promise<Uint8Array> {
    try {
      await this.storage.write(key, bytes, contentType);
      return bytes;
    } catch (error) {
      if (error instanceof StorageOverwriteError) return this.storage.read(key);
      throw error;
    }
  }

  private readyFields(
    row: StoredFileRow,
    stored: Uint8Array,
    extra: Partial<ReadyFields>,
  ): ReadyFields {
    return {
      thumbKey: thumbKeyOf(row.storageKey),
      storedBytes: stored.byteLength,
      width: null,
      height: null,
      pageCount: null,
      capturedAt: null,
      ...extra,
      sha256: createHash('sha256').update(stored).digest('hex'),
    };
  }
}

/** REQ-FUP-009: Pending or Rejected files never attached are gone 24 hours after they were made. */
export class FileCleanup {
  constructor(
    private readonly unitOfWork: UnitOfWork<FileGateways>,
    private readonly storage: StoragePort,
    private readonly clock: ClockPort,
  ) {}

  /** Safe to rerun: a removed object is not an error and an Expired row is not listed again. */
  async run(): Promise<number> {
    const before = new Date(this.clock.now().getTime() - DAY_MS);
    const expirable = await this.unitOfWork.run(({ files }) => files.listExpirable(before));
    for (const row of expirable) {
      await this.storage.remove(incomingKey(row.storageKey));
      await this.storage.remove(row.storageKey);
      await this.storage.remove(thumbKeyOf(row.storageKey));
      await this.unitOfWork.run(({ files }) => files.setExpired(row.id));
    }
    return expirable.length;
  }
}
