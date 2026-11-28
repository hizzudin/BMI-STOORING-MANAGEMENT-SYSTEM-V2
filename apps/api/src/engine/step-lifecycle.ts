import type { AsgStatus, SpkStatus } from '@bmi/shared';

/**
 * TASK-202: the pure rules of a step submit (REQ-ENG-002, BR-05, T7, T11, DEC-146). The engine
 * service applies them inside one transaction; no module is imported here (§8.3).
 */

export interface StepRef {
  id: number;
  sequenceNo: number;
  status: AsgStatus;
}

/**
 * REQ-ENG-002, BR-05, DEC-146: only the step right after the submitted one opens, and only while it
 * is Locked; a resubmit after a Return (a later step already Open) or a gap opens nothing.
 */
export function nextToOpen(steps: readonly StepRef[], submittedSequenceNo: number): number | null {
  const next = steps.find((step) => step.sequenceNo === submittedSequenceNo + 1);
  return next?.status === 'Locked' ? next.id : null;
}

const STILL_TO_DO: readonly AsgStatus[] = ['Locked', 'Open', 'In_Progress'];

/**
 * T7 and T11 after a submit, in order (DEC-145): an Active SPK starts (In_Progress, until Start
 * exists in TASK-204), and an SPK with no step left to do waits for verification.
 * `steps` are the SPK's steps after the submit, the next step already opened.
 */
export function spkMovesAfterSubmit(
  status: SpkStatus,
  steps: readonly StepRef[],
): Array<'In_Progress' | 'Pending_Verification'> {
  const moves: Array<'In_Progress' | 'Pending_Verification'> = [];
  let current = status;
  if (current === 'Active') {
    moves.push('In_Progress');
    current = 'In_Progress';
  }
  if (current === 'In_Progress' && !steps.some((step) => STILL_TO_DO.includes(step.status))) {
    moves.push('Pending_Verification');
  }
  return moves;
}
