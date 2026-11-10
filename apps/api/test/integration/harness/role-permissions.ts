import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { testPool } from './database.js';

/** The migrations that write the default `role_permissions` rows, in order (2.2, DEC-115, DEC-117). */
const SEED_MIGRATIONS = ['0004_role_permissions_seed.sql', '0005_role_permissions_locks.sql'];

/** The worker setup empties every table, so a test that needs the matrix runs its migrations again. */
export async function seedRolePermissions(): Promise<void> {
  for (const name of SEED_MIGRATIONS) {
    const sql = await readFile(join(import.meta.dirname, '../../../migrations', name), 'utf8');
    await testPool().query(sql);
  }
}
