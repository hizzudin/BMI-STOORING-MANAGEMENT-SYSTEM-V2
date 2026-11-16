import { describe, expect, it } from 'vitest';
import {
  AccessHistoryQuerySchema,
  AUDIT_AREAS,
  AuditLogExportQuerySchema,
  AuditLogQuerySchema,
  selfLabel,
} from './audit.js';

describe('Audit log query (REQ-IAM-007, DEC-131)', () => {
  it('pages 20 rows by default, with no filter: the server applies the last 7 days', () => {
    expect(AuditLogQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('reads the filters from the query string', () => {
    expect(
      AuditLogQuerySchema.parse({
        userId: '4',
        area: 'Access',
        from: '2026-11-01',
        to: '2026-11-16',
        page: '2',
        pageSize: '50',
      }),
    ).toEqual({
      userId: 4,
      area: 'Access',
      from: '2026-11-01',
      to: '2026-11-16',
      page: 2,
      pageSize: 50,
    });
  });

  it('offers the areas of phase 1', () => {
    expect(AUDIT_AREAS).toEqual(['SPK', 'Access', 'Vehicles', 'Settings']);
  });

  it('refuses a page size outside 10, 20, 50 or 100, and a date that is not YYYY-MM-DD', () => {
    expect(AuditLogQuerySchema.safeParse({ pageSize: '25' }).error?.issues[0]?.message).toBe(
      'Choose 10, 20, 50 or 100 per page.',
    );
    expect(AuditLogQuerySchema.safeParse({ from: '16-11-2026' }).error?.issues[0]?.message).toBe(
      'Enter a date as YYYY-MM-DD.',
    );
  });

  it('refuses a From date after the To date', () => {
    const result = AuditLogQuerySchema.safeParse({ from: '2026-11-10', to: '2026-11-01' });
    expect(result.error?.issues[0]?.message).toBe(
      'The From date must be on or before the To date.',
    );
  });
});

describe('Audit log export query (DEC-74, DEC-131)', () => {
  it('takes the filters of the page and a format, csv or xlsx', () => {
    expect(AuditLogExportQuerySchema.parse({ format: 'xlsx', area: 'SPK' })).toEqual({
      format: 'xlsx',
      area: 'SPK',
    });
    expect(AuditLogExportQuerySchema.safeParse({ format: 'pdf' }).success).toBe(false);
    expect(AuditLogExportQuerySchema.safeParse({}).success).toBe(false);
  });

  it('refuses a From date after the To date, as the page does', () => {
    expect(
      AuditLogExportQuerySchema.safeParse({ format: 'csv', from: '2026-11-10', to: '2026-11-01' })
        .success,
    ).toBe(false);
  });
});

describe('Access history query (REQ-IAM-003, FLW-AM-05)', () => {
  it('pages like the Audit log', () => {
    expect(AccessHistoryQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });
});

describe('Self flag (BR-03, NFR-02)', () => {
  it('names a self-decision by its kind and leaves other rows empty', () => {
    expect(selfLabel({ selfDecision: true, action: 'approve' })).toBe('Self-approved');
    expect(selfLabel({ selfDecision: true, action: 'verify' })).toBe('Self-verified');
    expect(selfLabel({ selfDecision: false, action: 'approve' })).toBeNull();
  });
});
