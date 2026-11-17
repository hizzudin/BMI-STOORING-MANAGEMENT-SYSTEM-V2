import { and, asc, gte, lt, sql } from 'drizzle-orm';
import type {
  AuditArchiveGateway,
  AuditArchiveGateways,
  AuditArchiveRow,
} from '../../ports/audit-archive.js';
import { DrizzleAuditGateway } from './account-gateways.js';
import { auditLogs } from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

const inRange = (from: Date, to: Date) => and(gte(auditLogs.at, from), lt(auditLogs.at, to));

/** NFR-17, DEC-138: reads and deletes audit_logs months for the archive job. */
export class DrizzleAuditArchiveGateway implements AuditArchiveGateway {
  constructor(private readonly tx: DbTransaction) {}

  async monthsBefore(cutoff: Date): Promise<string[]> {
    // `at` is UTC; a WIB month is seven hours ahead (NFR-14).
    const month = sql<string>`to_char(${auditLogs.at} + interval '7 hours', 'YYYY-MM')`;
    const rows = await this.tx
      .selectDistinct({ month })
      .from(auditLogs)
      .where(lt(auditLogs.at, cutoff))
      .orderBy(month);
    return rows.map((row) => row.month);
  }

  rowsOf(from: Date, to: Date): Promise<AuditArchiveRow[]> {
    return this.tx
      .select({
        id: auditLogs.id,
        at: auditLogs.at,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        action: auditLogs.action,
        userId: auditLogs.userId,
        userRole: auditLogs.userRole,
        selfDecision: auditLogs.selfDecision,
        reason: auditLogs.reason,
        before: auditLogs.before,
        after: auditLogs.after,
      })
      .from(auditLogs)
      .where(inRange(from, to))
      .orderBy(asc(auditLogs.id));
  }

  async deleteRange(from: Date, to: Date): Promise<number> {
    // The one exception of the append-only trigger (migration 0013): this transaction only.
    await this.tx.execute(sql`SET LOCAL bmi.audit_archive = 'on'`);
    const deleted = await this.tx
      .delete(auditLogs)
      .where(inRange(from, to))
      .returning({ id: auditLogs.id });
    return deleted.length;
  }
}

export const auditArchiveGateways = (tx: DbTransaction): AuditArchiveGateways => ({
  archive: new DrizzleAuditArchiveGateway(tx),
  audit: new DrizzleAuditGateway(tx),
});
