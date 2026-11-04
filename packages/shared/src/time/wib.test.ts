import { describe, expect, it } from 'vitest';
import { wibCalendarDay } from './wib.js';

describe('NFR-14 WIB calendar day', () => {
  it('NFR-14 a UTC instant before 17:00 stays on the same WIB day', () => {
    expect(wibCalendarDay(new Date('2026-11-04T16:59:59Z'))).toBe('2026-11-04');
  });

  it('NFR-14 a UTC instant from 17:00 falls on the next WIB day', () => {
    expect(wibCalendarDay(new Date('2026-11-04T17:00:00Z'))).toBe('2026-11-05');
  });

  it('NFR-14 the WIB day crosses a year boundary', () => {
    expect(wibCalendarDay(new Date('2026-12-31T17:30:00Z'))).toBe('2027-01-01');
  });
});
