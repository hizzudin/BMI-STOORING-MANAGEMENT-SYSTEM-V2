import { z } from 'zod';
import { ROLES, SPK_CATEGORIES, SPK_STATUSES } from '../enums/index.js';
import { PersonSchema, SPK_PRIORITIES } from './spks.js';

/**
 * REQ-APR-002, DEC-128: the approval kinds the Surat Perintah Kerja tab lists. Phase 1 builds
 * Creation; Amendment (TASK-611) and Completion (TASK-210) add theirs.
 */
export const INBOX_KINDS = ['Creation'] as const;
export type InboxKind = (typeof INBOX_KINDS)[number];

/** C-24, C-25: what may be done on an item under review (its `allowedActions`). */
export const APPROVAL_REVIEW_ACTIONS = ['approve', 'reject'] as const;
export type ApprovalReviewAction = (typeof APPROVAL_REVIEW_ACTIONS)[number];

/** REQ-APR-007: the decisions History lists. */
export const APPROVAL_DECISION_ACTIONS = ['Approve', 'Reject'] as const;
export type ApprovalDecisionAction = (typeof APPROVAL_DECISION_ACTIONS)[number];

/** REQ-APR-002: the type chip and the search by SPK or plate. */
export const ApprovalInboxQuerySchema = z.object({
  kind: z.enum(INBOX_KINDS).optional(),
  search: z.string().trim().max(100).optional(),
});
export type ApprovalInboxQuery = z.infer<typeof ApprovalInboxQuerySchema>;

const VehicleRefSchema = z.object({
  id: z.number().int(),
  licensePlate: z.string(),
  className: z.string(),
});

/** REQ-APR-002, REQ-APR-004, DEC-128: one waiting item, with what its preview shows. */
export const ApprovalInboxItemSchema = z.object({
  spkId: z.number().int(),
  spkNumber: z.string(),
  priority: z.enum(SPK_PRIORITIES),
  vehicle: VehicleRefSchema,
  title: z.string(),
  category: z.enum(SPK_CATEGORIES),
  description: z.string(),
  kind: z.enum(INBOX_KINDS),
  requestedBy: PersonSchema,
  submittedAt: z.string(),
  /** DEC-128: computed when the list loads; the screen shows it as hh:mm:ss. */
  waitingSeconds: z.number().int(),
  /** REQ-APR-006: the System Admin's own item, which it may decide (Self-approved). */
  yours: z.boolean(),
  steps: z.array(
    z.object({
      sequenceNo: z.number().int(),
      name: z.string(),
      executorRoles: z.array(z.enum(ROLES)),
    }),
  ),
});
export type ApprovalInboxItem = z.infer<typeof ApprovalInboxItemSchema>;

export const ApprovalInboxResponseSchema = z.object({ items: z.array(ApprovalInboxItemSchema) });
export type ApprovalInboxResponse = z.infer<typeof ApprovalInboxResponseSchema>;

/** REQ-APR-001: the count beside the Approvals menu item. */
export const ApprovalCountResponseSchema = z.object({ count: z.number().int() });
export type ApprovalCountResponse = z.infer<typeof ApprovalCountResponseSchema>;

/** DEC-03, ui.md 7.5: a decision as its stamp shows it. */
export const ApprovalDecisionSchema = z.object({
  action: z.enum(APPROVAL_DECISION_ACTIONS),
  by: PersonSchema,
  at: z.string(),
  selfApproved: z.boolean(),
  reason: z.string().nullable(),
});
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

/** REQ-APR-004: the review page; a decided item shows its decision read only. */
export const ApprovalReviewSchema = ApprovalInboxItemSchema.extend({
  status: z.enum(SPK_STATUSES),
  /** NFR-03: sent back with the decision. */
  version: z.number().int(),
  decision: ApprovalDecisionSchema.nullable(),
  allowedActions: z.array(z.enum(APPROVAL_REVIEW_ACTIONS)),
});
export type ApprovalReview = z.infer<typeof ApprovalReviewSchema>;

export const ApprovalReviewResponseSchema = z.object({ review: ApprovalReviewSchema });
export type ApprovalReviewResponse = z.infer<typeof ApprovalReviewResponseSchema>;

/**
 * C-24, C-25: Approve or Reject at the version on screen. The reason is trimmed, so one of spaces
 * only is empty and the service refuses the rejection (AC-APR-004).
 */
export const ApprovalDecisionRequestSchema = z.object({
  version: z.number().int(),
  reason: z.string().trim().max(500).optional(),
});
export type ApprovalDecisionRequest = z.infer<typeof ApprovalDecisionRequestSchema>;

/** REQ-APR-007, DEC-128: the chips All, Approved and Rejected. */
export const ApprovalHistoryQuerySchema = z.object({
  decision: z.enum(APPROVAL_DECISION_ACTIONS).optional(),
});
export type ApprovalHistoryQuery = z.infer<typeof ApprovalHistoryQuerySchema>;

/** REQ-APR-007, DEC-128: one past decision of any Approver. */
export const ApprovalHistoryItemSchema = z.object({
  spkId: z.number().int(),
  spkNumber: z.string(),
  vehicle: VehicleRefSchema,
  kind: z.enum(INBOX_KINDS),
  decision: ApprovalDecisionSchema,
  requestedBy: PersonSchema,
});
export type ApprovalHistoryItem = z.infer<typeof ApprovalHistoryItemSchema>;

export const ApprovalHistoryResponseSchema = z.object({
  items: z.array(ApprovalHistoryItemSchema),
});
export type ApprovalHistoryResponse = z.infer<typeof ApprovalHistoryResponseSchema>;
