import { currentStepOf, formatTimeWib, type SpkDetailStep } from '@bmi/shared';
import { StatusPill } from '../kit/StatusPill';
import { personText, roleText, STEP_TONES, statusText } from './spk-format';

const DONE = ['Verified', 'Skipped'];
const time = (iso: string) => formatTimeWib(new Date(iso));

/** ui.md 7.5 StepTracker: every step in order; the current one (DEC-147) is marked. */
export function StepTracker({ steps }: { steps: SpkDetailStep[] }) {
  const current = currentStepOf(steps);
  return (
    <ol className="steps" aria-label="Steps">
      {steps.map((step) => {
        const done = DONE.includes(step.status);
        const now = step === current && step.status !== 'Locked';
        return (
          <li
            key={step.id}
            className={done ? 's done' : now ? 's now' : 's'}
            aria-current={now ? 'step' : undefined}
          >
            <span className="n">{done ? <span aria-hidden="true">✓</span> : step.sequenceNo}</span>
            {step.name}
            <small>{statusText(step.status)}</small>
          </li>
        );
      })}
    </ol>
  );
}

/** What has happened to the step so far, from its times (REQ-SPK-011). */
function stepLine(step: SpkDetailStep): string {
  switch (step.status) {
    case 'Verified': {
      const submitted = step.submittedAt ? `Submitted ${time(step.submittedAt)} · ` : '';
      const by = step.verifiedBy ? ` by ${step.verifiedBy.name}` : '';
      return `${submitted}verified${by}${step.verifiedAt ? ` ${time(step.verifiedAt)}` : ''}`;
    }
    case 'Submitted':
      return step.submittedAt ? `Submitted ${time(step.submittedAt)}` : 'Submitted';
    case 'Open':
      return step.openedAt ? `Waiting to start since ${time(step.openedAt)}` : 'Waiting to start';
    case 'In_Progress':
      return 'In progress';
    case 'Skipped':
      return 'Skipped';
    default:
      return step.sequenceNo > 1
        ? `Opens when step ${step.sequenceNo - 1} is submitted`
        : 'Opens when the SPK is approved';
  }
}

/** ui.md 7.5 StepCard: one card per step with who does it and its status (read only, DEC-127). */
export function StepCard({ step }: { step: SpkDetailStep }) {
  const who = step.assignee
    ? personText(step.assignee)
    : step.executorRoles.map(roleText).join(', ');
  return (
    <div className={step.status === 'Locked' ? 'stepcard locked' : 'stepcard'}>
      <span className="num">{step.sequenceNo}</span>
      <div className="grow">
        <b>
          {step.name} · {who}
        </b>
        <div className="small muted">{stepLine(step)}</div>
      </div>
      <StatusPill tone={STEP_TONES[step.status]}>{statusText(step.status)}</StatusPill>
    </div>
  );
}
