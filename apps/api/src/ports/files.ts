import type { ImageProfile, UploadProfileName } from '@bmi/shared';
import type { IdempotencyGateway } from './idempotency.js';

export type FileStatus = 'Pending' | 'Ready' | 'Rejected' | 'Expired';
export type CaptureSource = 'Camera' | 'Gallery' | 'File';

/** §9.12 stored_files. */
export interface StoredFileRow {
  id: number;
  storageKey: string;
  thumbKey: string | null;
  profile: UploadProfileName;
  mimeType: 'image/jpeg' | 'application/pdf';
  originalName: string | null;
  originalBytes: number | null;
  storedBytes: number | null;
  width: number | null;
  height: number | null;
  pageCount: number | null;
  sha256: string | null;
  capturedAt: Date | null;
  captureSource: CaptureSource | null;
  status: FileStatus;
  rejectReason: string | null;
  uploadedBy: number;
  attachedAt: Date | null;
  createdAt: Date;
  /** The uploader's name and role, for the file details (DEC-139). */
  uploaderName: string;
  uploaderRole: string | null;
}

export type NewStoredFile = Pick<
  StoredFileRow,
  | 'storageKey'
  | 'profile'
  | 'mimeType'
  | 'originalName'
  | 'originalBytes'
  | 'captureSource'
  | 'capturedAt'
  | 'uploadedBy'
> & { createdAt: Date };

export type ReadyFields = Pick<
  StoredFileRow,
  'thumbKey' | 'storedBytes' | 'width' | 'height' | 'pageCount' | 'sha256' | 'capturedAt'
>;

export interface FileGateway {
  insert(file: NewStoredFile): Promise<number>;
  /** `forUpdate` holds the row, so two runs of the same job do not interleave. */
  findById(id: number, options?: { forUpdate?: boolean }): Promise<StoredFileRow | null>;
  setReady(id: number, fields: ReadyFields): Promise<void>;
  setRejected(id: number, reason: string): Promise<void>;
  /** REQ-FUP-009: Pending or Rejected, never attached, created before `before`. */
  listExpirable(before: Date): Promise<StoredFileRow[]>;
  setExpired(id: number): Promise<void>;
}

export interface FileGateways {
  files: FileGateway;
  idempotency: IdempotencyGateway;
}

export interface ProcessedImage {
  bytes: Uint8Array;
  width: number;
  height: number;
  thumbnail: Uint8Array;
  /** The EXIF capture time, the only EXIF field kept (8.1 step 3). */
  capturedAt: Date | null;
}

/** REQ-FUP-003, REQ-FUP-005: the server finishes what the device may not have done (DEC-136). */
export interface MediaProcessor {
  image(
    bytes: Uint8Array,
    type: 'image/jpeg' | 'image/png' | 'image/heic',
    profile: ImageProfile,
  ): Promise<ProcessedImage>;
  pdfPageCount(bytes: Uint8Array): Promise<number>;
  pdfThumbnail(bytes: Uint8Array, longSide: number, quality: number): Promise<Uint8Array>;
}

/** REQ-FUP-005: one processing job per file; the job id is the file id, so a retry adds none. */
export interface FileJobs {
  enqueueProcessing(fileId: number): Promise<void>;
}
