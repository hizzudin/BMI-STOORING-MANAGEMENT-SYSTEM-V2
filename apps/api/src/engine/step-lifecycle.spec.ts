import { describe, expect, it } from 'vitest';
import { nextToOpen, spkMovesAfterSubmit, type StepRef } from './step-lifecycle.js';

// TASK-202: the pure rules of a step submit (REQ-ENG-002, BR-05, T7, T11, DEC-146).

const steps = (...statuses: StepRef['status'][]): StepRef[] =>
  statuses.map((status, index) => ({ id: index + 1, sequenceNo: index + 1, status }));

describe('nextToOpen', () => {
  it('REQ-ENG-002 the step at sequence_no + 1 opens when step 1 is submitted', () => {
    expect(nextToOpen(steps('Submitted', 'Locked', 'Locked'), 1)).toBe(2);
  });

  it('REQ-ENG-002 the last step opens nothing', () => {
    expect(nextToOpen(steps('Verified', 'Submitted'), 2)).toBeNull();
  });

  it('BR-05 after a Return of step 2 while step 3 is Open, resubmitting step 2 opens nothing', () => {
    expect(nextToOpen(steps('Verified', 'Submitted', 'Open', 'Locked'), 2)).toBeNull();
  });

  it('BR-05 a gap in sequence numbers opens nothing rather than a later step', () => {
    const gap: StepRef[] = [
      { id: 1, sequenceNo: 1, status: 'Submitted' },
      { id: 3, sequenceNo: 3, status: 'Locked' },
    ];
    expect(nextToOpen(gap, 1)).toBeNull();
  });
});

describe('spkMovesAfterSubmit', () => {
  it('T7 an Active SPK moves to In_Progress on the first submit', () => {
    expect(spkMovesAfterSubmit('Active', steps('Submitted', 'Open', 'Locked'))).toEqual([
      'In_Progress',
    ]);
  });

  it('T11 the last submit moves an In_Progress SPK to Pending_Verification', () => {
    expect(spkMovesAfterSubmit('In_Progress', steps('Verified', 'Submitted'))).toEqual([
      'Pending_Verification',
    ]);
  });

  it('T7 T11 a one-step SPK moves through In_Progress to Pending_Verification in order', () => {
    expect(spkMovesAfterSubmit('Active', steps('Submitted'))).toEqual([
      'In_Progress',
      'Pending_Verification',
    ]);
  });

  it('REQ-ENG-002 an In_Progress SPK with an open step stays as it is', () => {
    expect(spkMovesAfterSubmit('In_Progress', steps('Submitted', 'Open'))).toEqual([]);
  });
});
