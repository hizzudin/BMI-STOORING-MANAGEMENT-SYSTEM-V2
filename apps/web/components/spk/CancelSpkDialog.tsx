'use client';

import type { Spk, SpkCancelRequest } from '@bmi/shared';
import { useEffect, useId, useRef, useState } from 'react';
import type { SpksApi } from '../../lib/spks-api';
import { Button } from '../kit/Button';
import { Refusal } from '../kit/SidePanel';

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

type SendCancel = (body: SpkCancelRequest, key: string) => ReturnType<SpksApi['cancel']>;

/**
 * The cancel dialog of T6 and T15: a required reason over the same scrim as ConfirmDialog; the keep
 * button, Escape and the scrim close it unchanged (C-14).
 */
function CancelDialog({
  spk,
  note,
  keepLabel,
  send,
  onCancelled,
  onClose,
}: {
  spk: Spk;
  note: string;
  keepLabel: string;
  send: SendCancel;
  onCancelled: (spk: Spk) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const reasonId = useId();
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // NFR-01: a retry of the same cancel (same reason) sends the same key.
  const attempt = useRef<{ reason: string; key: string } | null>(null);
  useEffect(() => reasonRef.current?.focus(), []);

  const confirm = async () => {
    const text = reason.trim();
    if (attempt.current?.reason !== text) attempt.current = { reason: text, key: newKey() };
    setBusy(true);
    const outcome = await send({ version: spk.version, reason: text }, attempt.current.key);
    setBusy(false);
    if (outcome.ok) onCancelled(outcome.data.spk);
    else setError(outcome.message);
  };

  return (
    <div className="overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => event.key === 'Escape' && onClose()}
      >
        <h3 id={titleId}>{`Cancel ${spk.spkNumber}?`}</h3>
        <p className="muted">{note}</p>
        <div className="field">
          <label htmlFor={reasonId}>Reason</label>
          <textarea
            id={reasonId}
            ref={reasonRef}
            className="input"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
          />
        </div>
        <Refusal message={error} />
        <div className="bar">
          <Button onClick={onClose}>{keepLabel}</Button>
          <Button
            variant="danger"
            disabled={busy || reason.trim() === ''}
            onClick={() => void confirm()}
          >
            Cancel SPK
          </Button>
        </div>
      </div>
    </div>
  );
}

interface CancelDialogProps {
  spk: Spk;
  onCancelled: (spk: Spk) => void;
  onClose: () => void;
}

/** T6, DEC-129: the creator cancels its Draft or Rejected SPK with a required reason. */
export function CancelSpkDialog({
  api,
  ...props
}: CancelDialogProps & { api: Pick<SpksApi, 'cancel'> }) {
  return (
    <CancelDialog
      {...props}
      note="The SPK becomes Cancelled and leaves the open lists. Its number is never used again."
      keepLabel="Keep SPK"
      send={(body, key) => api.cancel(props.spk.id, body, key)}
    />
  );
}

/**
 * T15, DEC-140: the CancelSPK artboard for an Approver. Its SPK document link stays hidden until
 * TASK-212 builds the document (DEC-122).
 */
export function ApproverCancelDialog({
  api,
  ...props
}: CancelDialogProps & { api: Pick<SpksApi, 'approverCancel'> }) {
  return (
    <CancelDialog
      {...props}
      note="Posted issues are reversed first; Issued tyres return to stock. The creator and the executors are notified."
      keepLabel="Keep the SPK"
      send={(body, key) => api.approverCancel(props.spk.id, body, key)}
    />
  );
}
