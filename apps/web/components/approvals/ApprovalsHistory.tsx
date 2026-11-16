'use client';

import {
  formatDateTimeWib,
  type ApprovalDecisionAction,
  type ApprovalHistoryItem,
} from '@bmi/shared';
import { useEffect, useState } from 'react';
import type { ApprovalsApi } from '../../lib/approvals-api';
import { StatusPill } from '../kit/StatusPill';
import { PageHead } from '../shell/AppShell';
import { personText } from '../spk/spk-format';
import { ApprovalsTabs, DecisionStamp } from './approval-format';

const CHIPS: { decision: ApprovalDecisionAction | undefined; label: string }[] = [
  { decision: undefined, label: 'All' },
  { decision: 'Approve', label: 'Approved' },
  { decision: 'Reject', label: 'Rejected' },
];

const decisionText = (action: ApprovalDecisionAction) =>
  action === 'Approve' ? 'Approved' : 'Rejected';

/**
 * Approvals, History tab (REQ-APR-007, DEC-128): the past decisions of every Approver, newest first,
 * the chips All, Approved and Rejected, and a preview with the stamp, the reason and Open SPK.
 */
export function ApprovalsHistory({ api }: { api: ApprovalsApi }) {
  const [decision, setDecision] = useState<ApprovalDecisionAction | undefined>(undefined);
  const [items, setItems] = useState<ApprovalHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void api.history(decision ? { decision } : {}).then((outcome) => {
      if (!current) return;
      if (outcome.ok) {
        setItems(outcome.data.items);
        setError(null);
      } else setError(outcome.message);
    });
    return () => {
      current = false;
    };
  }, [api, decision]);

  const keyOf = (item: ApprovalHistoryItem) => `${item.spkId}:${item.decision.at}`;
  const shown = items?.find((item) => keyOf(item) === selected) ?? items?.[0] ?? null;

  return (
    <>
      <PageHead title="Approvals" />
      <ApprovalsTabs current="history" />
      <div className="bar bar-start list-filters">
        {CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className={chip.decision === decision ? 'chip on' : 'chip'}
            aria-pressed={chip.decision === decision}
            onClick={() => setDecision(chip.decision)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="refusal" role="alert">
          {error}
        </p>
      )}
      {!items && !error && <p className="muted">Loading…</p>}
      {items && items.length === 0 && <p className="muted">No decisions yet.</p>}
      {items && items.length > 0 && (
        <div className="master-detail wide">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Decided</th>
                  <th>SPK</th>
                  <th>Vehicle</th>
                  <th>Approval</th>
                  <th>Decision</th>
                  <th>Decided by</th>
                  <th>Requested by</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={keyOf(item)}
                    className={
                      shown && keyOf(item) === keyOf(shown) ? 'selectable sel' : 'selectable'
                    }
                    aria-selected={shown !== null && keyOf(item) === keyOf(shown)}
                    onClick={() => setSelected(keyOf(item))}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') setSelected(keyOf(item));
                    }}
                  >
                    <td className="nowrap">{formatDateTimeWib(new Date(item.decision.at))}</td>
                    <td className="b nowrap">{item.spkNumber}</td>
                    <td className="nowrap">{item.vehicle.licensePlate}</td>
                    <td>{item.kind}</td>
                    <td>
                      <StatusPill tone={item.decision.action === 'Approve' ? 'success' : 'danger'}>
                        {decisionText(item.decision.action)}
                      </StatusPill>
                    </td>
                    <td>{personText(item.decision.by)}</td>
                    <td>{personText(item.requestedBy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown && (
            <section className="panel preview" aria-label="Preview">
              <h2 className="title-row">
                {shown.spkNumber}{' '}
                <StatusPill tone={shown.decision.action === 'Approve' ? 'success' : 'danger'}>
                  {decisionText(shown.decision.action)}
                </StatusPill>
              </h2>
              <p className="small muted">
                {shown.kind} · requested by {personText(shown.requestedBy)}
              </p>
              <DecisionStamp decision={shown.decision} />
              <dl className="kv-list">
                <dt>Reason</dt>
                <dd>{shown.decision.reason ?? <span className="muted">None given</span>}</dd>
              </dl>
              <div className="bar">
                <span className="grow" />
                <a className="btn" href={`/spk/${shown.spkId}`}>
                  Open SPK
                </a>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
