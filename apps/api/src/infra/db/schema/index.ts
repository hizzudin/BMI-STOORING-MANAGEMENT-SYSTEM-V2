import {
  bigint,
  char,
  jsonb,
  pgTable,
  smallint,
  timestamp,
  unique,
  varchar,
  type PgTable,
} from 'drizzle-orm/pg-core';

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at'),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    idemKey: varchar('idem_key', { length: 100 }).notNull(),
    requestHash: char('request_hash', { length: 64 }).notNull(),
    responseStatus: smallint('response_status'),
    responseBody: jsonb('response_body'),
  },
  (table) => [unique().on(table.userId, table.idemKey)],
);

// One entry per table of §9 as its migration arrives. The drift test reads this list.
export const allTables: readonly PgTable[] = [idempotencyKeys];
