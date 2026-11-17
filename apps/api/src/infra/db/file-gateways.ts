import { and, eq, inArray, isNull, lt } from 'drizzle-orm';
import type {
  FileGateway,
  FileGateways,
  NewStoredFile,
  ReadyFields,
  StoredFileRow,
} from '../../ports/files.js';
import { DrizzleIdempotencyGateway } from './idempotency-gateway.js';
import { storedFiles } from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

const toRow = (row: typeof storedFiles.$inferSelect): StoredFileRow => ({
  id: row.id,
  storageKey: row.storageKey,
  thumbKey: row.thumbKey,
  profile: row.profile as StoredFileRow['profile'],
  mimeType: row.mimeType as StoredFileRow['mimeType'],
  originalName: row.originalName,
  originalBytes: row.originalBytes,
  storedBytes: row.storedBytes,
  width: row.width,
  height: row.height,
  pageCount: row.pageCount,
  sha256: row.sha256,
  capturedAt: row.capturedAt,
  captureSource: row.captureSource as StoredFileRow['captureSource'],
  status: row.status as StoredFileRow['status'],
  rejectReason: row.rejectReason,
  uploadedBy: row.uploadedBy,
  attachedAt: row.attachedAt,
  createdAt: row.createdAt,
});

/** §9.12 stored_files (8.1). */
export class DrizzleFileGateway implements FileGateway {
  constructor(private readonly tx: DbTransaction) {}

  async insert(file: NewStoredFile): Promise<number> {
    const [row] = await this.tx
      .insert(storedFiles)
      .values({ ...file, status: 'Pending' })
      .returning({ id: storedFiles.id });
    if (!row) throw new Error('stored_files insert returned no row');
    return row.id;
  }

  async findById(id: number, options?: { forUpdate?: boolean }): Promise<StoredFileRow | null> {
    const query = this.tx.select().from(storedFiles).where(eq(storedFiles.id, id));
    const [row] = options?.forUpdate ? await query.for('update') : await query;
    return row ? toRow(row) : null;
  }

  async setReady(id: number, fields: ReadyFields): Promise<void> {
    await this.tx
      .update(storedFiles)
      .set({ ...fields, status: 'Ready', rejectReason: null, updatedAt: new Date() })
      .where(eq(storedFiles.id, id));
  }

  async setRejected(id: number, reason: string): Promise<void> {
    await this.tx
      .update(storedFiles)
      .set({ status: 'Rejected', rejectReason: reason, updatedAt: new Date() })
      .where(and(eq(storedFiles.id, id), eq(storedFiles.status, 'Pending')));
  }

  async listExpirable(before: Date): Promise<StoredFileRow[]> {
    const rows = await this.tx
      .select()
      .from(storedFiles)
      .where(
        and(
          inArray(storedFiles.status, ['Pending', 'Rejected']),
          isNull(storedFiles.attachedAt),
          lt(storedFiles.createdAt, before),
        ),
      )
      .orderBy(storedFiles.id);
    return rows.map(toRow);
  }

  async setExpired(id: number): Promise<void> {
    await this.tx
      .update(storedFiles)
      .set({ status: 'Expired', updatedAt: new Date() })
      .where(
        and(
          eq(storedFiles.id, id),
          inArray(storedFiles.status, ['Pending', 'Rejected']),
          isNull(storedFiles.attachedAt),
        ),
      );
  }
}

export const fileGateways = (tx: DbTransaction): FileGateways => ({
  files: new DrizzleFileGateway(tx),
  idempotency: new DrizzleIdempotencyGateway(tx),
});
