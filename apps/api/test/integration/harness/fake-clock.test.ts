import { describe, expect, it } from 'vitest';
import { FakeClock } from './fake-clock.js';

describe('NFR-14 fake WIB clock', () => {
  it('NFR-14 is set in WIB and stores the instant in UTC', () => {
    const clock = FakeClock.atWib('2026-11-05 00:30');
    expect(clock.now().toISOString()).toBe('2026-11-04T17:30:00.000Z');
    expect(clock.wibToday()).toBe('2026-11-05');
  });

  it('NFR-14 moves to the next WIB day when advanced past WIB midnight', () => {
    const clock = FakeClock.atWib('2026-11-04 23:30');
    expect(clock.wibToday()).toBe('2026-11-04');
    clock.advanceMinutes(30);
    expect(clock.wibToday()).toBe('2026-11-05');
  });

  it('refuses a time that is not YYYY-MM-DD HH:mm', () => {
    expect(() => FakeClock.atWib('04/11/2026')).toThrow('YYYY-MM-DD HH:mm');
  });
});
