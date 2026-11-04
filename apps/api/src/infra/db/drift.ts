import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import type { Pool } from 'pg';

const DATABASE_COLUMNS = `
  SELECT c.relname AS table_name, a.attname AS column_name,
         format_type(a.atttypid, a.atttypmod) AS column_type, a.attnotnull AS not_null
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
  ORDER BY 1, a.attnum`;

interface DatabaseColumn {
  table_name: string;
  column_name: string;
  column_type: string;
  not_null: boolean;
}

// Drizzle writes the short SQL names; format_type answers with the long ones.
function canonicalType(drizzleType: string): string {
  return drizzleType
    .replace(/^varchar/, 'character varying')
    .replace(/^char\b/, 'character')
    .replace(/^timestamp$/, 'timestamp without time zone');
}

function compareTable(table: PgTable, databaseColumns: DatabaseColumn[]): string[] {
  const { name, columns } = getTableConfig(table);
  const problems = columns.flatMap((column) => {
    const inDatabase = databaseColumns.find((c) => c.column_name === column.name);
    if (!inDatabase) return [`${name}.${column.name}: only in Drizzle`];
    const found: string[] = [];
    const type = canonicalType(column.getSQLType());
    if (type !== inDatabase.column_type) {
      found.push(
        `${name}.${column.name}: Drizzle has ${type}, the database has ${inDatabase.column_type}`,
      );
    }
    if (column.notNull && !inDatabase.not_null) {
      found.push(`${name}.${column.name}: Drizzle says NOT NULL, the database allows NULL`);
    }
    if (!column.notNull && inDatabase.not_null) {
      found.push(`${name}.${column.name}: Drizzle allows NULL, the database says NOT NULL`);
    }
    return found;
  });
  const defined = new Set(columns.map((column) => column.name));
  const extra = databaseColumns
    .filter((c) => !defined.has(c.column_name))
    .map((c) => `${name}.${c.column_name}: only in the database`);
  return [...problems, ...extra];
}

/** D-12: the SQL migrations are the schema; the Drizzle definitions may only follow them. */
export async function findSchemaDrift(
  pool: Pool,
  tables: readonly PgTable[],
  ignoredTables: readonly string[] = [],
): Promise<string[]> {
  const { rows } = await pool.query<DatabaseColumn>(DATABASE_COLUMNS);
  const columnsOf = (tableName: string) => rows.filter((row) => row.table_name === tableName);
  const defined = new Set(tables.map((table) => getTableConfig(table).name));

  const fromDefinitions = tables.flatMap((table) => {
    const { name } = getTableConfig(table);
    const databaseColumns = columnsOf(name);
    if (databaseColumns.length === 0) return [`${name}: only in Drizzle`];
    return compareTable(table, databaseColumns);
  });
  const undefinedTables = [...new Set(rows.map((row) => row.table_name))]
    .filter((name) => !defined.has(name) && !ignoredTables.includes(name))
    .map((name) => `${name}: only in the database`);
  return [...fromDefinitions, ...undefinedTables];
}
