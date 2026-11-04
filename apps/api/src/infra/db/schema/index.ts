import type { PgTable } from 'drizzle-orm/pg-core';

// One entry per table of §9 as its migration arrives (TASK-103 on). The drift test reads this list.
export const allTables: readonly PgTable[] = [];
