import { z } from 'zod';
import { VEHICLE_STATUSES } from '../enums/index.js';
import { ChassisDefinitionSchema } from './chassis-layout.js';
import { UNIT_KINDS } from './vehicle-classes.js';

/** REQ-VEH-003, REQ-VEH-004: what may be done on one vehicle (its `allowedActions`). */
export const VEHICLE_ACTIONS = ['edit', 'change_class', 'deactivate'] as const;
export type VehicleAction = (typeof VEHICLE_ACTIONS)[number];

export const VEHICLES_PAGE_ACTIONS = ['create'] as const;
export type VehiclesPageAction = (typeof VEHICLES_PAGE_ACTIONS)[number];

const VehicleLayoutSchema = z.object({
  id: z.number().int(),
  version: z.number().int(),
  definition: ChassisDefinitionSchema,
  axleCount: z.number().int(),
  tyreCount: z.number().int(),
});

/** A class the vehicle form offers, with its current layout (REQ-VEH-002: counts read from it). */
export const VehicleClassOptionSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  unitKind: z.enum(UNIT_KINDS),
  layout: VehicleLayoutSchema,
});
export type VehicleClassOption = z.infer<typeof VehicleClassOptionSchema>;

/** §9.3 a vehicle with its class and the layout version it uses. */
export const VehicleSchema = z.object({
  id: z.number().int(),
  licensePlate: z.string(),
  vin: z.string().nullable(),
  engineNumber: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  year: z.number().int().nullable(),
  fuelType: z.string().nullable(),
  vehicleClass: z.object({ id: z.number().int(), name: z.string(), unitKind: z.enum(UNIT_KINDS) }),
  layout: VehicleLayoutSchema,
  /** REQ-PLC-018: 0 and never shown for a Towed unit. */
  currentOdometer: z.number().int(),
  status: z.enum(VEHICLE_STATUSES),
  deactivateReason: z.string().nullable(),
  /** NFR-03: sent back with an edit. */
  version: z.number().int(),
  /** Why the class cannot change now (REQ-VEH-003, DEC-17), or null. */
  classLock: z.string().nullable(),
  allowedActions: z.array(z.enum(VEHICLE_ACTIONS)),
});
export type Vehicle = z.infer<typeof VehicleSchema>;

export const VehicleListResponseSchema = z.object({
  vehicles: z.array(VehicleSchema),
  /** The classes the form offers; empty for a reader without vehicle.manage. */
  classes: z.array(VehicleClassOptionSchema),
  allowedActions: z.array(z.enum(VEHICLES_PAGE_ACTIONS)),
});
export type VehicleListResponse = z.infer<typeof VehicleListResponseSchema>;

export const VehicleResponseSchema = z.object({ vehicle: VehicleSchema });
export type VehicleResponse = z.infer<typeof VehicleResponseSchema>;

/** The API stores an empty text as null (no transform here: the contract stays JSON Schema). */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} has at most ${max} characters.` })
    .nullable();

/** REQ-VEH-002: an empty optional text means "not given". */
export const blankToNull = (value: string | null): string | null =>
  value === null || value === '' ? null : value;

const fields = {
  licensePlate: z
    .string()
    .trim()
    .min(1, { error: 'Enter the plate.' })
    .max(20, { error: 'A plate has at most 20 characters.' }),
  vin: optionalText(30, 'A VIN'),
  engineNumber: optionalText(30, 'An engine number'),
  brand: optionalText(50, 'A brand'),
  model: optionalText(50, 'A model'),
  year: z
    .number({ error: 'Give the year as a number.' })
    .int({ error: 'Give the year as a number.' })
    .min(1950, { error: 'The year is 1950 or later.' })
    .max(2100, { error: 'The year is 2100 or earlier.' })
    .nullable(),
  /** DEC-122: free text. */
  fuelType: optionalText(20, 'A fuel type'),
  vehicleClassId: z.number({ error: 'Choose a class.' }).int({ error: 'Choose a class.' }),
};

/** REQ-VEH-002: a new vehicle; the odometer is asked for a Powered unit only (REQ-PLC-018). */
export const VehicleRequestSchema = z.object({
  ...fields,
  odometer: z
    .number({ error: 'Give the odometer in whole km.' })
    .int({ error: 'Give the odometer in whole km.' })
    .min(0, { error: 'The odometer is 0 km or more.' })
    .nullable(),
});
export type VehicleRequest = z.infer<typeof VehicleRequestSchema>;

const ReasonSchema = z
  .string()
  .trim()
  .min(1, { error: 'Give a reason.' })
  .max(500, { error: 'A reason has at most 500 characters.' });

/** REQ-VEH-003: an edit with a required reason and the version it was read at (NFR-03). */
export const VehicleUpdateRequestSchema = z.object({
  ...fields,
  reason: ReasonSchema,
  version: z.number().int(),
});
export type VehicleUpdateRequest = z.infer<typeof VehicleUpdateRequestSchema>;

/** REQ-VEH-004: deactivate with a reason. */
export const VehicleDeactivateRequestSchema = z.object({ reason: ReasonSchema });
export type VehicleDeactivateRequest = z.infer<typeof VehicleDeactivateRequestSchema>;
