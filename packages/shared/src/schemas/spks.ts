import { z } from 'zod';
import {
  ASG_STATUSES,
  APPROVAL_ACTIONS,
  APPROVAL_STAGES,
  ROLES,
  SPK_CATEGORIES,
  SPK_SOURCES,
  SPK_STATUSES,
  VEHICLE_STATUSES,
} from '../enums/index.js';
import { UNIT_KINDS } from './vehicle-classes.js';

/** REQ-SPK-015, DEC-92: the urgency label of an SPK; Normal is the default. */
export const SPK_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;
export type SpkPriority = (typeof SPK_PRIORITIES)[number];

/** REQ-SPK-001, REQ-SPK-017, DEC-126: what may be done on one SPK (its `allowedActions`). */
export const SPK_ACTIONS = ['edit', 'submit', 'cancel', 'approverCancel'] as const;
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

/** REQ-SPK-010: the tabs of SPKList, in order. */
export const SPK_TABS = [
  'active',
  'mine',
  'draft',
  'pending',
  'rejected',
  'completed',
  'cancelled',
  'all',
] as const;
export type SpkTab = (typeof SPK_TABS)[number];

/** DEC-127: the page sizes SPKList offers; 20 is the default. */
export const SPK_PAGE_SIZES = [10, 20, 50, 100] as const;

/** REQ-SPK-010, DEC-127: tab, search, type and vehicle filters, and the page. */
export const SpkListQuerySchema = z.object({
  tab: z.enum(SPK_TABS).default('active'),
  search: z.string().trim().max(100).optional(),
  type: z.enum(SPK_CATEGORIES).optional(),
  vehicleId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((size) => (SPK_PAGE_SIZES as readonly number[]).includes(size), {
      error: 'Choose 10, 20, 50 or 100 per page.',
    })
    .default(20),
});
export type SpkListQuery = z.infer<typeof SpkListQuerySchema>;

/** REQ-SPK-010: one row of SPKList: the SPK, its current step and who it waits on. */
export const SpkListItemSchema = SpkSchema.extend({
  /** The first step that is not Verified or Skipped; null without steps or when all are done. */
  currentStep: z
    .object({ sequenceNo: z.number().int(), name: z.string(), status: z.enum(ASG_STATUSES) })
    .nullable(),
  /** A person (role and name), a role, or "Approvers"; null when nothing is waited on. */
  waitingOn: z.string().nullable(),
});
export type SpkListItem = z.infer<typeof SpkListItemSchema>;

/** REQ-SPK-010: the count of each tab under the same search, type and vehicle filters. */
export const SpkTabCountsSchema = z.object(
  Object.fromEntries(SPK_TABS.map((tab) => [tab, z.number().int()])) as Record<SpkTab, z.ZodNumber>,
);
export type SpkTabCounts = z.infer<typeof SpkTabCountsSchema>;

export const PaginationSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type Pagination = z.infer<typeof PaginationSchema>;

/** REQ-SPK-010, DEC-127: one page of SPKs with the tab counts, the vehicle filter and Create. */
export const SpkListResponseSchema = z.object({
  items: z.array(SpkListItemSchema),
  tabCounts: SpkTabCountsSchema,
  pagination: PaginationSchema,
  /** The vehicles that have an SPK: the options of the vehicle filter. */
  vehicles: z.array(z.object({ id: z.number().int(), licensePlate: z.string() })),
  allowedActions: z.array(z.enum(SPKS_PAGE_ACTIONS)),
});
export type SpkListResponse = z.infer<typeof SpkListResponseSchema>;

/** T2 and T5: Submit for approval at the version on screen. */
export const SpkSubmitRequestSchema = z.object({ version: z.number().int() });
export type SpkSubmitRequest = z.infer<typeof SpkSubmitRequestSchema>;

/** T6, DEC-129: the creator cancels its Draft or Rejected SPK with a reason, at the version on screen. */
export const SpkCancelRequestSchema = z.object({
  version: z.number().int(),
  reason: z.string().trim().min(1, 'Give a reason to cancel.').max(500),
});
export type SpkCancelRequest = z.infer<typeof SpkCancelRequestSchema>;

/** T15, DEC-140: an Approver cancels an open SPK with a reason, at the version on screen. */
export const SpkApproverCancelRequestSchema = SpkCancelRequestSchema;
export type SpkApproverCancelRequest = SpkCancelRequest;

/** A person as SPKDetail names them: "Planner Sari". */
export const PersonSchema = z.object({ name: z.string(), role: z.enum(ROLES).nullable() });

/** REQ-SPK-011, ui.md 7.5 StepCard: one step of the SPK. */
export const SpkDetailStepSchema = z.object({
  id: z.number().int(),
  sequenceNo: z.number().int(),
  name: z.string(),
  status: z.enum(ASG_STATUSES),
  executorRoles: z.array(z.enum(ROLES)),
  assignee: PersonSchema.nullable(),
  openedAt: z.string().nullable(),
  submittedAt: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  verifiedBy: PersonSchema.nullable(),
});
export type SpkDetailStep = z.infer<typeof SpkDetailStepSchema>;

/** REQ-SPK-011, ui.md 7.5 ApprovalBlock and the History tab: one row of spk_approvals. */
export const SpkDetailApprovalSchema = z.object({
  stage: z.enum(APPROVAL_STAGES),
  action: z.enum(APPROVAL_ACTIONS),
  by: PersonSchema,
  actedAt: z.string(),
  note: z.string().nullable(),
  selfApproved: z.boolean(),
});
export type SpkDetailApproval = z.infer<typeof SpkDetailApprovalSchema>;

/** REQ-SPK-011, DEC-127: what SPKDetail shows in phase 1. */
export const SpkDetailSchema = z.object({
  spk: SpkSchema,
  vehicle: z.object({
    id: z.number().int(),
    licensePlate: z.string(),
    className: z.string(),
    unitKind: z.enum(UNIT_KINDS),
    currentOdometer: z.number().int(),
  }),
  createdBy: PersonSchema,
  steps: z.array(SpkDetailStepSchema),
  approvals: z.array(SpkDetailApprovalSchema),
  /** Money as decimal strings (NUMERIC 14,2): labour, parts, document, stooring and their sum. */
  costs: z.object({
    labor: z.string(),
    parts: z.string(),
    document: z.string(),
    stooring: z.string(),
    total: z.string(),
  }),
});
export type SpkDetail = z.infer<typeof SpkDetailSchema>;

export const SpkDetailResponseSchema = z.object({ detail: SpkDetailSchema });
export type SpkDetailResponse = z.infer<typeof SpkDetailResponseSchema>;
