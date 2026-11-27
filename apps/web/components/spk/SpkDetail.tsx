'use client';

import {
  formatDateTimeWib,
  formatKm,
  formatRupiah,
  type SpkDetail as Detail,
  type SpkDetailApproval,
} from '@bmi/shared';
import { useEffect, useState } from 'react';
import type { SpksApi } from '../../lib/spks-api';
import { StatusPill } from '../kit/StatusPill';
import { Tabs } from '../kit/Tabs';
import { PageHead } from '../shell/AppShell';
import { Button } from '../kit/Button';
import { ApprovalBlock, approvalOf } from './ApprovalBlock';
import { ApproverCancelDialog } from './CancelSpkDialog';
import { personText, PRIORITY_TONES, STATUS_TONES, statusText } from './spk-format';
import { SpkRejected } from './SpkRejected';
import { StepCard, StepTracker } from './StepTracker';

const CRUMB = 'Surat Perintah Kerja';

/** The History tab's What column for one row of spk_approvals. */
function whatOf(row: SpkDetailApproval): string {
  const stage = row.stage.toLowerCase();
  const what =
    row.action === 'Submit'
      ? row.stage === 'Creation'
        ? 'Submitted for approval'
        : `Submitted ${stage}`
      : row.action === 'Approve'
        ? `Approved ${stage}`
        : row.action === 'Reject'
          ? `Rejected ${stage}`
          : row.action === 'Cancel'
            ? 'Cancelled the SPK'
            : 'Requested completion approval';
  return row.note ? `${what}: ${row.note}` : what;
}

/**
 * SPKDetail read only (REQ-SPK-011, DEC-127): header, subline, the Steps tab (tracker, step cards,
 * context and approvals) and the History tab. What later tasks build is not shown.
 */
export function SpkDetail({
  api,
  id,
  navigate,
}: {
  api: SpksApi;
  id: number;
  navigate: (path: string) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // T15: a cancel reloads the detail so the status and the History row come from the server.
  const [loads, setLoads] = useState(0);

  useEffect(() => {
    let current = true;
    void api.getDetail(id).then((outcome) => {
      if (!current) return;
      if (outcome.ok) setDetail(outcome.data.detail);
      else setError(outcome.message);
    });
    return () => {
      current = false;
    };
  }, [api, id, loads]);

  if (!detail) {
    return (
      <>
        <PageHead crumb={CRUMB} title="SPK" />
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

  // DEC-129: while Rejected, SPKDetail is SPKRejected (the Rejected tab and the notice open it).
  if (detail.spk.status === 'Rejected') {
    return <SpkRejected api={api} detail={detail} navigate={navigate} />;
  }

  const { spk, vehicle, createdBy, steps, approvals, costs } = detail;
  const approved = approvalOf(approvals, 'Creation');
  const history = [...approvals].reverse();

  return (
    <>
      <PageHead
        crumb={`${CRUMB} / ${spk.spkNumber}`}
        title={spk.title}
        status={
          <>
            <StatusPill tone={STATUS_TONES[spk.status]}>{statusText(spk.status)}</StatusPill>
            <StatusPill tone={PRIORITY_TONES[spk.priority]}>{spk.priority}</StatusPill>
          </>
        }
        actions={
          spk.allowedActions.includes('approverCancel') && (
            <Button variant="danger" onClick={() => setCancelling(true)}>
              Cancel SPK
            </Button>
          )
        }
      />
      <p className="muted subline">
        <a className="nowrap" href={`/vehicles/${vehicle.id}`}>
          {vehicle.licensePlate}
        </a>{' '}
        · {vehicle.className} · {formatKm(vehicle.currentOdometer)} · created by{' '}
        {personText(createdBy)}
        {approved && <> · approved by {personText(approved.by)}</>}
      </p>
      <Tabs
        tabs={[
          {
            key: 'steps',
            label: 'Steps',
            content: (
              <>
                {steps.length > 0 && <StepTracker steps={steps} />}
                <div className="grid g2 spk-body">
                  <div>
                    {steps.map((step) => (
                      <StepCard key={step.id} step={step} />
                    ))}
                    {steps.length === 0 && <p className="muted">No steps yet.</p>}
                  </div>
                  <div className="spk-side">
                    <div className="card">
                      <h2>Context</h2>
                      <div className="kv-row">
                        <span className="grow">Odometer</span>
                        <b>{formatKm(vehicle.currentOdometer)}</b>
                      </div>
                      <div className="kv-row">
                        <span className="grow">Cost so far</span>
                        <b>{formatRupiah(costs.total)}</b>
                      </div>
                    </div>
                    <ApprovalBlock approvals={approvals} />
                  </div>
                </div>
              </>
            ),
          },
          {
            key: 'history',
            label: 'History',
            content: (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Who</th>
                      <th>What</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row, index) => (
                      <tr key={index}>
                        <td className="nowrap">{formatDateTimeWib(new Date(row.actedAt))}</td>
                        <td>{personText(row.by)}</td>
                        <td>{whatOf(row)}</td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td colSpan={3} className="muted">
                          Nothing has happened yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ),
          },
        ]}
      />
      {cancelling && (
        <ApproverCancelDialog
          api={api}
          spk={spk}
          onClose={() => setCancelling(false)}
          onCancelled={() => {
            setCancelling(false);
            setLoads((count) => count + 1);
          }}
        />
      )}
    </>
  );
}
