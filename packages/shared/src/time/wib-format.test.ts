import { describe, expect, it } from 'vitest';
import {
  DAILY_JOB_WIB_TIME,
  formatDateTimeWib,
  formatDateWib,
  formatTimeWib,
  WIB_TIME_ZONE,
} from './wib.js';

describe('NFR-14 NFR-09 WIB dates and times', () => {
  it('NFR-14 the shown time zone is Asia/Jakarta', () => {
    expect(WIB_TIME_ZONE).toBe('Asia/Jakarta');
  });

  it('NFR-14 the daily job runs at 00:30 WIB', () => {
    expect(DAILY_JOB_WIB_TIME).toBe('00:30');
  });

  it('NFR-09 a date shows as YYYY-MM-DD on the WIB day', () => {
    expect(formatDateWib(new Date('2026-11-04T17:00:00Z'))).toBe('2026-11-05');
  });

  it('NFR-09 a time shows as HH:MM:SS in WIB', () => {
    expect(formatTimeWib(new Date('2026-11-04T17:00:05Z'))).toBe('00:00:05');
    expect(formatTimeWib(new Date('2026-11-04T01:02:03Z'))).toBe('08:02:03');
  });

  it('NFR-09 a date and time show together', () => {
    expect(formatDateTimeWib(new Date('2026-11-02T23:42:00Z'))).toBe('2026-11-03 06:42:00');
  });

  it('NFR-14 agrees with Intl for Asia/Jakarta', () => {
    const instant = new Date('2026-03-15T19:20:30Z');
    const intl = new Intl.DateTimeFormat('sv-SE', {
      timeZone: WIB_TIME_ZONE,
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(instant);
    expect(formatDateTimeWib(instant)).toBe(intl);
  });

  it('NFR-14 refuses an invalid date', () => {
    expect(() => formatDateTimeWib(new Date('nonsense'))).toThrow(RangeError);
  });
});
