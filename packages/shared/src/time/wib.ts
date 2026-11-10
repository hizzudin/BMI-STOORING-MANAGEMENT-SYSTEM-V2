const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export const WIB_TIME_ZONE = 'Asia/Jakarta';

/** The daily job runs at this WIB time (NFR-14). */
export const DAILY_JOB_WIB_TIME = '00:30';

/** The instant as ISO text shifted to WIB. WIB has no daylight saving. Throws RangeError on an invalid date. */
function wibIso(instant: Date): string {
  return new Date(instant.getTime() + WIB_OFFSET_MS).toISOString();
}

/** The WIB calendar day of an instant as YYYY-MM-DD (NFR-14). */
export function wibCalendarDay(instant: Date): string {
  return wibIso(instant).slice(0, 10);
}

/** A date as shown: YYYY-MM-DD on the WIB day (NFR-09, NFR-14). */
export function formatDateWib(instant: Date): string {
  return wibCalendarDay(instant);
}

/** A time as shown: HH:MM:SS in WIB (NFR-09, NFR-14). */
export function formatTimeWib(instant: Date): string {
  return wibIso(instant).slice(11, 19);
}

export function formatDateTimeWib(instant: Date): string {
  return `${formatDateWib(instant)} ${formatTimeWib(instant)}`;
}

/** The value of a datetime-local field showing the instant in WIB: YYYY-MM-DDTHH:MM (NFR-14). */
export function wibInputValue(instant: Date): string {
  return wibIso(instant).slice(0, 16);
}

/** The instant a datetime-local field means when it is read as WIB; null when empty or unreadable. */
export function fromWibInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const instant = new Date(`${value}:00+07:00`);
  return Number.isNaN(instant.getTime()) ? null : instant;
}
