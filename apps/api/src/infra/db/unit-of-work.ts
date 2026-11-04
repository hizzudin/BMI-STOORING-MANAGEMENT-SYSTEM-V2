import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

export type DbTransaction = Parameters<Parameters<NodePgDatabase['transaction']>[0]>[0];

export class DrizzleUnitOfWork<Gateways> implements UnitOfWork<Gateways> {
  private readonly db: NodePgDatabase;

  constructor(
    pool: Pool,
    private readonly buildGateways: (tx: DbTransaction) => Gateways,
  ) {
    this.db = drizzle(pool);
  }

  run<T>(work: (gateways: Gateways) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(this.buildGateways(tx)));
  }
}
