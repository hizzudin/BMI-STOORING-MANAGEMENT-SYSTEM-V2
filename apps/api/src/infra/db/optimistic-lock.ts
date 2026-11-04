import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { ConcurrentUpdateError } from '../../ports/errors.js';
import type { DbTransaction } from './unit-of-work.js';

type VersionedTable = PgTable & { id: AnyPgColumn; version: AnyPgColumn; updatedAt: AnyPgColumn };

/** Every update of an `-- OL` table of §9 goes through here (NFR-03). */
export async function updateWithVersion<Table extends VersionedTable>(
  db: NodePgDatabase | DbTransaction,
  table: Table,
  id: number,
  expectedVersion: number,
  values: Partial<Table['$inferInsert']>,
): Promise<void> {
  const changes = { ...values, version: sql`${table.version} + 1`, updatedAt: sql`now()` };
  const updated = await db
    .update(table as PgTable)
    .set(changes as never)
    .where(and(eq(table.id, id), eq(table.version, expectedVersion)))
    .returning({ id: table.id });
  if (updated.length === 0) throw new ConcurrentUpdateError();
}
