import { formatDateTimeWib, type ApprovalDecision } from '@bmi/shared';
import { roleText } from '../spk/spk-format';

/** DEC-128: the waiting time as hh:mm:ss; the hours keep counting past a day. */
export function waitingText(seconds: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds % 60)}`;
}

/** DEC-128: Surat Perintah Kerja and History; the Warehouse tab comes with TASK-310 and TASK-506. */
export function ApprovalsTabs({ current }: { current: 'spk' | 'history' }) {
  return (
    <nav className="tabs" aria-label="Approvals tabs">
      <a
        href="/approvals"
        className={current === 'spk' ? 'tab on' : 'tab'}
        aria-current={current === 'spk' ? 'page' : undefined}
      >
        Surat Perintah Kerja
      </a>
      <a
        href="/approvals/history"
        className={current === 'history' ? 'tab on' : 'tab'}
        aria-current={current === 'history' ? 'page' : undefined}
      >
        History
      </a>
    </nav>
  );
}

/** DEC-03, ui.md 7.5: the stamp of a decision; `fresh` plays the one authored motion (DEC-83). */
export function DecisionStamp({
  decision,
  fresh = false,
}: {
  decision: ApprovalDecision;
  fresh?: boolean;
}) {
  const verb = decision.action === 'Approve' ? 'Approved' : 'Rejected';
  const who = decision.by.role
    ? `${roleText(decision.by.role)}: ${decision.by.name}`
    : decision.by.name;
  return (
    <div
      className={[
        'stamp',
        'done',
        decision.action === 'Reject' ? 'rejected' : '',
        fresh ? 'stamp-in' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div>{`${verb} by ${who}`}</div>
      <div className="small">{formatDateTimeWib(new Date(decision.at))}</div>
      {decision.selfApproved && <div className="small">Self-approved</div>}
    </div>
  );
}
