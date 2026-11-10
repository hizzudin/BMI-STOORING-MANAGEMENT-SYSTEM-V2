import { describe, expect, it } from 'vitest';
import { VehicleClassRequestSchema } from './vehicle-classes.js';

const request = {
  code: 'Tractor_Head',
  name: ' Tractor head ',
  unitKind: 'Powered',
  definition: {
    frontDrawing: 'Fifth_wheel',
    spareCount: 1,
    axles: [
      { role: 'Steer', tyresPerSide: 1 },
      { role: 'Drive', tyresPerSide: 2, spacing: 'Wide' },
    ],
  },
} as const;

const issue = (body: unknown) =>
  VehicleClassRequestSchema.safeParse(body).error?.issues[0]?.message;

describe('DEC-120 a new vehicle class', () => {
  it('REQ-PLC-013 takes a typed code, a name, the unit kind and its first layout', () => {
    expect(VehicleClassRequestSchema.parse(request)).toMatchObject({
      code: 'Tractor_Head',
      name: 'Tractor head',
      unitKind: 'Powered',
    });
  });

  it('refuses a code with other characters, no name and an unknown unit kind', () => {
    expect(issue({ ...request, code: 'Tractor head' })).toBe(
      'Use letters, digits and underscores in the class code.',
    );
    expect(issue({ ...request, code: '' })).toBe('Enter a class code.');
    expect(issue({ ...request, code: 'X'.repeat(31) })).toBe(
      'A class code has at most 30 characters.',
    );
    expect(issue({ ...request, name: ' ' })).toBe('Enter a class name.');
    expect(issue({ ...request, name: 'n'.repeat(101) })).toBe(
      'A class name has at most 100 characters.',
    );
    expect(issue({ ...request, unitKind: 'Lifted' })).toBe('Choose Powered or Towed.');
  });

  it('DEC-120 the unit kind does not restrict the layout: a Towed class may carry any front drawing', () => {
    expect(VehicleClassRequestSchema.safeParse({ ...request, unitKind: 'Towed' }).success).toBe(
      true,
    );
  });
});
