import { describe, expect, it } from 'vitest';
import {
  blankToNull,
  VehicleDeactivateRequestSchema,
  VehicleRequestSchema,
  VehicleUpdateRequestSchema,
} from './vehicles.js';

const add = {
  licensePlate: ' B 3301 KL ',
  vin: 'MHFAA8GS2N0123456',
  engineNumber: '',
  brand: 'Hino',
  model: 'FM 260 JD',
  year: 2022,
  fuelType: 'Diesel',
  vehicleClassId: 1,
  odometer: 12400,
};

const issue = (schema: { safeParse: (v: unknown) => unknown }, body: unknown) =>
  (schema.safeParse(body) as { error?: { issues: { message: string }[] } }).error?.issues[0]
    ?.message;

describe('REQ-VEH-002 REQ-VEH-003 the vehicle requests', () => {
  it('REQ-VEH-002 a new vehicle: trimmed plate; an empty optional field means not given', () => {
    expect(VehicleRequestSchema.parse({ ...add, brand: '  ' })).toEqual({
      ...add,
      licensePlate: 'B 3301 KL',
      brand: '',
    });
    expect(blankToNull('')).toBeNull();
    expect(blankToNull('Hino')).toBe('Hino');
    expect(VehicleRequestSchema.parse({ ...add, odometer: null, year: null }).odometer).toBeNull();
  });

  it('refuses no plate, a long field, a bad year, no class and a negative odometer', () => {
    expect(issue(VehicleRequestSchema, { ...add, licensePlate: ' ' })).toBe('Enter the plate.');
    expect(issue(VehicleRequestSchema, { ...add, licensePlate: 'B'.repeat(21) })).toBe(
      'A plate has at most 20 characters.',
    );
    expect(issue(VehicleRequestSchema, { ...add, fuelType: 'f'.repeat(21) })).toBe(
      'A fuel type has at most 20 characters.',
    );
    expect(issue(VehicleRequestSchema, { ...add, year: 1900 })).toBe('The year is 1950 or later.');
    expect(issue(VehicleRequestSchema, { ...add, year: 2101 })).toBe(
      'The year is 2100 or earlier.',
    );
    expect(issue(VehicleRequestSchema, { ...add, vehicleClassId: undefined })).toBe(
      'Choose a class.',
    );
    expect(issue(VehicleRequestSchema, { ...add, odometer: -1 })).toBe(
      'The odometer is 0 km or more.',
    );
  });

  it('REQ-VEH-003 REQ-VEH-004 an edit and a deactivation need a reason', () => {
    const { odometer: _odometer, ...edit } = add;
    expect(issue(VehicleUpdateRequestSchema, { ...edit, reason: ' ', version: 1 })).toBe(
      'Give a reason.',
    );
    expect(VehicleUpdateRequestSchema.parse({ ...edit, reason: 'Typo', version: 3 }).version).toBe(
      3,
    );
    expect(issue(VehicleDeactivateRequestSchema, { reason: '' })).toBe('Give a reason.');
    expect(issue(VehicleDeactivateRequestSchema, { reason: 'r'.repeat(501) })).toBe(
      'A reason has at most 500 characters.',
    );
  });
});
