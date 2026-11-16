import type { Role } from '@bmi/shared';

/** §9.2 audit_logs as the Audit log reads it, with the name of the record it is about. */
export interface AuditLogRow {
  id: number;
  at: Date;
  entity: string;
  entityId: number;
  action: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  selfDecision: boolean;
  /** Null when the system itself acted (DEC-118). */
  user: { id: number; name: string; role: Role | null } | null;
  /** The SPK number, plate, account name or code of the record; null when it has none. */
  recordName: string | null;
}

/** The rows a page or an export reads; `to` is exclusive. */
export interface AuditLogRowFilter {
  userId?: number;
  entities?: readonly string[];
  from?: Date;
  to?: Date;
}

export interface AuditLogGateway {
  /** Newest first. */
  page(
    filter: AuditLogRowFilter,
    window: { offset: number; limit: number },
  ): Promise<AuditLogRow[]>;
  count(filter: AuditLogRowFilter): Promise<number>;
  one(id: number): Promise<AuditLogRow | null>;
  /** The User filter: everyone who has an audit record. */
  users(): Promise<{ id: number; name: string }[]>;
  userNames(ids: readonly number[]): Promise<Map<number, string>>;
}

/** §9.12 export_logs: append only. */
export interface ExportLogEntry {
  userId: number;
  exportType: 'audit_log';
  parameters: Record<string, unknown>;
  fileFormat: 'csv' | 'xlsx';
}

export interface ExportLogGateway {
  write(entry: ExportLogEntry): Promise<void>;
}

export interface AuditLogGateways {
  auditLog: AuditLogGateway;
  exportLogs: ExportLogGateway;
}

/** DEC-131: the xlsx file of an export; the core never imports the spreadsheet library. */
export interface SpreadsheetWriter {
  xlsx(
    sheet: string,
    header: readonly string[],
    rows: readonly (readonly string[])[],
  ): Promise<Uint8Array>;
}
