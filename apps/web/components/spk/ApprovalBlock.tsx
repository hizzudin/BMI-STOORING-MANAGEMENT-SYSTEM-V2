import { formatDateTimeWib, type ApprovalStage, type SpkDetailApproval } from '@bmi/shared';
import { personText } from './spk-format';

/** The last approval of a stage, when there is one. */
export const approvalOf = (approvals: SpkDetailApproval[], stage: ApprovalStage) =>
  approvals.findLast((row) => row.stage === stage && row.action === 'Approve');

const LINES: { stage: ApprovalStage; label: string }[] = [
  { stage: 'Creation', label: 'Creation' },
  { stage: 'Completion', label: 'Completion' },
];

/** ui.md 7.5 ApprovalBlock: two lines (creation, completion): stamp, name, role, time, Self-approved. */
export function ApprovalBlock({ approvals }: { approvals: SpkDetailApproval[] }) {
  return (
    <div className="card approval-block">
      <h2>Approvals</h2>
      {LINES.map(({ stage, label }) => {
        const approval = approvalOf(approvals, stage);
        return (
          <div key={stage} className="approval-line">
            <span className="small muted">{label}</span>
            {approval ? (
              <div className="stamp done">
                {personText(approval.by)}
                <div className="small">{formatDateTimeWib(new Date(approval.actedAt))}</div>
                {approval.selfApproved && <div className="small">Self-approved</div>}
              </div>
            ) : (
              <div className="stamp">Not approved yet</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
