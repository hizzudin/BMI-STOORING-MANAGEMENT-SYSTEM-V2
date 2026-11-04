import type { Pool } from 'pg';

const UNIQUE_INDEXES_COUNTING_DELETED_ROWS = `
  SELECT index_class.relname AS index_name, table_class.relname AS table_name
  FROM pg_index x
  JOIN pg_class index_class ON index_class.oid = x.indexrelid
  JOIN pg_class table_class ON table_class.oid = x.indrelid
  JOIN pg_namespace n ON n.oid = table_class.relnamespace
  WHERE n.nspname = 'public'
    AND x.indisunique
    AND NOT x.indisprimary
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = table_class.oid AND a.attname = 'deleted_at' AND NOT a.attisdropped
    )
    AND coalesce(pg_get_expr(x.indpred, x.indrelid), '') NOT LIKE '%deleted_at%'
  ORDER BY 1`;

const FOREIGN_KEYS_NOT_RESTRICT = `
  SELECT c.conname AS constraint_name, t.relname AS table_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND c.contype = 'f' AND c.confdeltype <> 'r'
  ORDER BY 1`;

/** The §9.0 conventions a database can state about itself: TX-18 and ON DELETE RESTRICT (BR-10). */
export async function findConventionViolations(pool: Pool): Promise<string[]> {
  const indexes = await pool.query<{ index_name: string; table_name: string }>(
    UNIQUE_INDEXES_COUNTING_DELETED_ROWS,
  );
  const foreignKeys = await pool.query<{ constraint_name: string; table_name: string }>(
    FOREIGN_KEYS_NOT_RESTRICT,
  );
  return [
    ...indexes.rows.map(
      (row) =>
        `TX-18: unique index ${row.index_name} on ${row.table_name} counts soft-deleted rows`,
    ),
    ...foreignKeys.rows.map(
      (row) =>
        `BR-10: foreign key ${row.constraint_name} on ${row.table_name} is not ON DELETE RESTRICT`,
    ),
  ];
}
