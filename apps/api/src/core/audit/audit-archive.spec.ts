import { describe, expect, it } from 'vitest';
import { archiveCutoff, wibMonthRange } from './audit-archive.js';

describe('audit archive months (NFR-17, DEC-138)', () => {
  it('DEC-138 the cutoff is the WIB start of the run month minus 12 months', () => {
    expect(archiveCutoff('2027-12-01')).toEqual(new Date('2026-12-01T00:00:00+07:00'));
    expect(archiveCutoff('2026-11-01')).toEqual(new Date('2025-11-01T00:00:00+07:00'));
    expect(archiveCutoff('2027-01-01')).toEqual(new Date('2026-01-01T00:00:00+07:00'));
  });

  it('DEC-138 a WIB month runs from its first day 00:00 WIB to the next month', () => {
    expect(wibMonthRange('2025-10')).toEqual({
      from: new Date('2025-10-01T00:00:00+07:00'),
      to: new Date('2025-11-01T00:00:00+07:00'),
    });
    expect(wibMonthRange('2025-12')).toEqual({
      from: new Date('2025-12-01T00:00:00+07:00'),
      to: new Date('2026-01-01T00:00:00+07:00'),
    });
  });
});
