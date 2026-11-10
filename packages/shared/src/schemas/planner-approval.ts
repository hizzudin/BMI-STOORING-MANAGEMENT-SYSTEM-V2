import { z } from 'zod';

/** REQ-IAM-008, DEC-48: the approval kinds the Access Manager ticks when switching Planner approval on. */
export const APPROVAL_KINDS = [
  'spk_creation',
  'spk_amendment',
  'spk_completion',
  'stock_opname',
  'tyre_count',
] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

export const APPROVAL_KIND_LABELS: Readonly<Record<ApprovalKind, string>> = {
  spk_creation: 'SPK creation',
  spk_amendment: 'SPK amendment',
  spk_completion: 'SPK completion',
  stock_opname: 'Stock opname',
  tyre_count: 'Tyre count',
};

/** DEC-118: what the Access Manager may do on the switch now (its `allowedActions`). */
export const PLANNER_APPROVAL_ACTIONS = ['switch_on', 'change', 'switch_off'] as const;
export type PlannerApprovalAction = (typeof PLANNER_APPROVAL_ACTIONS)[number];

export const PlannerApprovalResponseSchema = z.object({
  on: z.boolean(),
  kinds: z.array(z.enum(APPROVAL_KINDS)),
  /** ISO end time, or null: on until switched off. */
  until: z.string().nullable(),
  allowedActions: z.array(z.enum(PLANNER_APPROVAL_ACTIONS)),
});
export type PlannerApprovalResponse = z.infer<typeof PlannerApprovalResponseSchema>;

const ReasonSchema = z.string().trim().min(1, { error: 'Give a reason.' }).max(500);

/** DEC-118: Switch on or Change: the ticked kinds, an optional end time and a reason. */
export const PlannerApprovalRequestSchema = z.object({
  kinds: z
    .array(z.enum(APPROVAL_KINDS))
    .min(1, { error: 'Tick at least one approval kind.' })
    .refine((kinds) => new Set(kinds).size === kinds.length, { error: 'Tick each kind once.' }),
  until: z.iso
    .datetime({ offset: true, error: 'Give the end time as a date and time.' })
    .nullable(),
  reason: ReasonSchema,
});
export type PlannerApprovalRequest = z.infer<typeof PlannerApprovalRequestSchema>;

export const PlannerApprovalOffRequestSchema = z.object({ reason: ReasonSchema });
export type PlannerApprovalOffRequest = z.infer<typeof PlannerApprovalOffRequestSchema>;
