'use client';

import {
  BACK_TO_SETUP_PHRASE,
  formatDateTimeWib,
  GO_LIVE_PHRASE,
  type SystemModeResponse,
} from '@bmi/shared';
import { useEffect, useId, useRef, useState } from 'react';
import type { Outcome } from '../../lib/auth-api';
import type { SystemModeApi } from '../../lib/system-mode-api';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { Refusal } from '../kit/SidePanel';
import { PageHead } from '../shell/AppShell';

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * SetupGoLive (REQ-IAM-010, DEC-132): in Setup, the checklist of what is in the system and Go live;
 * in Live, Back to Setup. Each switch asks for a reason and the typed phrase.
 */
export function SetupGoLive({ api, onSwitched }: { api: SystemModeApi; onSwitched: () => void }) {
  const [status, setStatus] = useState<SystemModeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let current = true;
    void api.status().then((outcome) => {
      if (!current) return;
      if (outcome.ok) setStatus(outcome.data);
      else setError(outcome.message);
    });
    return () => {
      current = false;
    };
  }, [api]);

  const setup = status?.mode === 'Setup';
  const crumb = !status
    ? undefined
    : setup
      ? 'Setup mode'
      : status.wentLiveAt
        ? `Live since ${formatDateTimeWib(new Date(status.wentLiveAt)).slice(0, 16)}`
        : 'Live';
  const action = status?.allowedActions[0];

  return (
    <>
      <PageHead
        title="Setup and go live"
        {...(crumb ? { crumb } : {})}
        actions={
          action === 'go_live' ? (
            <Button variant="primary" onClick={() => setSwitching(true)}>
              Go live
            </Button>
          ) : action === 'back_to_setup' ? (
            <Button variant="danger" onClick={() => setSwitching(true)}>
              Back to Setup
            </Button>
          ) : null
        }
      />
      <Refusal message={error} />
      {!status && !error && <p className="muted">Loading…</p>}
      {status && setup && (
        <>
          <ol className="steps" aria-label="Checklist">
            {status.checklist.map((item, index) => (
              <li
                key={item.key}
                className={item.count > 0 ? 's done' : 's'}
                aria-label={`${item.label}: ${item.count}`}
              >
                <span className="n">
                  {item.count > 0 ? <span aria-hidden="true">✓</span> : index + 1}
                </span>
                {item.label}
                <small>{item.count}</small>
              </li>
            ))}
          </ol>
          <div className="note warn">
            <Icon name="lock" size={16} />
            <div>
              Only the System Admin and Access Managers can sign in while the system is in Setup
              mode.
            </div>
          </div>
        </>
      )}
      {status && !setup && (
        <div className="note">
          <Icon name="lock" size={16} />
          <div>
            The system is Live. Going back to Setup signs out everyone except the System Admin and
            Access Managers until the system goes live again.
          </div>
        </div>
      )}
      {switching && action === 'go_live' && (
        <SwitchDialog
          title="Go live?"
          body="Everyone can sign in, approvals start, and opening balance and bulk import close until the system goes back to Setup."
          phrase={GO_LIVE_PHRASE}
          confirmLabel="Go live"
          send={(body, key) => api.goLive(body, key)}
          onClose={() => setSwitching(false)}
          onDone={onSwitched}
        />
      )}
      {switching && action === 'back_to_setup' && (
        <SwitchDialog
          title="Back to Setup mode?"
          body="Everyone except the System Admin and Access Managers is signed out at once and cannot sign in until the system goes live again. Approvals stop; opening balance and bulk import open again."
          phrase={BACK_TO_SETUP_PHRASE}
          confirmLabel="Back to Setup"
          send={(body, key) => api.backToSetup(body, key)}
          onClose={() => setSwitching(false)}
          onDone={onSwitched}
        />
      )}
    </>
  );
}

/** GoLiveConfirm and BackToSetupConfirm: a reason and the phrase typed exactly (DEC-132). */
function SwitchDialog({
  title,
  body,
  phrase,
  confirmLabel,
  send,
  onClose,
  onDone,
}: {
  title: string;
  body: string;
  phrase: string;
  confirmLabel: string;
  send: (
    body: { reason: string; confirmation: string },
    key: string,
  ) => Promise<Outcome<SystemModeResponse>>;
  onClose: () => void;
  onDone: () => void;
}) {
  const titleId = useId();
  const reasonId = useId();
  const phraseId = useId();
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  // NFR-01: one key for this switch, so a retry after a lost answer cannot switch twice.
  const key = useRef(newKey());
  const ready = reason.trim() !== '' && typed.trim() === phrase && !busy;

  const confirm = async () => {
    setBusy(true);
    const outcome = await send({ reason, confirmation: typed }, key.current);
    setBusy(false);
    if (!outcome.ok) {
      setRefusal(outcome.message);
      return;
    }
    onDone();
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
        <h3 id={titleId}>{title}</h3>
        <p className="muted">{body}</p>
        <div className="field">
          <label htmlFor={reasonId}>Reason</label>
          <textarea
            id={reasonId}
            className="input"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={phraseId}>Type {phrase} to confirm</label>
          <input
            id={phraseId}
            className="input"
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        <Refusal message={refusal} />
        <div className="bar">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={!ready} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
