import type { VendorKind } from '@bmi/shared';
import { and, asc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import type {
  VendorFields,
  VendorGateway,
  VendorGateways,
  VendorRow,
} from '../../ports/vendors.js';
import { DrizzleAuditGateway } from './account-gateways.js';
import { vendors } from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

const columns = {
  id: vendors.id,
  code: vendors.code,
  name: vendors.name,
  kind: vendors.vendorType,
  phone: vendors.phone,
  address: vendors.address,
  isActive: vendors.isActive,
};

const toRow = (row: Omit<VendorRow, 'kind'> & { kind: string }): VendorRow => ({
  ...row,
  kind: row.kind as VendorKind,
});

/** REQ-INV-014, DEC-134: §9.7 vendors; a deleted row is never shown. */
export class DrizzleVendorGateway implements VendorGateway {
  constructor(private readonly tx: DbTransaction) {}

  list(): Promise<VendorRow[]> {
    return this.select(isNull(vendors.deletedAt));
  }

  listActive(kind?: VendorKind): Promise<VendorRow[]> {
    return this.select(
      and(
        isNull(vendors.deletedAt),
        eq(vendors.isActive, true),
        kind ? eq(vendors.vendorType, kind) : undefined,
      ),
    );
  }

  async findById(id: number, options: { forUpdate?: boolean } = {}): Promise<VendorRow | null> {
    const query = this.tx
      .select(columns)
      .from(vendors)
      .where(and(eq(vendors.id, id), isNull(vendors.deletedAt)));
    const [row] = options.forUpdate ? await query.for('update') : await query;
    return row ? toRow(row) : null;
  }

  async codeTaken(code: string): Promise<boolean> {
    const [row] = await this.tx
      .select({ id: vendors.id })
      .from(vendors)
      .where(sql`lower(${vendors.code}) = ${code.toLowerCase()}`)
      .limit(1);
    return row !== undefined;
  }

  async insert(code: string, fields: VendorFields): Promise<number> {
    const [row] = await this.tx
      .insert(vendors)
      .values({ code, ...this.values(fields) })
      .returning({ id: vendors.id });
    return Number(row?.id);
  }

  async update(id: number, fields: VendorFields): Promise<void> {
    await this.tx
      .update(vendors)
      .set({ ...this.values(fields), updatedAt: sql`now()` })
      .where(eq(vendors.id, id));
  }

  async setActive(id: number, active: boolean): Promise<void> {
    await this.tx
      .update(vendors)
      .set({ isActive: active, updatedAt: sql`now()` })
      .where(eq(vendors.id, id));
  }

  private values(fields: VendorFields) {
    return {
      name: fields.name,
      vendorType: fields.kind,
      phone: fields.phone,
      address: fields.address,
    };
  }

  private async select(condition: SQL | undefined): Promise<VendorRow[]> {
    const rows = await this.tx
      .select(columns)
      .from(vendors)
      .where(condition)
      .orderBy(asc(vendors.name), asc(vendors.id));
    return rows.map(toRow);
  }
}

export const vendorGateways = (tx: DbTransaction): VendorGateways => ({
  vendors: new DrizzleVendorGateway(tx),
  audit: new DrizzleAuditGateway(tx),
});
