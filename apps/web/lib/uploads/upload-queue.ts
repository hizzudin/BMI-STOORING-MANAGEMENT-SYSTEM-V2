import type {
  StoredFile,
  StoredFileResponse,
  UploadLinkRequest,
  UploadLinkResponse,
  UploadProfileName,
} from '@bmi/shared';
import type { Outcome } from '../auth-api';
import type { Prepared } from './prepare';

export const UPLOAD_MESSAGES = {
  notSent: 'This file was not sent. Retry, or remove it.',
  expired: 'This file expired before it was used. Remove it and add it again.',
} as const;

/** REQ-FUP-007: the only three states a thumbnail shows. */
export type UserState = 'progress' | 'done' | 'attention';

export interface UploadItem {
  localId: string;
  slot: string;
  profile: UploadProfileName;
  name: string;
  originalBytes: number;
  /** A local preview while the file travels (REQ-FUP-012), or null (HEIC, PDF). */
  preview: string | null;
  state: UserState;
  /** The one sentence of a file that needs attention. */
  message: string | null;
  /** Retry is offered only when sending again can help. */
  retryable: boolean;
  /** The server's file once the link was given; Ready when the state is done. */
  file: StoredFile | null;
}

export interface QueueDeps {
  prepare(file: File, profile: UploadProfileName): Promise<Prepared>;
  requestLink(body: UploadLinkRequest, key: string): Promise<Outcome<UploadLinkResponse>>;
  /** The PUT straight to storage (REQ-FUP-004); false when it did not land. */
  put(upload: UploadLinkResponse['upload'], blob: Blob): Promise<boolean>;
  markUploaded(id: number, key: string): Promise<Outcome<StoredFileResponse>>;
  get(id: number): Promise<Outcome<StoredFileResponse>>;
  wait(ms: number): Promise<void>;
  newKey(): string;
  previewOf(file: File): string | null;
}

/** REQ-FUP-013: up to 3 retries with growing waits. */
const RETRY_WAITS_MS = [1000, 2000, 4000];
const POLL_MS = 2000;
/** About three minutes of checks before the file is left to a Retry. */
const MAX_POLLS = 90;
const BAD_REQUEST = 400;

interface Entry {
  item: UploadItem;
  source: File;
  prepared: Extract<Prepared, { ok: true }> | null;
  linkKey: string;
  markKey: string;
  upload: UploadLinkResponse['upload'] | null;
  landed: boolean;
  removed: boolean;
}

interface PendingSubmit {
  slots: readonly string[];
  submit: () => unknown;
}

type Sent = 'sent' | 'retry' | { refused: string };

/**
 * DEC-139: one queue for the whole web app, so uploads and a pending Submit go on when the user
 * moves to another screen. It knows nothing of React; `subscribe` and `snapshot` feed the UI.
 */
export class UploadQueue {
  private readonly entries: Entry[] = [];
  private pending: PendingSubmit[] = [];
  private readonly listeners = new Set<() => void>();
  private current: readonly UploadItem[] = [];
  private sequence = 0;

  constructor(private readonly deps: QueueDeps) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The same array until something changes (for useSyncExternalStore). */
  snapshot(): readonly UploadItem[] {
    return this.current;
  }

  items(slot: string): UploadItem[] {
    return this.current.filter((item) => item.slot === slot);
  }

  /** The Ready files of a slot, for the form to save (8.1 step 7). */
  readyIds(slot: string): number[] {
    return this.items(slot).flatMap((item) =>
      item.state === 'done' && item.file ? [item.file.id] : [],
    );
  }

  add(slot: string, profile: UploadProfileName, files: readonly File[]): void {
    for (const source of files) {
      this.sequence += 1;
      const entry: Entry = {
        item: {
          localId: `upload-${this.sequence}`,
          slot,
          profile,
          name: source.name,
          originalBytes: source.size,
          preview: this.deps.previewOf(source),
          state: 'progress',
          message: null,
          retryable: false,
          file: null,
        },
        source,
        prepared: null,
        linkKey: this.deps.newKey(),
        markKey: this.deps.newKey(),
        upload: null,
        landed: false,
        removed: false,
      };
      this.entries.push(entry);
      void this.run(entry);
    }
    this.changed();
  }

  retry(localId: string): void {
    const entry = this.find(localId);
    if (!entry?.item.retryable || entry.item.state !== 'attention') return;
    this.update(entry, { state: 'progress', message: null, retryable: false });
    void this.run(entry);
  }

  remove(localId: string): void {
    const index = this.entries.findIndex((entry) => entry.item.localId === localId);
    if (index < 0) return;
    const [entry] = this.entries.splice(index, 1);
    if (entry) entry.removed = true;
    this.changed();
  }

  /** REQ-FUP-013: the browser is back online; every file that could not be sent goes again. */
  online(): void {
    for (const entry of [...this.entries]) this.retry(entry.item.localId);
  }

  /** REQ-FUP-006: `submit` runs once, by itself, when every file of these slots is done. */
  submitWhenReady(slots: readonly string[], submit: () => unknown): void {
    this.pending.push({ slots, submit });
    this.changed();
  }

  /** True while a Submit of these slots waits for its files ("Sending when photos finish…"). */
  isWaiting(slots: readonly string[]): boolean {
    return this.pending.some((pending) => pending.slots.some((slot) => slots.includes(slot)));
  }

  private find(localId: string): Entry | undefined {
    return this.entries.find((entry) => entry.item.localId === localId);
  }

  private async run(entry: Entry): Promise<void> {
    if (!entry.prepared) {
      const prepared = await this.deps.prepare(entry.source, entry.item.profile);
      if (entry.removed) return;
      if (!prepared.ok) {
        this.update(entry, { state: 'attention', message: prepared.reason, retryable: false });
        return;
      }
      entry.prepared = prepared;
    }

    let sent: Sent = 'retry';
    for (let attempt = 0; attempt <= RETRY_WAITS_MS.length; attempt += 1) {
      if (attempt > 0) await this.deps.wait(RETRY_WAITS_MS[attempt - 1] ?? 0);
      if (entry.removed) return;
      sent = await this.sendOnce(entry, entry.prepared);
      if (sent !== 'retry') break;
    }
    if (entry.removed) return;
    if (sent === 'retry') {
      this.update(entry, { state: 'attention', message: UPLOAD_MESSAGES.notSent, retryable: true });
      return;
    }
    if (typeof sent === 'object') {
      this.update(entry, { state: 'attention', message: sent.refused, retryable: false });
      return;
    }
    await this.poll(entry);
  }

  /** One try of steps 4 and 5 and the uploaded signal; each part is done only once. */
  private async sendOnce(entry: Entry, prepared: Extract<Prepared, { ok: true }>): Promise<Sent> {
    if (!entry.upload) {
      const link = await this.deps.requestLink(
        {
          profile: entry.item.profile,
          contentType: prepared.contentType,
          bytes: prepared.blob.size,
          originalBytes: entry.item.originalBytes,
          originalName: entry.item.name,
          captureSource: 'File',
          capturedAt: prepared.capturedAt,
        },
        entry.linkKey,
      );
      if (!link.ok) return link.status === BAD_REQUEST ? { refused: link.message } : 'retry';
      entry.upload = link.data.upload;
      this.update(entry, { file: link.data.file });
    }
    if (!entry.landed) {
      if (!(await this.deps.put(entry.upload, prepared.blob))) return 'retry';
      entry.landed = true;
    }
    const fileId = entry.item.file?.id;
    if (fileId === undefined) return 'retry';
    const marked = await this.deps.markUploaded(fileId, entry.markKey);
    return marked.ok ? 'sent' : 'retry';
  }

  /** 8.1 step 6 runs on the server; the queue waits for Ready or Rejected. */
  private async poll(entry: Entry): Promise<void> {
    const fileId = entry.item.file?.id;
    if (fileId === undefined) return;
    for (let check = 0; check < MAX_POLLS; check += 1) {
      const answer = await this.deps.get(fileId);
      if (entry.removed) return;
      if (answer.ok) {
        const file = answer.data.file;
        if (file.status === 'Ready') {
          this.update(entry, { state: 'done', file, message: null });
          return;
        }
        if (file.status === 'Rejected' || file.status === 'Expired') {
          const message = file.rejectReason ?? UPLOAD_MESSAGES.expired;
          this.update(entry, { state: 'attention', file, message, retryable: false });
          return;
        }
      }
      await this.deps.wait(POLL_MS);
    }
    this.update(entry, { state: 'attention', message: UPLOAD_MESSAGES.notSent, retryable: true });
  }

  private update(entry: Entry, change: Partial<UploadItem>): void {
    if (entry.removed) return;
    entry.item = { ...entry.item, ...change };
    this.changed();
  }

  private changed(): void {
    this.current = this.entries.map((entry) => entry.item);
    const ready = this.pending.filter((pending) =>
      this.entries
        .filter((entry) => pending.slots.includes(entry.item.slot))
        .every((entry) => entry.item.state === 'done'),
    );
    this.pending = this.pending.filter((pending) => !ready.includes(pending));
    for (const listener of this.listeners) listener();
    for (const pending of ready) pending.submit();
  }
}
