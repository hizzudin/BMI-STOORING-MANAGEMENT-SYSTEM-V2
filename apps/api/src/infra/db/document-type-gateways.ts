import { asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type {
  DocumentTypeFields,
  DocumentTypeGateway,
  DocumentTypeGateways,
  DocumentTypeRow,
} from '../../ports/document-types.js';
import { DrizzleAuditGateway } from './account-gateways.js';
import { documentTypeClasses, documentTypes, vehicleClasses } from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

export class DrizzleDocumentTypeGateway implements DocumentTypeGateway {
  constructor(private readonly tx: DbTransaction) {}

  listActive(): Promise<DocumentTypeRow[]> {
    return this.select(eq(documentTypes.isActive, true));
  }

  async findById(
    id: number,
    options: { forUpdate?: boolean } = {},
  ): Promise<DocumentTypeRow | null> {
    if (options.forUpdate) {
      await this.tx
        .select({ id: documentTypes.id })
        .from(documentTypes)
        .where(eq(documentTypes.id, id))
        .for('update');
    }
    const [row] = await this.select(eq(documentTypes.id, id));
    return row ?? null;
  }

  async codeTaken(code: string): Promise<boolean> {
    const [row] = await this.tx
      .select({ id: documentTypes.id })
      .from(documentTypes)
      .where(sql`lower(${documentTypes.code}) = ${code.toLowerCase()}`)
      .limit(1);
    return row !== undefined;
  }

  classes(): Promise<{ id: number; name: string; vehicleCount: number }[]> {
    return this.tx
      .select({
        id: vehicleClasses.id,
        name: vehicleClasses.name,
        // Written out in full: inside a one-table select drizzle leaves column names unqualified.
        vehicleCount: sql<number>`(SELECT count(*)::int FROM vehicles v WHERE v.vehicle_class_id = vehicle_classes.id AND v.deleted_at IS NULL AND v.status <> 'Inactive')`,
      })
      .from(vehicleClasses)
      .where(eq(vehicleClasses.isActive, true))
      .orderBy(asc(vehicleClasses.name), asc(vehicleClasses.id));
  }

  async insert(code: string, fields: DocumentTypeFields): Promise<number> {
    const [row] = await this.tx
      .insert(documentTypes)
      .values({ code, ...fields })
      .returning({ id: documentTypes.id });
    if (!row) throw new Error('document_types insert returned no row');
    return row.id;
  }

  async update(id: number, fields: DocumentTypeFields): Promise<void> {
    await this.tx
      .update(documentTypes)
      .set({ ...fields, updatedAt: sql`now()` })
      .where(eq(documentTypes.id, id));
  }

  async setClasses(id: number, classIds: readonly number[]): Promise<void> {
    await this.tx.delete(documentTypeClasses).where(eq(documentTypeClasses.documentTypeId, id));
    if (classIds.length === 0) return;
    await this.tx
      .insert(documentTypeClasses)
      .values(classIds.map((vehicleClassId) => ({ documentTypeId: id, vehicleClassId })));
  }

  async deactivate(id: number): Promise<void> {
    await this.tx
      .update(documentTypes)
      .set({ isActive: false, updatedAt: sql`now()` })
      .where(eq(documentTypes.id, id));
  }

  private async select(condition: SQL): Promise<DocumentTypeRow[]> {
    const rows = await this.tx
      .select({
        id: documentTypes.id,
        code: documentTypes.code,
        name: documentTypes.name,
        usualValidityMonths: documentTypes.usualValidityMonths,
        warningDays: documentTypes.warningDays,
        receiptRequired: documentTypes.receiptRequired,
        isActive: documentTypes.isActive,
      })
      .from(documentTypes)
      .where(condition)
      .orderBy(asc(documentTypes.name), asc(documentTypes.id));
    if (rows.length === 0) return [];
    const links = await this.tx
      .select({
        documentTypeId: documentTypeClasses.documentTypeId,
        vehicleClassId: documentTypeClasses.vehicleClassId,
      })
      .from(documentTypeClasses)
      .where(
        inArray(
          documentTypeClasses.documentTypeId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(asc(documentTypeClasses.vehicleClassId));
    return rows.map((row) => ({
      ...row,
      classIds: links.filter((l) => l.documentTypeId === row.id).map((l) => l.vehicleClassId),
    }));
  }
}

export const documentTypeGateways = (tx: DbTransaction): DocumentTypeGateways => ({
  documentTypes: new DrizzleDocumentTypeGateway(tx),
  audit: new DrizzleAuditGateway(tx),
});
