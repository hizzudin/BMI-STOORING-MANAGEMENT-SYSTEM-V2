import { wibCalendarDay } from '@bmi/shared';
import type { ClockPort } from '../../../src/ports/clock.js';

const WIB_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const MS_PER_MINUTE = 60_000;

export class FakeClock implements ClockPort {
  private constructor(private instant: Date) {}

  /** Tests state times the way the PRD does: `FakeClock.atWib('2026-11-05 00:30')`. */
  static atWib(time: string): FakeClock {
    if (!WIB_TIME.test(time)) throw new Error(`Expected YYYY-MM-DD HH:mm in WIB, got "${time}"`);
    return new FakeClock(new Date(`${time.replace(' ', 'T')}:00+07:00`));
  }

  now(): Date {
    return new Date(this.instant);
  }

  wibToday(): string {
    return wibCalendarDay(this.instant);
  }

  advanceMinutes(minutes: number): void {
    this.instant = new Date(this.instant.getTime() + minutes * MS_PER_MINUTE);
  }
}
