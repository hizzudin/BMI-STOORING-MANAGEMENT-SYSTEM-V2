import {
  formatKm,
  generatePositions,
  type ChassisDefinition,
  type VehicleStatus,
} from '@bmi/shared';
import type { PositionStatus } from '@bmi/chassis-map';
import type { Tone } from '../kit/StatusPill';

/** 121.400 km (NFR-13 Indonesian number format). */
export const km = (value: number) => formatKm(value);

export const STATUS_TONES: Record<VehicleStatus, Tone> = {
  Active: 'success',
  Repair: 'warning',
  OFF: 'danger',
  Blocked: 'danger',
  Inactive: 'neutral',
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** REQ-VEH-002: "3 axles · 10 tyres + 1 spare", read only from the class layout. */
export function axlesAndTyres(layout: {
  axleCount: number;
  tyreCount: number;
  definition: ChassisDefinition;
}): string {
  const spares = layout.definition.spareCount;
  return `${plural(layout.axleCount, 'axle')} · ${plural(layout.tyreCount - spares, 'tyre')} + ${plural(spares, 'spare')}`;
}

/**
 * The map before any baseline: every position is Missing (no baseline recorded). The baseline
 * (TASK-511) and the mounted tyres (TASK-501) bring the other statuses.
 */
export function noBaseline(definition: ChassisDefinition): Record<string, PositionStatus> {
  return Object.fromEntries(generatePositions(definition).map((p) => [p.code, 'Missing' as const]));
}
