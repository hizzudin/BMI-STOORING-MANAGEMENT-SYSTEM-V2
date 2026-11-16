import {
  AUDIT_DEFAULT_DAYS,
  AUDIT_EXPORT_MAX_ROWS,
  AUDIT_MESSAGES,
  formatDateTimeWib,
  selfLabel,
  wibCalendarDay,
  type AccessHistoryQuery,
  type AccessHistoryResponse,
  type AuditExportFormat,
  type AuditLogDetail,
  type AuditLogExportQuery,
  type AuditLogFilter,
  type AuditLogItem,
  type AuditLogQuery,
  type AuditLogResponse,
  type Pagination,
} from '@bmi/shared';
import type {
  AuditLogGateways,
  AuditLogRow,
  AuditLogRowFilter,
  SpreadsheetWriter,
} from '../../ports/audit-log.js';
import type { ClockPort } from '../../ports/clock.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { ActionRefusedError, NOT_ALLOWED, type Actor } from '../iam/actions.js';
import {
  AREA_OF,
  accessChange,
  entitiesOf,
  mentionedUserIds,
  recordOf,
  summarise,
  toCsv,
} from './audit-format.js';

export class AuditLogNotFoundError extends Error {
  constructor() {
    super(AUDIT_MESSAGES.notFound);
    this.name = 'AuditLogNotFoundError';
  }
}

/** DEC-131: an export above the row limit is refused before any row is read. */
export class AuditExportTooLargeError extends Error {
  constructor() {
    super(AUDIT_MESSAGES.exportTooLarge);
    this.name = 'AuditExportTooLargeError';
  }
}

export interface AuditExportFile {
  fileName: string;
  contentType: string;
  body: Uint8Array;
}

const MS_PER_DAY = 86_400_000;
const CONTENT_TYPES: Readonly<Record<AuditExportFormat, string>> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const EXPORT_HEADER = ['Time', 'User', 'Role', 'Area', 'Record', 'Before', 'After', 'Self'];

/** The WIB day `days` after `day` (both YYYY-MM-DD). */
const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
/** The instant a WIB day starts (NFR-14). */
const wibStart = (day: string) => new Date(`${day}T00:00:00+07:00`);
const roleText = (role: string | null | undefined) => (role ? role.replace(/_/g, ' ') : '');

function paginationOf(page: number, pageSize: number, total: number): Pagination {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** REQ-IAM-007, NFR-02, DEC-74, DEC-131: the Audit log, its export and the Access history tab. */
export class AuditLogService {
  constructor(
    private readonly unitOfWork: UnitOfWork<AuditLogGateways>,
    private readonly clock: ClockPort,
    private readonly spreadsheet: SpreadsheetWriter,
  ) {}

  list(actor: Actor, query: AuditLogQuery): Promise<AuditLogResponse> {
    this.require(actor, 'audit.view');
    const range = this.range(query);
    return this.unitOfWork.run(async ({ auditLog }) => {
      const filter = this.rowFilter(query, range);
      const total = await auditLog.count(filter);
      const rows = await auditLog.page(filter, {
        offset: (query.page - 1) * query.pageSize,
        limit: query.pageSize,
      });
      return {
        items: rows.map((row) => this.item(row)),
        pagination: paginationOf(query.page, query.pageSize, total),
        range,
        users: await auditLog.users(),
      };
    });
  }

  detail(actor: Actor, id: number): Promise<AuditLogDetail> {
    this.require(actor, 'audit.view');
    return this.unitOfWork.run(async ({ auditLog }) => {
      const row = await auditLog.one(id);
      if (!row) throw new AuditLogNotFoundError();
      return { item: this.item(row), before: row.before, after: row.after };
    });
  }

  /** DEC-74, DEC-131: the filtered rows as a file, at most 10,000, logged in export_logs. */
  export(actor: Actor, query: AuditLogExportQuery): Promise<AuditExportFile> {
    this.require(actor, 'audit.view');
    const range = this.range(query);
    return this.unitOfWork.run(async ({ auditLog, exportLogs }) => {
      const filter = this.rowFilter(query, range);
      if ((await auditLog.count(filter)) > AUDIT_EXPORT_MAX_ROWS) {
        throw new AuditExportTooLargeError();
      }
      const rows = (await auditLog.page(filter, { offset: 0, limit: AUDIT_EXPORT_MAX_ROWS })).map(
        (row) => this.exportCells(this.item(row)),
      );
      const body =
        query.format === 'csv'
          ? new TextEncoder().encode(toCsv(EXPORT_HEADER, rows))
          : await this.spreadsheet.xlsx('Audit log', EXPORT_HEADER, rows);
      await exportLogs.write({
        userId: actor.user.id,
        exportType: 'audit_log',
        fileFormat: query.format,
        parameters: {
          ...(query.userId !== undefined ? { userId: query.userId } : {}),
          ...(query.area ? { area: query.area } : {}),
          ...range,
        },
      });
      return {
        fileName: `audit-log-${wibCalendarDay(this.clock.now())}.${query.format}`,
        contentType: CONTENT_TYPES[query.format],
        body,
      };
    });
  }

  /** REQ-IAM-003, FLW-AM-05: every access change, newest first, in words. */
  accessHistory(actor: Actor, query: AccessHistoryQuery): Promise<AccessHistoryResponse> {
    this.require(actor, 'accounts.manage');
    return this.unitOfWork.run(async ({ auditLog }) => {
      const filter: AuditLogRowFilter = { entities: entitiesOf('Access') };
      const total = await auditLog.count(filter);
      const rows = await auditLog.page(filter, {
        offset: (query.page - 1) * query.pageSize,
        limit: query.pageSize,
      });
      const names = await auditLog.userNames([...new Set(rows.flatMap(mentionedUserIds))]);
      return {
        items: rows.map((row) => ({
          id: row.id,
          at: row.at.toISOString(),
          who: row.user?.name ?? null,
          what: accessChange(row, names),
        })),
        pagination: paginationOf(query.page, query.pageSize, total),
      };
    });
  }

  /** DEC-131: the WIB days asked for; without dates, the last 7 days up to today. */
  private range(filter: AuditLogFilter): { from: string; to: string } {
    const today = wibCalendarDay(this.clock.now());
    const to = filter.to ?? (filter.from && filter.from > today ? filter.from : today);
    const from = filter.from ?? addDays(to, 1 - AUDIT_DEFAULT_DAYS);
    return { from, to };
  }

  private rowFilter(
    filter: AuditLogFilter,
    range: { from: string; to: string },
  ): AuditLogRowFilter {
    return {
      ...(filter.userId !== undefined ? { userId: filter.userId } : {}),
      ...(filter.area ? { entities: entitiesOf(filter.area) } : {}),
      from: wibStart(range.from),
      to: wibStart(addDays(range.to, 1)),
    };
  }

  private item(row: AuditLogRow): AuditLogItem {
    return {
      id: row.id,
      at: row.at.toISOString(),
      user: row.user,
      area: AREA_OF[row.entity] ?? row.entity,
      entity: row.entity,
      entityId: row.entityId,
      record: recordOf(row),
      action: row.action,
      ...summarise(row.before, row.after),
      self: selfLabel(row),
      reason: row.reason,
    };
  }

  private exportCells(item: AuditLogItem): string[] {
    return [
      formatDateTimeWib(new Date(item.at)),
      item.user?.name ?? 'System',
      roleText(item.user?.role),
      item.area,
      item.record,
      item.before ?? '',
      item.after ?? '',
      item.self ?? '',
    ];
  }

  private require(actor: Actor, code: 'audit.view' | 'accounts.manage'): void {
    if (!actor.capabilities.has(code)) throw new ActionRefusedError('audit', NOT_ALLOWED);
  }
}
