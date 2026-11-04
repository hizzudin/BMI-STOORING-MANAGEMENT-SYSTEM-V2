/** "Now" and the WIB calendar day (NFR-14); tests use a fake clock (design.md §7). */
export interface ClockPort {
  now(): Date;
  wibToday(): string;
}
