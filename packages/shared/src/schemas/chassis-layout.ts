import { z } from 'zod';

/** DEC-68: the fleet has no lift axles, so an axle is Steer, Drive or Trailer. */
export const AXLE_ROLES = ['Steer', 'Drive', 'Trailer'] as const;
export type AxleRole = (typeof AXLE_ROLES)[number];

/** REQ-PLC-017: what is drawn at the front: nothing, a fifth wheel (tractor head) or a kingpin (trailer). */
export const FRONT_DRAWINGS = ['None', 'Fifth_wheel', 'Kingpin'] as const;
export type FrontDrawing = (typeof FRONT_DRAWINGS)[number];

/** DEC-119: the gap to the axle before: Close (a tandem pair) or Wide. */
export const AXLE_SPACINGS = ['Close', 'Wide'] as const;
export type AxleSpacing = (typeof AXLE_SPACINGS)[number];

const AxleSchema = z.object({
  role: z.enum(AXLE_ROLES),
  tyresPerSide: z.union([z.literal(1), z.literal(2)]),
  spacing: z.enum(AXLE_SPACINGS).optional(),
});

/** §9.3 chassis_layouts.definition (REQ-PLC-017, DEC-119): axles from the front, the front drawing, spares. */
export const ChassisDefinitionSchema = z
  .object({
    frontDrawing: z.enum(FRONT_DRAWINGS),
    spareCount: z.number().int().min(0, { error: 'Spares are 0 or more.' }),
    axles: z.array(AxleSchema).min(1, { error: 'Add at least one axle.' }),
  })
  .superRefine((definition, context) => {
    definition.axles.forEach((axle, index) => {
      if (index === 0 && axle.spacing !== undefined) {
        context.addIssue({
          code: 'custom',
          path: ['axles', 0, 'spacing'],
          message: 'The first axle has no spacing.',
        });
      }
      if (index > 0 && axle.spacing === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['axles', index, 'spacing'],
          message: 'Give each axle after the first a spacing, Close or Wide.',
        });
      }
    });
  });
export type ChassisDefinition = z.infer<typeof ChassisDefinitionSchema>;

/** One §9.3 part_positions row, before it has an id. */
export interface GeneratedPosition {
  code: string;
  positionKind: 'Wheel' | 'Spare';
  axleIndex: number | null;
  side: 'Left' | 'Right' | null;
  /** 1 outer, 2 inner on a dual axle; 1 on a single one; the spare's number. */
  ordinal: number;
  label: string;
}

const SINGLE = [
  { place: 'L', side: 'Left', ordinal: 1, words: 'left' },
  { place: 'R', side: 'Right', ordinal: 1, words: 'right' },
] as const;
const DUAL = [
  { place: 'LO', side: 'Left', ordinal: 1, words: 'left outer' },
  { place: 'LI', side: 'Left', ordinal: 2, words: 'left inner' },
  { place: 'RI', side: 'Right', ordinal: 2, words: 'right inner' },
  { place: 'RO', side: 'Right', ordinal: 1, words: 'right outer' },
] as const;

/**
 * REQ-PLC-017, DEC-119: the positions a layout generates when it is saved, front to back and left to right:
 * A<axle>_L / A<axle>_R on a single axle, A<axle>_LO, _LI, _RI, _RO on a dual one, then SP1, SP2 and on.
 */
export function generatePositions(definition: ChassisDefinition): GeneratedPosition[] {
  const wheels = definition.axles.flatMap((axle, index) =>
    (axle.tyresPerSide === 1 ? SINGLE : DUAL).map((wheel) => ({
      code: `A${index + 1}_${wheel.place}`,
      positionKind: 'Wheel' as const,
      axleIndex: index + 1,
      side: wheel.side,
      ordinal: wheel.ordinal,
      label: `Axle ${index + 1} ${wheel.words}`,
    })),
  );
  const spares = Array.from({ length: definition.spareCount }, (_, index) => ({
    code: `SP${index + 1}`,
    positionKind: 'Spare' as const,
    axleIndex: null,
    side: null,
    ordinal: index + 1,
    label: `Spare ${index + 1}`,
  }));
  return [...wheels, ...spares];
}

/** chassis_layouts.axle_count and tyre_count; the tyre count includes the spares (REQ-PLC-019). */
export function layoutCounts(definition: ChassisDefinition): {
  axleCount: number;
  tyreCount: number;
} {
  return { axleCount: definition.axles.length, tyreCount: generatePositions(definition).length };
}
