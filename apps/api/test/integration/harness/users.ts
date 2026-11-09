import { testPool } from './database.js';

let sequence = 0;

/** Inserts accounts for a test and returns their ids; each test builds its own data. */
export async function insertUsers(count: number): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < count; i += 1) {
    sequence += 1;
    const { rows } = await testPool().query<{ id: string }>(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, 'not-a-real-hash') RETURNING id`,
      [`User ${sequence}`, `user${sequence}.${Date.now()}@bmi.test`],
    );
    ids.push(Number(rows[0]?.id));
  }
  return ids;
}
