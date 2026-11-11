import { z } from 'zod';

/** DEC-121: what the System Admin may do on DocumentTypes (its `allowedActions`). */
export const DOCUMENT_TYPES_PAGE_ACTIONS = ['create', 'edit', 'deactivate'] as const;
export type DocumentTypesPageAction = (typeof DOCUMENT_TYPES_PAGE_ACTIONS)[number];

/** §9.4 an active document type with the classes that must have it. */
export const DocumentTypeSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  name: z.string(),
  usualValidityMonths: z.number().int().nullable(),
  warningDays: z.number().int(),
  receiptRequired: z.boolean(),
  classIds: z.array(z.number().int()),
});
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const DocumentTypeListResponseSchema = z.object({
  documentTypes: z.array(DocumentTypeSchema),
  /** The classes a type can be required for (§9.3). */
  classes: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      /** REQ-DOC-002, DEC-121: vehicles of the class that are not Inactive. */
      vehicleCount: z.number().int(),
    }),
  ),
  allowedActions: z.array(z.enum(DOCUMENT_TYPES_PAGE_ACTIONS)),
});
export type DocumentTypeListResponse = z.infer<typeof DocumentTypeListResponseSchema>;

export const DocumentTypeResponseSchema = z.object({ documentType: DocumentTypeSchema });
export type DocumentTypeResponse = z.infer<typeof DocumentTypeResponseSchema>;

const fields = {
  name: z
    .string()
    .trim()
    .min(1, { error: 'Enter a name.' })
    .max(100, { error: 'A name has at most 100 characters.' }),
  usualValidityMonths: z
    .number({ error: 'Give the usual validity in whole months.' })
    .int({ error: 'Give the usual validity in whole months.' })
    .min(1, { error: 'The usual validity is at least 1 month.' })
    .max(240, { error: 'The usual validity is at most 240 months.' })
    .nullable(),
  /** REQ-DOC-002: default 30; above 0. */
  warningDays: z
    .number({ error: 'Give the warning days as a whole number.' })
    .int({ error: 'Give the warning days as a whole number.' })
    .min(1, { error: 'Warning days are at least 1.' })
    .max(365, { error: 'Warning days are at most 365.' }),
  receiptRequired: z.boolean(),
  classIds: z
    .array(z.number().int())
    .refine((ids) => new Set(ids).size === ids.length, { error: 'Tick each class once.' }),
};

/** DEC-121: a type's editable fields; the code is fixed once saved. */
export const DocumentTypeUpdateRequestSchema = z.object(fields);
export type DocumentTypeUpdateRequest = z.infer<typeof DocumentTypeUpdateRequestSchema>;

/** C-31: New document type, with its code. */
export const DocumentTypeRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, { error: 'Enter a code.' })
    .max(30, { error: 'A code has at most 30 characters.' })
    .regex(/^[A-Za-z0-9_]+$/, { error: 'Use letters, digits and underscores in the code.' }),
  ...fields,
});
export type DocumentTypeRequest = z.infer<typeof DocumentTypeRequestSchema>;
