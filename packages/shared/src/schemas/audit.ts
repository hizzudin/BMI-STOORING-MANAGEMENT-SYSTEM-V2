import { z } from 'zod';
import { ROLES } from '../enums/index.js';
import { PaginationSchema, SPK_PAGE_SIZES } from './spks.js';

/** DEC-131: the Area filter of the Audit log; a later task adds its area here. */
export const AUDIT_AREAS = ['SPK', 'Access', 'Vehicles', 'Settings'] as const;
export type AuditArea = (typeof AUDIT_AREAS)[number];

/** DEC-131: the Audit log pages like SPKList (DEC-127). */
export const AUDIT_PAGE_SIZES = SPK_PAGE_SIZES;

/** DEC-131: without a date filter the page shows the last 7 WIB days, today included. */
export const AUDIT_DEFAULT_DAYS = 7;

/** DEC-131: one export holds at most this many rows, so a large export never blocks the API. */
export const AUDIT_EXPORT_MAX_ROWS = 10_000;

/** DEC-74: the Audit log exports as csv or xlsx. */
export const AUDIT_EXPORT_FORMATS = ['csv', 'xlsx'] as const;
export type AuditExportFormat = (typeof AUDIT_EXPORT_FORMATS)[number];

export const AUDIT_MESSAGES = {
  dateFormat: 'Enter a date as YYYY-MM-DD.',
  dateOrder: 'The From date must be on or before the To date.',
  pageSize: 'Choose 10, 20, 50 or 100 per page.',
  exportTooLarge: 'Narrow the filters to export at most 10,000 rows.',
  notFound: 'This audit record does not exist.',
} as const;

const wibDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: AUDIT_MESSAGES.dateFormat });

const page = z.coerce.number().int().positive().default(1);
const pageSize = z.coerce
  .number()
  .int()
  .refine((size) => (AUDIT_PAGE_SIZES as readonly number[]).includes(size), {
    error: AUDIT_MESSAGES.pageSize,
  })
  .default(20);

/** The filters of the page; the dates are WIB calendar days (NFR-14). */
const filterShape = {
  userId: z.coerce.number().int().positive().optional(),
  area: z.enum(AUDIT_AREAS).optional(),
  from: wibDate.optional(),
  to: wibDate.optional(),
};

const datesInOrder = (filter: { from?: string | undefined; to?: string | undefined }) =>
  !filter.from || !filter.to || filter.from <= filter.to;
const dateOrder = { error: AUDIT_MESSAGES.dateOrder, path: ['to'] };

/** REQ-IAM-007, DEC-131: the filters and the page of the Audit log. */
export const AuditLogQuerySchema = z
  .object({ ...filterShape, page, pageSize })
  .refine(datesInOrder, dateOrder);
export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;

/** DEC-74, DEC-131: the export takes the filters of the page and a format. */
export const AuditLogExportQuerySchema = z
  .object({ ...filterShape, format: z.enum(AUDIT_EXPORT_FORMATS) })
  .refine(datesInOrder, dateOrder);
export type AuditLogExportQuery = z.infer<typeof AuditLogExportQuerySchema>;
export type AuditLogFilter = Omit<AuditLogExportQuery, 'format'>;

/** BR-03, NFR-02: the Self column; a verification is Self-verified, any other decision Self-approved. */
export function selfLabel(row: { selfDecision: boolean; action: string }): string | null {
  if (!row.selfDecision) return null;
  return row.action.startsWith('verify') ? 'Self-verified' : 'Self-approved';
}

const AuditUserSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  role: z.enum(ROLES).nullable(),
});

/** REQ-IAM-007: one row of the Audit log; `user` is null when the system itself acted. */
export const AuditLogItemSchema = z.object({
  id: z.number().int(),
  at: z.string(),
  user: AuditUserSchema.nullable(),
  area: z.string(),
  entity: z.string(),
  entityId: z.number().int(),
  record: z.string(),
  action: z.string(),
  /** DEC-131: a short summary of what changed; the status when the record has one. */
  before: z.string().nullable(),
  after: z.string().nullable(),
  self: z.string().nullable(),
  reason: z.string().nullable(),
});
export type AuditLogItem = z.infer<typeof AuditLogItemSchema>;

export const AuditLogResponseSchema = z.object({
  items: z.array(AuditLogItemSchema),
  pagination: PaginationSchema,
  /** The dates the page shows: the filter, or the last 7 days without one. */
  range: z.object({ from: z.string(), to: z.string() }),
  /** The options of the User filter: everyone who has an audit record. */
  users: z.array(z.object({ id: z.number().int(), name: z.string() })),
});
export type AuditLogResponse = z.infer<typeof AuditLogResponseSchema>;

/** DEC-131: the panel of one row: the full before and after and the reason. */
export const AuditLogDetailSchema = z.object({
  item: AuditLogItemSchema,
  before: z.unknown(),
  after: z.unknown(),
});
export type AuditLogDetail = z.infer<typeof AuditLogDetailSchema>;

/** REQ-IAM-003, FLW-AM-05: the Access history tab pages like the Audit log. */
export const AccessHistoryQuerySchema = z.object({ page, pageSize });
export type AccessHistoryQuery = z.infer<typeof AccessHistoryQuerySchema>;

/** One access change: when, who (null when the system acted) and what changed. */
export const AccessHistoryItemSchema = z.object({
  id: z.number().int(),
  at: z.string(),
  who: z.string().nullable(),
  what: z.string(),
});
export type AccessHistoryItem = z.infer<typeof AccessHistoryItemSchema>;

export const AccessHistoryResponseSchema = z.object({
  items: z.array(AccessHistoryItemSchema),
  pagination: PaginationSchema,
});
export type AccessHistoryResponse = z.infer<typeof AccessHistoryResponseSchema>;
