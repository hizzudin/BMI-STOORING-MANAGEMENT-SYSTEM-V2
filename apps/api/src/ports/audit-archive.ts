import type { Role } from '@bmi/shared';
import type { AuditGateway } from './accounts.js';

/** §9.2 audit_logs, every column, as the archive file keeps it (DEC-138). */
export interface AuditArchiveRow {
  id: number;
  at: Date;
  entity: string;
  entityId: number;
  action: string;
  userId: number | null;
  userRole: Role | null;
  selfDecision: boolean;
  reason: string | null;
  before: unknown;
  after: unknown;
}

export interface AuditArchiveGateway {
  /** The WIB months (`YYYY-MM`) that still have rows before the cutoff, oldest first. */
  monthsBefore(cutoff: Date): Promise<string[]>;
  /** Every row with `from <= at < to`, by id. */
  rowsOf(from: Date, to: Date): Promise<AuditArchiveRow[]>;
  /** DEC-138: deletes those rows inside the archive exception of the trigger; returns the count. */
  deleteRange(from: Date, to: Date): Promise<number>;
}

export interface AuditArchiveGateways {
  archive: AuditArchiveGateway;
  audit: AuditGateway;
}
