'use client';

import type { UploadProfileName } from '@bmi/shared';
import { useEffect, useRef, useState } from 'react';
import { formatFileSize } from '../../lib/uploads/format';
import type { UploadItem, UserState } from '../../lib/uploads/upload-queue';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { useUploadQueue, useUploads } from './UploadProvider';

/** REQ-FUP-007: the words a screen reader hears for the three states; never sizes or steps. */
const STATE_WORDS: Record<UserState, string> = {
  progress: 'in progress',
  done: 'done',
  attention: 'needs attention',
};
const STATE_CLASS: Record<UserState, string> = { progress: 'run', done: 'ok', attention: 'bad' };
const ACCEPT: Record<UploadProfileName, string> = {
  Photo: 'image/jpeg,image/png,image/heic,image/heif,.heic,.heif',
  Document: 'image/jpeg,image/png,image/heic,image/heif,.heic,.heif',
  PDF: 'application/pdf',
};

export interface FileDropProps {
  slot: string;
  profile: UploadProfileName;
  title: string;
  /** REQ-FUP-014: the screen asks once before leaving while a file is still uploading. */
  onUploadingChange?: (uploading: boolean) => void;
}

function Thumbnail({ item }: { item: UploadItem }) {
  // REQ-FUP-012: the local copy until the server's thumbnail is Ready.
  const source = (item.state === 'done' && item.file?.thumbnailUrl) || item.preview;
  if (source) return <img src={source} alt="" />;
  return <Icon name={item.profile === 'PDF' ? 'documents' : 'camera'} />;
}

function DetailPanel({ item, onClose }: { item: UploadItem; onClose: () => void }) {
  const queue = useUploadQueue();
  const file = item.file?.status === 'Ready' ? item.file : null;
  const stored =
    file?.storedBytes == null
      ? '—'
      : [
          formatFileSize(file.storedBytes),
          file.width && file.height ? `${file.width} × ${file.height}` : null,
          file.pageCount ? `${file.pageCount} pages` : null,
        ]
          .filter(Boolean)
          .join(' · ');
  return (
    <section className="card" aria-label="Detail panel">
      <h3>
        <span className="circle-ic">
          <Icon name="eye" />
        </span>
        Detail panel
      </h3>
      <div className="row">
        <div className="grow">Original</div>
        <span>{formatFileSize(item.originalBytes)}</span>
      </div>
      <div className="row">
        <div className="grow">Stored</div>
        <span>{stored}</span>
      </div>
      <div className="row">
        <div className="grow">Profile</div>
        <span>{item.profile}</span>
      </div>
      {item.message ? (
        <p className="refusal" role="alert">
          {item.message}
        </p>
      ) : null}
      <div className="bar">
        {item.state === 'attention' && item.retryable ? (
          <Button onClick={() => queue.retry(item.localId)}>Retry</Button>
        ) : null}
        <Button
          onClick={() => {
            queue.remove(item.localId);
            onClose();
          }}
        >
          Remove
        </Button>
      </div>
    </section>
  );
}

/**
 * FileDrop (FileUploadStates, 7.5): one upload slot with one profile. A picked file shows at once
 * and is checked, compressed and uploaded in the background (REQ-FUP-012); its thumbnail shows only
 * three states (REQ-FUP-007), and sizes appear only in the detail panel (AC-FUP-009).
 */
export function FileDrop({ slot, profile, title, onUploadingChange }: FileDropProps) {
  const queue = useUploadQueue();
  const items = useUploads().filter((item) => item.slot === slot);
  const [selected, setSelected] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const uploading = items.some((item) => item.state === 'progress');
  const chosen = items.find((item) => item.localId === selected) ?? null;

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);

  const add = (files: FileList | null | undefined) => {
    if (files && files.length > 0) queue.add(slot, profile, Array.from(files));
  };

  return (
    <div className="grid g2 file-drop">
      <div className="card white">
        <h3>
          <span className="circle-ic">
            <Icon name="camera" />
          </span>
          {title}
        </h3>
        {items.length > 0 ? (
          <ul className="thumbs" aria-label={`${title} files`}>
            {items.map((item) => (
              <li key={item.localId}>
                <button
                  type="button"
                  className="thumb"
                  aria-label={`${item.name}, ${STATE_WORDS[item.state]}`}
                  aria-pressed={selected === item.localId}
                  onClick={() => setSelected(item.localId)}
                >
                  <Thumbnail item={item} />
                  <span className={`st ${STATE_CLASS[item.state]}`} aria-hidden="true">
                    {item.state === 'done' ? <Icon name="check" size={12} /> : null}
                    {item.state === 'attention' ? <Icon name="close" size={12} /> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          className="drop"
          onClick={() => input.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            add(event.dataTransfer.files);
          }}
        >
          <Icon name="upload" /> Drop photos or PDF, or take a photo
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept={ACCEPT[profile]}
          aria-label={`Add files to ${title}`}
          onChange={(event) => {
            add(event.target.files);
            event.target.value = '';
          }}
        />
        <p className="small muted">
          Compression, upload and retries run in the background; Submit sends when the photos
          finish.
        </p>
      </div>
      {chosen ? <DetailPanel item={chosen} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

export interface SubmitWhenReadyProps {
  slots: readonly string[];
  label: string;
  onSubmit: () => unknown;
}

/**
 * REQ-FUP-006, C-18: Submit while files are on their way shows "Sending when photos finish…" and
 * the screen's submit runs by itself, once, when every file of its slots is Ready.
 */
export function SubmitWhenReady({ slots, label, onSubmit }: SubmitWhenReadyProps) {
  const queue = useUploadQueue();
  useUploads();
  const waiting = queue.isWaiting(slots);
  return (
    <Button
      variant="primary"
      disabled={waiting}
      aria-busy={waiting}
      onClick={() => queue.submitWhenReady(slots, onSubmit)}
    >
      {waiting ? 'Sending when photos finish…' : label}
    </Button>
  );
}
