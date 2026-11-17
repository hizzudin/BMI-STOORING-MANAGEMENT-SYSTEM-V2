/** A signed link to put one object: the client sends exactly these headers and this many bytes. */
export interface SignedUpload {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface SignedDownload {
  url: string;
  expiresAt: Date;
}

/** One stored object, or null when there is none. */
export interface StoredObject {
  bytes: number;
  contentType: string;
}

/**
 * NFR-13, D-03, DEC-135: private object storage behind one port. Files are never deleted (BR-10)
 * and an existing key is never overwritten (REQ-FUP-008), so the port has no delete.
 */
export interface StoragePort {
  /** REQ-FUP-004: a link that accepts exactly this content type and size, for 15 minutes. */
  signUpload(key: string, file: { contentType: string; bytes: number }): Promise<SignedUpload>;
  /** NFR-13: a link that opens the file for 15 minutes. */
  signDownload(key: string): Promise<SignedDownload>;
  head(key: string): Promise<StoredObject | null>;
  read(key: string): Promise<Uint8Array>;
  /** Refuses a key that exists (`StorageOverwriteError`). */
  write(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** NFR-13: the bytes stored, for the daily budget check (TASK-133). */
  totalBytes(): Promise<number>;
}

export const STORAGE_MESSAGES = {
  overwrite: 'A stored file is never overwritten.',
  badLink: 'This link has expired or is not valid.',
  mismatch: 'The file does not match the signed link.',
  missing: 'The file does not exist.',
} as const;

/** REQ-FUP-008: an existing key; HTTP 409. */
export class StorageOverwriteError extends Error {
  constructor() {
    super(STORAGE_MESSAGES.overwrite);
    this.name = 'StorageOverwriteError';
  }
}

/** A link that is expired, forged or for another operation; HTTP 403. */
export class StorageLinkError extends Error {
  constructor() {
    super(STORAGE_MESSAGES.badLink);
    this.name = 'StorageLinkError';
  }
}

/** An upload of another type or size than signed; HTTP 400. */
export class StorageMismatchError extends Error {
  constructor() {
    super(STORAGE_MESSAGES.mismatch);
    this.name = 'StorageMismatchError';
  }
}

/** A key with no object; HTTP 404. */
export class StorageMissingError extends Error {
  constructor() {
    super(STORAGE_MESSAGES.missing);
    this.name = 'StorageMissingError';
  }
}

/** D-03: the adapter that serves its own signed links over HTTP (the filesystem adapter). */
export interface SignedLinkServer {
  acceptUpload(token: string, contentType: string, body: Uint8Array): Promise<void>;
  openDownload(token: string): Promise<{ body: Uint8Array; contentType: string }>;
}
