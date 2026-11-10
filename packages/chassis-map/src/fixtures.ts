import { AXLE_ROLES, type ChassisDefinition } from '@bmi/shared';

/**
 * DEC-73: the launch layouts. They are test fixtures of the map; the System Admin creates the real
 * layouts as data (REQ-PLC-013), so these are never seeded from here.
 */
export const LAUNCH_LAYOUTS: Readonly<Record<string, ChassisDefinition>> = {
  'tractor-head': {
    frontDrawing: 'Fifth_wheel',
    spareCount: 1,
    axles: [
      { role: 'Steer', tyresPerSide: 1 },
      { role: 'Drive', tyresPerSide: 2, spacing: 'Wide' },
      { role: 'Drive', tyresPerSide: 2, spacing: 'Close' },
    ],
  },
  'trailer-tail-2-axles': {
    frontDrawing: 'Kingpin',
    spareCount: 2,
    axles: [
      { role: 'Trailer', tyresPerSide: 2 },
      { role: 'Trailer', tyresPerSide: 2, spacing: 'Close' },
    ],
  },
  'trailer-tail-3-axles': {
    frontDrawing: 'Kingpin',
    spareCount: 2,
    axles: [
      { role: 'Trailer', tyresPerSide: 2 },
      { role: 'Trailer', tyresPerSide: 2, spacing: 'Close' },
      { role: 'Trailer', tyresPerSide: 2, spacing: 'Close' },
    ],
  },
  'wingbox-rigid': {
    frontDrawing: 'None',
    spareCount: 0,
    axles: [
      { role: 'Steer', tyresPerSide: 1 },
      { role: 'Drive', tyresPerSide: 2, spacing: 'Wide' },
    ],
  },
  'pickup-patrol-hilux': {
    frontDrawing: 'None',
    spareCount: 1,
    axles: [
      { role: 'Steer', tyresPerSide: 1 },
      { role: 'Drive', tyresPerSide: 1, spacing: 'Wide' },
    ],
  },
  van: {
    frontDrawing: 'None',
    spareCount: 1,
    axles: [
      { role: 'Steer', tyresPerSide: 1 },
      { role: 'Drive', tyresPerSide: 1, spacing: 'Wide' },
    ],
  },
  /** AC-PLC-007: 3 Trailer axles of 2 tyres per side and 1 spare, a kingpin at the front. */
  'ac-plc-007-trailer-3-axles-1-spare': {
    frontDrawing: 'Kingpin',
    spareCount: 1,
    axles: [
      { role: 'Trailer', tyresPerSide: 2 },
      { role: 'Trailer', tyresPerSide: 2, spacing: 'Close' },
      { role: 'Trailer', tyresPerSide: 2, spacing: 'Close' },
    ],
  },
  /** AC-PLC-010: a class not in the launch list, a Powered 8x4 with no spare. */
  'ac-plc-010-powered-8x4': {
    frontDrawing: 'None',
    spareCount: 0,
    axles: [
      { role: 'Steer', tyresPerSide: 1 },
      { role: 'Steer', tyresPerSide: 1, spacing: 'Close' },
      { role: 'Drive', tyresPerSide: 2, spacing: 'Wide' },
      { role: 'Drive', tyresPerSide: 2, spacing: 'Close' },
    ],
  },
};

const FRONT_FOR = { Steer: 'None', Drive: 'Fifth_wheel', Trailer: 'Kingpin' } as const;

/**
 * DEC-73: generated layouts of 1 to 6 axles with every role, single or dual, and 0 to 2 spares. The first
 * gap is Wide and the rest Close, so both spacings are drawn.
 */
export function generatedLayouts(): { name: string; definition: ChassisDefinition }[] {
  const layouts: { name: string; definition: ChassisDefinition }[] = [];
  for (const role of AXLE_ROLES) {
    for (const tyresPerSide of [1, 2] as const) {
      for (let axleCount = 1; axleCount <= 6; axleCount += 1) {
        for (let spareCount = 0; spareCount <= 2; spareCount += 1) {
          layouts.push({
            name: `${role.toLowerCase()}-${tyresPerSide === 1 ? 'single' : 'dual'}-${axleCount}-axles-${spareCount}-spares`,
            definition: {
              frontDrawing: FRONT_FOR[role],
              spareCount,
              axles: Array.from({ length: axleCount }, (_, index) =>
                index === 0
                  ? { role, tyresPerSide }
                  : { role, tyresPerSide, spacing: index === 1 ? 'Wide' : 'Close' },
              ),
            },
          });
        }
      }
    }
  }
  return layouts;
}
