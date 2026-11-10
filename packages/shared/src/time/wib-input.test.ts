import { describe, expect, it } from 'vitest';
import { fromWibInput, wibInputValue } from './wib.js';

describe('NFR-14 a date-time field reads and writes WIB', () => {
  it('DEC-118 18:00 typed in WIB is 11:00 UTC, and back', () => {
    expect(fromWibInput('2026-11-11T18:00')?.toISOString()).toBe('2026-11-11T11:00:00.000Z');
    expect(wibInputValue(new Date('2026-11-11T11:00:00.000Z'))).toBe('2026-11-11T18:00');
  });

  it('an empty, unreadable or impossible field has no instant', () => {
    expect(fromWibInput('')).toBeNull();
    expect(fromWibInput('tomorrow')).toBeNull();
    expect(fromWibInput('2026-13-40T25:99')).toBeNull();
  });
});
