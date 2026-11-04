const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** The WIB calendar day of an instant as YYYY-MM-DD (NFR-14). WIB has no daylight saving. */
export function wibCalendarDay(instant: Date): string {
  return new Date(instant.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}
