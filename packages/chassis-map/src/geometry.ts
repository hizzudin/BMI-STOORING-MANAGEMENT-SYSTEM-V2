import { generatePositions, type AxleRole, type ChassisDefinition } from '@bmi/shared';

/**
 * REQ-PLC-008, DEC-119: the drawing of a layout, computed from its definition only (never per class).
 * Measures follow the Placement, PlacementTrailer and VehicleChassis artboards (DEC-96).
 */
export const MAP_WIDTH = 300;
const TYRE = { width: 22, height: 52 };
const SPARE_RADIUS = 21;
/** The gap to the axle before (DEC-119). */
export const AXLE_GAP = { Close: 66, Wide: 150 } as const;
/** The first axle of a unit with a cab or bumper; a trailer's axles sit behind a long body. */
const FIRST_AXLE_Y = 70;
const TRAILER_FIRST_AXLE_Y = 330;
const KINGPIN = { cx: 150, cy: 58, r: 9 };
const BOTTOM_MARGIN = 80;
/** Single tyres stand outside the frame; a dual pair sits on a shorter axle (artboards). */
const SINGLE = { tyreX: [50, 228], axleX: 68, axleWidth: 164, hubX: [78, 222] };
const DUAL = { tyreX: [50, 76, 202, 228], axleX: 94, axleWidth: 112, hubX: [104, 196] };
const SPARE_STEP = { x: 60, y: 50 };
const SPARES_PER_ROW = 3;

export const RAIL = { top: 24, x: [116, 173], width: 11 } as const;

export interface WheelShape {
  kind: 'Wheel';
  code: string;
  label: string;
  axleIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpareShape {
  kind: 'Spare';
  code: string;
  label: string;
  cx: number;
  cy: number;
  r: number;
}

export type TyreShape = WheelShape | SpareShape;

export interface AxleShape {
  index: number;
  role: AxleRole;
  y: number;
  x: number;
  width: number;
  hubX: readonly number[];
}

export interface ChassisGeometry {
  width: number;
  height: number;
  railBottom: number;
  crossmembers: number[];
  /** A bumper for a unit with a cab; a front crossbar and a kingpin for a trailer. */
  front: { kind: 'Bumper' } | { kind: 'Kingpin'; cx: number; cy: number; r: number };
  fifthWheel: { cx: number; cy: number; r: number } | null;
  axles: AxleShape[];
  tyres: TyreShape[];
}

/** Where the spares sit: the first gap they fit in (a trailer's front body counts), else behind the last axle. */
function spareRows(
  definition: ChassisDefinition,
  axleYs: number[],
): { centerY: number; extraHeight: number } {
  const rows = Math.ceil(definition.spareCount / SPARES_PER_ROW);
  const block = (rows - 1) * SPARE_STEP.y + 2 * SPARE_RADIUS;
  const gaps: [number, number][] = [];
  if (definition.frontDrawing === 'Kingpin') gaps.push([KINGPIN.cy, axleYs[0] ?? KINGPIN.cy]);
  for (let i = 1; i < axleYs.length; i += 1) gaps.push([axleYs[i - 1] ?? 0, axleYs[i] ?? 0]);
  // Room between the tyres of the two rows, with a little air on each side.
  const fits = gaps.find(([from, to]) => to - from - TYRE.height - 16 >= block);
  if (fits) return { centerY: (fits[0] + fits[1]) / 2, extraHeight: 0 };
  const last = axleYs[axleYs.length - 1] ?? FIRST_AXLE_Y;
  const top = last + TYRE.height / 2 + 20;
  return { centerY: top + block / 2, extraHeight: block + 20 };
}

export function chassisGeometry(definition: ChassisDefinition): ChassisGeometry {
  const positions = generatePositions(definition);
  const firstY = definition.frontDrawing === 'Kingpin' ? TRAILER_FIRST_AXLE_Y : FIRST_AXLE_Y;
  const axleYs: number[] = [];
  definition.axles.forEach((axle, index) => {
    const previous = axleYs[index - 1];
    axleYs.push(previous === undefined ? firstY : previous + AXLE_GAP[axle.spacing ?? 'Wide']);
  });

  const axles: AxleShape[] = definition.axles.map((axle, index) => {
    const frame = axle.tyresPerSide === 1 ? SINGLE : DUAL;
    return {
      index: index + 1,
      role: axle.role,
      y: axleYs[index] ?? firstY,
      x: frame.axleX,
      width: frame.axleWidth,
      hubX: frame.hubX,
    };
  });

  const spares = definition.spareCount > 0 ? spareRows(definition, axleYs) : null;
  const rowCount = Math.ceil(definition.spareCount / SPARES_PER_ROW);
  const tyres: TyreShape[] = [];
  for (const position of positions) {
    if (position.positionKind === 'Wheel') {
      const axleIndex = position.axleIndex ?? 1;
      const frame = definition.axles[axleIndex - 1]?.tyresPerSide === 1 ? SINGLE : DUAL;
      const onAxle = positions.filter((p) => p.axleIndex === axleIndex);
      tyres.push({
        kind: 'Wheel',
        code: position.code,
        label: position.label,
        axleIndex,
        x: frame.tyreX[onAxle.indexOf(position)] ?? 0,
        y: (axleYs[axleIndex - 1] ?? firstY) - TYRE.height / 2,
        ...TYRE,
      });
    } else if (spares) {
      const index = position.ordinal - 1;
      const row = Math.floor(index / SPARES_PER_ROW);
      const inRow = Math.min(SPARES_PER_ROW, definition.spareCount - row * SPARES_PER_ROW);
      const column = index % SPARES_PER_ROW;
      tyres.push({
        kind: 'Spare',
        code: position.code,
        label: position.label,
        cx: MAP_WIDTH / 2 + (column - (inRow - 1) / 2) * SPARE_STEP.x,
        cy: spares.centerY + (row - (rowCount - 1) / 2) * SPARE_STEP.y,
        r: SPARE_RADIUS,
      });
    }
  }

  const lastY = axleYs[axleYs.length - 1] ?? firstY;
  const height = lastY + BOTTOM_MARGIN + (spares?.extraHeight ?? 0);
  const railBottom = height - 30;
  const crossmembers: number[] = [];
  for (let y = 34; y <= railBottom - 26; y += 46) crossmembers.push(y);

  // A fifth wheel sits over the drive axles (artboards: between a tandem pair, on a single one).
  const driveYs = axles.filter((a) => a.role === 'Drive').map((a) => a.y);
  const couplingYs = driveYs.length > 0 ? driveYs : axles.slice(1).map((a) => a.y);
  const fifthY =
    couplingYs.length > 0 ? couplingYs.reduce((sum, y) => sum + y, 0) / couplingYs.length : lastY;

  return {
    width: MAP_WIDTH,
    height,
    railBottom,
    crossmembers,
    front:
      definition.frontDrawing === 'Kingpin' ? { kind: 'Kingpin', ...KINGPIN } : { kind: 'Bumper' },
    fifthWheel:
      definition.frontDrawing === 'Fifth_wheel' ? { cx: MAP_WIDTH / 2, cy: fifthY, r: 30 } : null,
    axles,
    tyres,
  };
}
