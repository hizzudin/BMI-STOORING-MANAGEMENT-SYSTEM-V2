'use client';

import type { ApprovalReview as Review, ApprovalReviewAction } from '@bmi/shared';
import { useEffect, useRef, useState } from 'react';
import type { ApprovalsApi } from '../../lib/approvals-api';
import { StatusPill } from '../kit/StatusPill';
import { PageHead } from '../shell/AppShell';
import { PRIORITY_TONES, roleText } from '../spk/spk-format';
import { DecisionStamp } from './approval-format';

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * ApprovalReview, creation (REQ-APR-004, REQ-SPK-005 to REQ-SPK-007, C-24, C-25, DEC-128): the SPK
 * and its steps, and the decision card. Approve commits at once and adds the stamp; Reject needs a
 * reason. The report reference and part age come with their tasks (DEC-128).
 */
export function ApprovalReview({ api, id }: { api: ApprovalsApi; id: number }) {
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [decidedHere, setDecidedHere] = useState(false);
  // NFR-01: one key per decision; a retry of the same decision (same action and reason) reuses it.
  const attempt = useRef<{ what: string; key: string } | null>(null);

  useEffect(() => {
    let current = true;
    void api.review(id).then((outcome) => {
      if (!current) return;
      if (outcome.ok) setReview(outcome.data.review);
      else setError(outcome.message);
    });
    return () => {
      current = false;
    };
  }, [api, id]);

  if (!review) {
    return (
      <>
        <PageHead crumb="Approvals" title="Creation review" />
        {error ? (
          <p className="refusal" role="alert">
            {error}
          </p>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </>
    );
  }

  const decide = async (action: ApprovalReviewAction) => {
    const text = reason.trim();
    const what = action === 'reject' ? `reject:${text}` : 'approve';
    if (attempt.current?.what !== what) attempt.current = { what, key: newKey() };
    setBusy(true);
    const outcome =
      action === 'approve'
        ? await api.approve(id, { version: review.version }, attempt.current.key)
        : await api.reject(id, { version: review.version, reason: text }, attempt.current.key);
    setBusy(false);
    if (outcome.ok) {
      setReview(outcome.data.review);
      setDecidedHere(true);
      setError(null);
    } else setError(outcome.message);
  };

  const may = (action: ApprovalReviewAction) => review.allowedActions.includes(action);
  const decides = may('approve') || may('reject');

  return (
    <>
      <PageHead
        crumb={`Approvals / ${review.spkNumber}`}
        title="Creation review"
        status={<StatusPill tone={PRIORITY_TONES[review.priority]}>{review.priority}</StatusPill>}
        actions={
          <a className="btn" href="/approvals">
            Back to inbox
          </a>
        }
      />
      <div className="review-body">
        <section className="card">
          <h2>{`${review.spkNumber} · ${review.vehicle.licensePlate} · ${review.category}`}</h2>
          <p className="b">{review.title}</p>
          <p className="muted">{review.description}</p>
          {review.steps.length === 0 && <p className="muted">No steps.</p>}
          {review.steps.map((step) => (
            <div key={step.sequenceNo} className="stepcard">
              <span className="num">{step.sequenceNo}</span>
              <div className="grow">
                <b>{step.name}</b>
              </div>
              {step.executorRoles.map((role) => (
                <StatusPill key={role} tone="info">
                  {roleText(role)}
                </StatusPill>
              ))}
            </div>
          ))}
        </section>
        <section className="card decision">
          <h2>Decision</h2>
          {review.decision ? (
            <>
              <DecisionStamp decision={review.decision} fresh={decidedHere} />
              {review.decision.reason && (
                <p>
                  <span className="small muted">Reason</span>
                  <br />
                  {review.decision.reason}
                </p>
              )}
              <p className="b">Decided</p>
              <a className="btn" href="/approvals">
                Back to inbox
              </a>
            </>
          ) : (
            <div className="stamp">Waiting for a decision</div>
          )}
          {!review.decision && decides && (
            <>
              <div className="field">
                <label htmlFor="decision-reason">Reason (required to reject)</label>
                <textarea
                  id="decision-reason"
                  className="input"
                  rows={2}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
              <div className="bar">
                <span className="grow" />
                {may('reject') && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy || reason.trim() === ''}
                    onClick={() => void decide('reject')}
                  >
                    Reject
                  </button>
                )}
                {may('approve') && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void decide('approve')}
                  >
                    Approve
                  </button>
                )}
              </div>
            </>
          )}
          {!review.decision && !decides && <p className="muted">You cannot decide this item.</p>}
          {error && (
            <p className="refusal" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
