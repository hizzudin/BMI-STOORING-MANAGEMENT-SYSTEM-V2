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

/** REQ-SPK-010: SPK List query parameters. */
export const SpkListQuerySchema = z.object({
  tab: z.enum(['active', 'mine', 'draft', 'pending', 'rejected', 'completed', 'cancelled', 'all']).default('active'),
  search: z.string().optional(),
  type: z.enum(SPK_CATEGORIES).optional(),
  vehicleId: z.coerce.number().int().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type SpkListQuery = z.infer<typeof SpkListQuerySchema>;

/** REQ-SPK-010: SPK list item with current step and waiting-on info. */
export const SpkListItemSchema = SpkSchema.extend({
  currentStep: z.string().nullable(),
  waitingOn: z.string().nullable(),
});
export type SpkListItem = z.infer<typeof SpkListItemSchema>;

/** REQ-SPK-010: Tab counts for the 8 tabs. */
export const SpkTabCountsSchema = z.object({
  active: z.number().int(),
  mine: z.number().int(),
  draft: z.number().int(),
  pending: z.number().int(),
  rejected: z.number().int(),
  completed: z.number().int(),
  cancelled: z.number().int(),
  all: z.number().int(),
});
export type SpkTabCounts = z.infer<typeof SpkTabCountsSchema>;

/** REQ-SPK-010: SPK List response with items, tab counts, and pagination. */
export const SpkListResponseSchema = z.object({
  items: z.array(SpkListItemSchema),
  tabCounts: SpkTabCountsSchema,
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});
export type SpkListResponse = z.infer<typeof SpkListResponseSchema>;

/** T2 and T5: Submit for approval at the version on screen. */
export const SpkSubmitRequestSchema = z.object({ version: z.number().int() });
export type SpkSubmitRequest = z.infer<typeof SpkSubmitRequestSchema>;

/** Pagination schema for list endpoints. */
export const PaginationSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type Pagination = z.infer<typeof PaginationSchema>;