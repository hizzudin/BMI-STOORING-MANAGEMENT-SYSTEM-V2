'use client';

import type { Spk } from '@bmi/shared';
import { useEffect, useId, useRef, useState } from 'react';
import type { SpksApi } from '../../lib/spks-api';
import { Button } from '../kit/Button';
import { Refusal } from '../kit/SidePanel';

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * T6, DEC-129: the creator cancels its Draft or Rejected SPK with a required reason, over the same
 * scrim as ConfirmDialog. Keep SPK, Escape and the scrim close it unchanged (C-14).
 */
export function CancelSpkDialog({
  api,
  spk,
  onCancelled,
  onClose,
}: {
  api: Pick<SpksApi, 'cancel'>;
  spk: Spk;
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
    const outcome = await api.cancel(
      spk.id,
      { version: spk.version, reason: text },
      attempt.current.key,
    );
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
        <p className="muted">
          The SPK becomes Cancelled and leaves the open lists. Its number is never used again.
        </p>
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
          <Button onClick={onClose}>Keep SPK</Button>
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
