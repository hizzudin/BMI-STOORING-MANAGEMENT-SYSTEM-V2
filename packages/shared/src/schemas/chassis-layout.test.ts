import { describe, expect, it } from 'vitest';
import {
  ChassisDefinitionSchema,
  generatePositions,
  layoutCounts,
  type ChassisDefinition,
} from './chassis-layout.js';

const trailer3: ChassisDefinition = {
  frontDrawing: 'Kingpin',
  spareCount: 1,
  axles: [
    { role: 'Trailer', tyresPerSide: 2 },
    { role: 'Trailer', tyresPerSide: 2, spacing: 'Close' },
    { role: 'Trailer', tyresPerSide: 2, spacing: 'Close' },
  ],
};

describe('REQ-PLC-017 DEC-119 a chassis layout definition and its positions', () => {
  it('AC-PLC-007 a Towed layout of 3 dual Trailer axles and 1 spare has 13 positions, A1_LO to A3_RO and SP1', () => {
    const positions = generatePositions(trailer3);
    expect(positions).toHaveLength(13);
    expect(positions.map((p) => p.code)).toEqual([
      'A1_LO',
      'A1_LI',
      'A1_RI',
      'A1_RO',
      'A2_LO',
      'A2_LI',
      'A2_RI',
      'A2_RO',
      'A3_LO',
      'A3_LI',
      'A3_RI',
      'A3_RO',
      'SP1',
    ]);
    expect(positions[0]).toEqual({
      code: 'A1_LO',
      positionKind: 'Wheel',
      axleIndex: 1,
      side: 'Left',
      ordinal: 1,
      label: 'Axle 1 left outer',
    });
    expect(positions[2]).toMatchObject({ code: 'A1_RI', side: 'Right', ordinal: 2 });
    expect(positions[12]).toEqual({
      code: 'SP1',
      positionKind: 'Spare',
      axleIndex: null,
      side: null,
      ordinal: 1,
      label: 'Spare 1',
    });
    expect(layoutCounts(trailer3)).toEqual({ axleCount: 3, tyreCount: 13 });
  });

  it('AC-PLC-010 a Powered 8x4 (Steer, Steer, Drive dual, Drive dual, no spare) has 12 positions', () => {
    const positions = generatePositions({
      frontDrawing: 'None',
      spareCount: 0,
      axles: [
        { role: 'Steer', tyresPerSide: 1 },
        { role: 'Steer', tyresPerSide: 1, spacing: 'Close' },
        { role: 'Drive', tyresPerSide: 2, spacing: 'Wide' },
        { role: 'Drive', tyresPerSide: 2, spacing: 'Close' },
      ],
    });
    expect(positions.map((p) => p.code)).toEqual([
      'A1_L',
      'A1_R',
      'A2_L',
      'A2_R',
      'A3_LO',
      'A3_LI',
      'A3_RI',
      'A3_RO',
      'A4_LO',
      'A4_LI',
      'A4_RI',
      'A4_RO',
    ]);
    expect(positions[1]).toMatchObject({ label: 'Axle 1 right', ordinal: 1 });
  });

  it('AC-PLC-009 a layout with 0 spares has no spare position', () => {
    const rigid = generatePositions({
      frontDrawing: 'None',
      spareCount: 0,
      axles: [
        { role: 'Steer', tyresPerSide: 1 },
        { role: 'Drive', tyresPerSide: 2, spacing: 'Wide' },
      ],
    });
    expect(rigid.filter((p) => p.positionKind === 'Spare')).toEqual([]);
  });

  it('DEC-119 a definition: at least one axle, roles, one or two tyres per side, spacing after the first axle', () => {
    const issue = (body: unknown) =>
      ChassisDefinitionSchema.safeParse(body).error?.issues[0]?.message;
    expect(ChassisDefinitionSchema.parse(trailer3)).toEqual(trailer3);
    expect(issue({ ...trailer3, axles: [] })).toBe('Add at least one axle.');
    expect(issue({ ...trailer3, spareCount: -1 })).toBe('Spares are 0 or more.');
    expect(issue({ ...trailer3, axles: [{ role: 'Lift', tyresPerSide: 2 }] })).toBeDefined();
    expect(issue({ ...trailer3, axles: [{ role: 'Trailer', tyresPerSide: 3 }] })).toBeDefined();
    expect(
      issue({
        ...trailer3,
        axles: [
          { role: 'Trailer', tyresPerSide: 2 },
          { role: 'Trailer', tyresPerSide: 2 },
        ],
      }),
    ).toBe('Give each axle after the first a spacing, Close or Wide.');
    expect(
      issue({ ...trailer3, axles: [{ role: 'Trailer', tyresPerSide: 2, spacing: 'Wide' }] }),
    ).toBe('The first axle has no spacing.');
  });
});
