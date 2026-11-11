import { z } from 'zod';
import { ChassisDefinitionSchema } from './chassis-layout.js';

/** DEC-68: Powered (head, rigid, pickup, van) or Towed (trailer tail). */
export const UNIT_KINDS = ['Powered', 'Towed'] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

/** DEC-120: what the System Admin may do on ChassisLayouts (its `allowedActions`). */
export const VEHICLE_CLASSES_PAGE_ACTIONS = ['create', 'new_layout_version'] as const;
export type VehicleClassesPageAction = (typeof VEHICLE_CLASSES_PAGE_ACTIONS)[number];

/** §9.3 a class with its default layout version. */
export const VehicleClassSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  name: z.string(),
  unitKind: z.enum(UNIT_KINDS),
  layout: z.object({
    id: z.number().int(),
    code: z.string(),
    version: z.number().int(),
    definition: ChassisDefinitionSchema,
    axleCount: z.number().int(),
    tyreCount: z.number().int(),
    /** DEC-120: vehicles that use this layout version. */
    vehicleCount: z.number().int(),
  }),
});
export type VehicleClass = z.infer<typeof VehicleClassSchema>;

export const VehicleClassListResponseSchema = z.object({
  classes: z.array(VehicleClassSchema),
  allowedActions: z.array(z.enum(VEHICLE_CLASSES_PAGE_ACTIONS)),
});
export type VehicleClassListResponse = z.infer<typeof VehicleClassListResponseSchema>;

export const VehicleClassResponseSchema = z.object({ vehicleClass: VehicleClassSchema });
export type VehicleClassResponse = z.infer<typeof VehicleClassResponseSchema>;

/** DEC-120: New class: a typed code, a name, the unit kind and its first layout. */
export const VehicleClassRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, { error: 'Enter a class code.' })
    .max(30, { error: 'A class code has at most 30 characters.' })
    .regex(/^[A-Za-z0-9_]+$/, { error: 'Use letters, digits and underscores in the class code.' }),
  name: z
    .string()
    .trim()
    .min(1, { error: 'Enter a class name.' })
    .max(100, { error: 'A class name has at most 100 characters.' }),
  unitKind: z.enum(UNIT_KINDS, { error: 'Choose Powered or Towed.' }),
  definition: ChassisDefinitionSchema,
});
export type VehicleClassRequest = z.infer<typeof VehicleClassRequestSchema>;

/** DEC-120: Save as new layout version. */
export const LayoutVersionRequestSchema = z.object({ definition: ChassisDefinitionSchema });
export type LayoutVersionRequest = z.infer<typeof LayoutVersionRequestSchema>;
