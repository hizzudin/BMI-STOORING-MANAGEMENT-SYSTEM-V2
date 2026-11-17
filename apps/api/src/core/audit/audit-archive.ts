import { storageKey } from '@bmi/shared';
import { createHash } from 'node:crypto';
import type { AuditArchiveGateways, AuditArchiveRow } from '../../ports/audit-archive.js';
import type { ClockPort } from '../../ports/clock.js';
import { StorageOverwriteError, type StoragePort } from '../../ports/storage.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { toCsv } from './audit-format.js';

const ARCHIVE_MONTHS = 12;
/** DEC-138: every column of the row, so nothing is lost when the rows are deleted. */
const ARCHIVE_HEADER = [
  'id',
  'at',
  'entity',
  'entity_id',
  'action',
  'user_id',
  'user_role',
  'self_decision',
  'reason',
  'before',
  'after',
];

/** The instant a WIB month (`year`, `month` 1 to 12, either may overflow) starts (NFR-14). */
function wibMonthStart(year: number, month: number): Date {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const yyyy = first.getUTCFullYear();
  const mm = String(first.getUTCMonth() + 1).padStart(2, '0');
  return new Date(`${yyyy}-${mm}-01T00:00:00+07:00`);
}

/** DEC-138: rows before the WIB start of the run month minus 12 months are archived. */
export function archiveCutoff(wibToday: string): Date {
  const [year, month] = wibToday.split('-').map(Number) as [number, number];
  return wibMonthStart(year, month - ARCHIVE_MONTHS);
}

/** A WIB month `YYYY-MM`, from its first day 00:00 WIB to the next month. */
export function wibMonthRange(month: string): { from: Date; to: Date } {
  const [year, mm] = month.split('-').map(Number) as [number, number];
  return { from: wibMonthStart(year, mm), to: wibMonthStart(year, mm + 1) };
}

const cells = (row: AuditArchiveRow): string[] => [
  String(row.id),
  row.at.toISOString(),
  row.entity,
  String(row.entityId),
  row.action,
  row.userId === null ? '' : String(row.userId),
  row.userRole ?? '',
  String(row.selfDecision),
  row.reason ?? '',
  JSON.stringify(row.before ?? null),
  JSON.stringify(row.after ?? null),
];

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export type ArchivedMonth =
  | { month: string; file: string; records: number; sha256: string }
  | { month: string; error: string };

/**
 * NFR-17, DEC-57, DEC-138: each month the audit rows older than a year go to one CSV per WIB month,
 * read back and checked, and only then are deleted with a new audit record holding the checksum.
 */
export class AuditArchiveJob {
  constructor(
    private readonly unitOfWork: UnitOfWork<AuditArchiveGateways>,
    private readonly storage: StoragePort,
    private readonly clock: ClockPort,
    private readonly keyEnv: string,
  ) {}

  /** One line per month; a month that fails is reported and the others still run. */
  async run(): Promise<ArchivedMonth[]> {
    const cutoff = archiveCutoff(this.clock.wibToday());
    const months = await this.unitOfWork.run(({ archive }) => archive.monthsBefore(cutoff));
    const outcomes: ArchivedMonth[] = [];
    for (const month of months) {
      try {
        outcomes.push(await this.archiveMonth(month));
      } catch (error) {
        outcomes.push({ month, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return outcomes;
  }

  private async archiveMonth(month: string): Promise<ArchivedMonth> {
    const { from, to } = wibMonthRange(month);
    const rows = await this.unitOfWork.run(({ archive }) => archive.rowsOf(from, to));
    const bytes = new TextEncoder().encode(toCsv(ARCHIVE_HEADER, rows.map(cells)));
    const checksum = sha256(bytes);
    const [year, mm] = month.split('-').map(Number) as [number, number];
    const file = storageKey({
      env: this.keyEnv,
      // Mid-month, so the UTC month of the key is the archived WIB month.
      at: new Date(Date.UTC(year, mm - 1, 15)),
      entity: 'audit-archive',
      id: `audit-${month}`,
      ext: 'csv',
    });
    try {
      await this.storage.write(file, bytes, 'text/csv');
    } catch (error) {
      // A crashed run left the file: it is kept only when it matches (checked below).
      if (!(error instanceof StorageOverwriteError)) throw error;
    }
    if (sha256(await this.storage.read(file)) !== checksum) {
      throw new Error(`${file} does not match the records of ${month}; the month is kept`);
    }
    return this.unitOfWork.run(async ({ archive, audit }) => {
      const deleted = await archive.deleteRange(from, to);
      if (deleted !== rows.length) {
        throw new Error(`${month} changed while it was archived; nothing was deleted`);
      }
      const after = { file, month, records: rows.length, sha256: checksum };
      await audit.write({
        entity: 'audit_archive',
        entityId: year * 100 + mm,
        action: 'archive',
        after,
        userId: null,
        userRole: null,
      });
      return after;
    });
  }
}
