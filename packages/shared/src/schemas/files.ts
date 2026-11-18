import { z } from 'zod';

/** 8.1 upload profiles (REQ-FUP-001). */
export const UPLOAD_PROFILE_NAMES = ['Photo', 'Document', 'PDF'] as const;
export const FILE_STATUSES = ['Pending', 'Ready', 'Rejected', 'Expired'] as const;
export const CAPTURE_SOURCES = ['Camera', 'Gallery', 'File'] as const;

export const FILE_NOT_FOUND = 'This file does not exist.';

/** REQ-FUP-004: what the device asks for before it uploads (step 4 of the 8.1 pipeline). */
export const UploadLinkRequestSchema = z.object({
  profile: z.enum(UPLOAD_PROFILE_NAMES, { error: 'Choose Photo, Document or PDF.' }),
  contentType: z.string().trim().min(1).max(100),
  bytes: z.number().int().positive(),
  originalName: z.string().trim().max(255).nullable(),
  captureSource: z.enum(CAPTURE_SOURCES).nullable(),
  /** §9.12 original_bytes: the size before the browser compressed it (DEC-139). */
  originalBytes: z.number().int().positive().optional(),
  /** DEC-139: read in the browser before compression drops the EXIF data. */
  capturedAt: z.iso.datetime().nullable().optional(),
});
export type UploadLinkRequest = z.infer<typeof UploadLinkRequestSchema>;

/** REQ-FUP-007: the detail panel shows sizes and the technical state; links only when Ready. */
export const StoredFileSchema = z.object({
  id: z.number().int(),
  profile: z.enum(UPLOAD_PROFILE_NAMES),
  status: z.enum(FILE_STATUSES),
  rejectReason: z.string().nullable(),
  originalName: z.string().nullable(),
  originalBytes: z.number().int().nullable(),
  storedBytes: z.number().int().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  pageCount: z.number().int().nullable(),
  capturedAt: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  fileUrl: z.string().nullable(),
  /** REQ-FUP-016: the details of PhotoViewer (DEC-139). */
  uploadedBy: z.object({ name: z.string(), role: z.string().nullable() }),
  uploadedAt: z.string(),
});
export type StoredFile = z.infer<typeof StoredFileSchema>;

export const StoredFileResponseSchema = z.object({ file: StoredFileSchema });
export type StoredFileResponse = z.infer<typeof StoredFileResponseSchema>;

export const UploadLinkResponseSchema = z.object({
  file: StoredFileSchema,
  upload: z.object({
    url: z.string(),
    method: z.literal('PUT'),
    headers: z.record(z.string(), z.string()),
    expiresAt: z.string(),
  }),
});
export type UploadLinkResponse = z.infer<typeof UploadLinkResponseSchema>;
