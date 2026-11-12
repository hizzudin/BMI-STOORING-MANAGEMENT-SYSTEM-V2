import { z } from 'zod';
import { SPK_CATEGORIES, SPK_SOURCES, SPK_STATUSES, VEHICLE_STATUSES } from '../enums/index.js';

/** REQ-SPK-015, DEC-92: the urgency label of an SPK; Normal is the default. */
export const SPK_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;
export type SpkPriority = (typeof SPK_PRIORITIES)[number];

/** REQ-SPK-001, REQ-SPK-017, DEC-126: what may be done on one SPK (its `allowedActions`). */
export const SPK_ACTIONS = ['edit', 'submit'] as const;
export type SpkAction = (typeof SPK_ACTIONS)[number];

export const SPKS_PAGE_ACTIONS = ['create'] as const;
export type SpksPageAction = (typeof SPKS_PAGE_ACTIONS)[number];

/** §9.6 an SPK as Create SPK shows it (the steps come with TASK-207). */
export const SpkSchema = z.object({
  id: z.number().int(),
  spkNumber: z.string(),
  vehicle: z.object({ id: z.number().int(), licensePlate: z.string(), className: z.string() }),
  title: z.string(),
  category: z.enum(SPK_CATEGORIES),
  priority: z.enum(SPK_PRIORITIES),
  requiresDowntime: z.boolean(),
  description: z.string(),
  requestSource: z.enum(SPK_SOURCES),
  status: z.enum(SPK_STATUSES),
  stepCount: z.number().int(),
  /** NFR-03: sent back with a save. */
  version: z.number().int(),
  allowedActions: z.array(z.enum(SPK_ACTIONS)),
});
export type Spk = z.infer<typeof SpkSchema>;

export const SpkResponseSchema = z.object({ spk: SpkSchema });
export type SpkResponse = z.infer<typeof SpkResponseSchema>;

/** REQ-SPK-013: the vehicles Create SPK offers (never an Inactive one). */
export const SpkFormOptionsResponseSchema = z.object({
  vehicles: z.array(
    z.object({
      id: z.number().int(),
      licensePlate: z.string(),
      className: z.string(),
      status: z.enum(VEHICLE_STATUSES),
    }),
  ),
  allowedActions: z.array(z.enum(SPKS_PAGE_ACTIONS)),
});
export type SpkFormOptionsResponse = z.infer<typeof SpkFormOptionsResponseSchema>;

const fields = {
  vehicleId: z.number({ error: 'Choose a vehicle.' }).int({ error: 'Choose a vehicle.' }),
  title: z
    .string()
    .trim()
    .min(1, { error: 'Enter a title.' })
    .max(150, { error: 'A title has at most 150 characters.' }),
  category: z.enum(SPK_CATEGORIES, { error: 'Choose a category.' }),
  priority: z.enum(SPK_PRIORITIES, { error: 'Choose an urgency.' }),
  requiresDowntime: z.boolean(),
  description: z.string().trim().min(1, { error: 'Enter a description.' }),
};

/** REQ-SPK-001, T1: the common fields of a new SPK (Save draft). */
export const SpkRequestSchema = z.object(fields);
export type SpkRequest = z.infer<typeof SpkRequestSchema>;

/** C-15: Save draft again, with the version it was read at (NFR-03). */
export const SpkUpdateRequestSchema = z.object({ ...fields, version: z.number().int() });
export type SpkUpdateRequest = z.infer<typeof SpkUpdateRequestSchema>;

/** T2 and T5: Submit for approval at the version on screen. */
export const SpkSubmitRequestSchema = z.object({ version: z.number().int() });
export type SpkSubmitRequest = z.infer<typeof SpkSubmitRequestSchema>;
