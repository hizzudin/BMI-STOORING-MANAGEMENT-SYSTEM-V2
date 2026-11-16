'use client';

import { formatDateTimeWib, type SpkDetail as Detail, type SpkDetailApproval } from '@bmi/shared';
import { useState } from 'react';
import type { SpksApi } from '../../lib/spks-api';
import { Icon } from '../kit/Icon';
import { StatusPill } from '../kit/StatusPill';
import { PageHead } from '../shell/AppShell';
import { CancelSpkDialog } from './CancelSpkDialog';
import { personText, roleText, STATUS_TONES, STEP_TONES, statusText } from './spk-format';

/** REQ-SPK-007: the latest creation rejection, the note the creator works from. */
export const latestRejection = (approvals: readonly SpkDetailApproval[]) =>
  approvals.findLast((row) => row.stage === 'Creation' && row.action === 'Reject');

/** DEC-129: "Rejected by GM Hendra · 2026-11-02 16:40:12" and the reason. */
export function RejectionNote({ rejection }: { rejection: SpkDetailApproval }) {
  return (
    <div className="note bad" role="note">
      <Icon name="close" size={18} />
      <div>
        <b>{`Rejected by ${personText(rejection.by)} · ${formatDateTimeWib(new Date(rejection.actedAt))}`}</b>
        <div>{rejection.note}</div>
      </div>
    </div>
  );
}

/**
 * SPKRejected (REQ-SPK-007, AC-SPK-005, DQ-06, DEC-101, DEC-129): why the SPK was rejected, the SPK
 * and its steps, and for its creator Edit and resubmit (T5) or Cancel SPK (T6). The rejector cannot
 * revert the rejection. SPK document comes with its task.
 */
export function SpkRejected({
  api,
  detail,
  navigate,
}: {
  api: Pick<SpksApi, 'cancel'>;
  detail: Detail;
  navigate: (path: string) => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const { spk, vehicle, createdBy, steps, approvals } = detail;
  const rejection = latestRejection(approvals);
  const may = (action: 'edit' | 'cancel') => spk.allowedActions.includes(action);

  return (
    <>
      <PageHead
        crumb={`Surat Perintah Kerja / ${spk.spkNumber}`}
        title={spk.title}
        status={<StatusPill tone={STATUS_TONES[spk.status]}>{statusText(spk.status)}</StatusPill>}
      />
      <p className="muted subline">
        <a className="nowrap" href={`/vehicles/${vehicle.id}`}>
          {vehicle.licensePlate}
        </a>{' '}
        · {vehicle.className} · created by {personText(createdBy)}
      </p>
      {rejection && <RejectionNote rejection={rejection} />}
      <div className="grid g2 spk-body">
        <div className="card white">
          <h2>
            <span className="circle-ic">
              <Icon name="spk" size={18} />
            </span>
            Surat Perintah Kerja
          </h2>
          <div className="kv-row">
            <span className="grow">Category</span>
            <b>{spk.category}</b>
          </div>
          <div className="kv-row">
            <span className="grow">Urgency</span>
            <b>{spk.priority}</b>
          </div>
          <div className="kv-row">
            <span className="grow">Description</span>
            <span>{spk.description}</span>
          </div>
        </div>
        <div className="card white">
          <h2>Steps</h2>
          {steps.length === 0 && <p className="muted">No steps yet.</p>}
          {steps.map((step) => (
            <div key={step.id} className="stepcard">
              <span className="num">{step.sequenceNo}</span>
              <div className="grow">
                <b>{step.name}</b>
                <div className="small muted">{step.executorRoles.map(roleText).join(', ')}</div>
              </div>
              <StatusPill tone={STEP_TONES[step.status]}>{statusText(step.status)}</StatusPill>
            </div>
          ))}
        </div>
      </div>
      {(may('edit') || may('cancel')) && (
        <>
          <div className="note">
            <Icon name="clock" size={18} />
            <div>
              It stays Rejected with this note. Edit it and submit it for approval again, or cancel
              it with a reason.
            </div>
          </div>
          <div className="bar">
            <span className="grow" />
            {may('cancel') && (
              <button type="button" className="btn btn-danger" onClick={() => setCancelling(true)}>
                Cancel SPK
              </button>
            )}
            {may('edit') && (
              <a className="btn btn-primary" href={`/spk/${spk.id}/edit`}>
                Edit and resubmit
              </a>
            )}
          </div>
        </>
      )}
      {cancelling && (
        <CancelSpkDialog
          api={api}
          spk={spk}
          onClose={() => setCancelling(false)}
          onCancelled={() => navigate('/spk?tab=cancelled')}
        />
      )}
    </>
  );
}
