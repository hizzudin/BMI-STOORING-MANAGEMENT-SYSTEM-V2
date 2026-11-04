import { and, eq, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import {
  IdempotencyKeyReusedError,
  type ClaimResult,
  type IdempotencyGateway,
  type IdempotentRequest,
  type StoredResponse,
} from '../../ports/idempotency.js';
import { idempotencyKeys } from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

const KEEP_DAYS = 30;
const MS_PER_DAY = 86_400_000;

export class DrizzleIdempotencyGateway implements IdempotencyGateway {
  constructor(private readonly tx: DbTransaction) {}

  async claim({ userId, key, requestHash }: IdempotentRequest): Promise<ClaimResult> {
    // A concurrent request with this key waits here until the first one commits or rolls back.
    const inserted = await this.tx
      .insert(idempotencyKeys)
      .values({ userId, idemKey: key, requestHash })
      .onConflictDoNothing()
      .returning({ id: idempotencyKeys.id });
    if (inserted.length > 0) return { kind: 'new' };

    const [existing] = await this.tx
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.idemKey, key)));
    if (existing?.requestHash !== requestHash) throw new IdempotencyKeyReusedError();
    return {
      kind: 'replay',
      response: { status: existing.responseStatus ?? 0, body: existing.responseBody },
    };
  }

  async store({ userId, key }: IdempotentRequest, { status, body }: StoredResponse): Promise<void> {
    await this.tx
      .update(idempotencyKeys)
      .set({ responseStatus: status, responseBody: body, updatedAt: sql`now()` })
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.idemKey, key)));
  }
}

/** DEC-108: run by the daily job (TX-16). Returns how many rows it removed. */
export async function purgeIdempotencyKeys(pool: Pool, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - KEEP_DAYS * MS_PER_DAY);
  const { rowCount } = await pool.query('DELETE FROM idempotency_keys WHERE created_at < $1', [
    cutoff,
  ]);
  return rowCount ?? 0;
}
