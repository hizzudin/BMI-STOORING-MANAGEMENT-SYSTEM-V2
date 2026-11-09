import { wibCalendarDay } from '@bmi/shared';
import type { ClockPort } from '../../ports/clock.js';

/** The real clock; tests use FakeClock. */
export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }

  wibToday(): string {
    return wibCalendarDay(new Date());
  }
}
