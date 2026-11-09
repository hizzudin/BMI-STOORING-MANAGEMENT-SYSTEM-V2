import { describe, expect, it } from 'vitest';
import {
  BRK_MACHINE,
  CR_MACHINE,
  DOC_MACHINE,
  deriveVehicleStatus,
  docStatusByDates,
  GR_MACHINE,
  INV_MACHINE,
  type Machine,
  RD_MACHINE,
  SA_MACHINE,
  SCH_MACHINE,
  SPK_MACHINE,
  STEP_MACHINE,
  stepState,
  TC_MACHINE,
  TR_MACHINE,
  transition,
  TransitionRefused,
  TYRE_MACHINE,
} from './index.js';

type Row = readonly [from: string | null, event: string, to: string];

/**
 * The expected tables, typed again from PRD §3 so the machines are checked against the spec,
 * not against themselves. "PREVIOUS" and "BY_DATES" stand for a target that comes from data.
 */
const EXPECTED: Record<string, { machine: Machine<string, string>; rows: readonly Row[] }> = {
  'SM-SPK': {
    machine: SPK_MACHINE,
    rows: [
      [null, 'Create', 'Draft'],
      ['Draft', 'Submit', 'Pending_Approval'],
      ['Pending_Approval', 'Approve', 'Active'],
      ['Pending_Approval', 'Reject', 'Rejected'],
      ['Rejected', 'Resubmit', 'Pending_Approval'],
      ['Draft', 'CreatorCancel', 'Cancelled'],
      ['Rejected', 'CreatorCancel', 'Cancelled'],
      ['Active', 'FirstStepStarted', 'In_Progress'],
      ['Active', 'ChangeRequestSubmitted', 'Pending_Amendment'],
      ['In_Progress', 'ChangeRequestSubmitted', 'Pending_Amendment'],
      ['Pending_Amendment', 'RevisionApproved', 'PREVIOUS'],
      ['Pending_Amendment', 'RevisionRejected', 'PREVIOUS'],
      ['In_Progress', 'LastStepSubmitted', 'Pending_Verification'],
      ['Pending_Verification', 'StepReturned', 'In_Progress'],
      ['Pending_Verification', 'CompletionApproved', 'Completed'],
      ['Pending_Verification', 'CompletionRejected', 'Pending_Verification'],
      ['Draft', 'ApproverCancel', 'Cancelled'],
      ['Pending_Approval', 'ApproverCancel', 'Cancelled'],
      ['Rejected', 'ApproverCancel', 'Cancelled'],
      ['Active', 'ApproverCancel', 'Cancelled'],
      ['In_Progress', 'ApproverCancel', 'Cancelled'],
      ['Pending_Verification', 'ApproverCancel', 'Cancelled'],
      ['Pending_Amendment', 'ApproverCancel', 'Cancelled'],
    ],
  },
  'SM-STEP': {
    machine: STEP_MACHINE,
    rows: [
      ['Locked', 'Open', 'Open'],
      ['Open', 'Start', 'In_Progress'],
      ['Open', 'StartEarlier', 'In_Progress'],
      ['Open', 'FirstAction', 'In_Progress'],
      ['In_Progress', 'Submit', 'Submitted'],
      ['In_Progress', 'Pause', 'Paused'],
      ['Paused', 'Resume', 'In_Progress'],
      ['Submitted', 'Verify', 'Verified'],
      ['Submitted', 'Return', 'Open'],
    ],
  },
  'SM-DOC': {
    machine: DOC_MACHINE,
    rows: [
      [null, 'VehicleSavedWithout', 'Missing'],
      ['Missing', 'FirstEntry', 'BY_DATES'],
      ['Valid', 'WarningReached', 'Warning'],
      ['Warning', 'ExpiryReached', 'Expired'],
      ['Warning', 'RenewalVerified', 'Valid'],
      ['Expired', 'RenewalVerified', 'Valid'],
      ['Missing', 'CorrectEntry', 'BY_DATES'],
      ['Valid', 'CorrectEntry', 'BY_DATES'],
      ['Warning', 'CorrectEntry', 'BY_DATES'],
      ['Expired', 'CorrectEntry', 'BY_DATES'],
    ],
  },
  'SM-TYRE': {
    machine: TYRE_MACHINE,
    rows: [
      [null, 'Receive', 'In_Stock'],
      [null, 'BoughtOutside', 'Issued'],
      ['In_Stock', 'Issue', 'Issued'],
      ['Issued', 'Release', 'In_Stock'],
      ['Issued', 'Mount', 'Mounted'],
      ['In_Stock', 'BaselineMount', 'Mounted'],
      ['Mounted', 'Rotate', 'Mounted'],
      ['Mounted', 'DemountNeedsRetread', 'Needs_Retread'],
      ['Mounted', 'DemountWornOut', 'Worn_Out'],
      ['Mounted', 'DemountBackToStock', 'In_Stock'],
      ['Mounted', 'Scrap', 'Scrapped'],
      ['Needs_Retread', 'RetreadSent', 'On_Retread'],
      ['Needs_Retread', 'MarkWornOut', 'Worn_Out'],
      ['Needs_Retread', 'Scrap', 'Scrapped'],
      ['Worn_Out', 'Scrap', 'Scrapped'],
      ['On_Retread', 'RetreadAccepted', 'In_Stock'],
      ['On_Retread', 'RetreadRejected', 'Scrapped'],
      ['In_Stock', 'CountMissing', 'Lost'],
      ['Needs_Retread', 'CountMissing', 'Lost'],
      ['Worn_Out', 'CountMissing', 'Lost'],
    ],
  },
  'SM-GR': { machine: GR_MACHINE, rows: [['Draft', 'Post', 'Posted']] },
  'SM-SA': {
    machine: SA_MACHINE,
    rows: [
      ['Draft', 'Submit', 'Pending_Approval'],
      ['Pending_Approval', 'Approve', 'Approved'],
      ['Pending_Approval', 'Reject', 'Draft'],
    ],
  },
  'SM-TC': {
    machine: TC_MACHINE,
    rows: [
      ['Draft', 'Submit', 'Pending_Approval'],
      ['Pending_Approval', 'Approve', 'Approved'],
      ['Pending_Approval', 'Reject', 'Draft'],
    ],
  },
  'SM-TR': { machine: TR_MACHINE, rows: [['Draft', 'Confirm', 'Confirmed']] },
  'SM-RD': {
    machine: RD_MACHINE,
    rows: [
      ['Draft', 'Confirm', 'Sent'],
      ['Sent', 'ReturnSome', 'Partial'],
      ['Partial', 'ReturnSome', 'Partial'],
      ['Sent', 'ReturnLast', 'Closed'],
      ['Partial', 'ReturnLast', 'Closed'],
    ],
  },
  'SM-CR': {
    machine: CR_MACHINE,
    rows: [
      ['Submitted', 'OpenByCreator', 'In_Revision'],
      ['In_Revision', 'SendRevision', 'Pending_Approval'],
      ['Pending_Approval', 'Approve', 'Approved'],
      ['Pending_Approval', 'Reject', 'Rejected'],
    ],
  },
  'SM-SCH': {
    machine: SCH_MACHINE,
    rows: [
      ['Not_Planned', 'Place', 'Planned'],
      ['Planned', 'DayPassed', 'Missed'],
      ['Missed', 'RollForward', 'Planned'],
    ],
  },
  'SM-INV': {
    machine: INV_MACHINE,
    rows: [
      ['Draft', 'Issue', 'Issued'],
      ['Issued', 'RecordPayment', 'Paid'],
      ['Draft', 'Void', 'Void'],
      ['Issued', 'Void', 'Void'],
    ],
  },
  'SM-BRK': {
    machine: BRK_MACHINE,
    rows: [
      ['New', 'SpkSaved', 'Converted'],
      ['New', 'UrgentDraftCreated', 'Converted'],
      ['New', 'Reject', 'Rejected'],
      ['Converted', 'Reject', 'Rejected'],
      ['Converted', 'SpkCancelled', 'New'],
    ],
  },
};

const STATES: Record<string, readonly string[]> = {
  'SM-SPK': [
    'Draft',
    'Pending_Approval',
    'Rejected',
    'Active',
    'In_Progress',
    'Pending_Verification',
    'Pending_Amendment',
    'Completed',
    'Cancelled',
  ],
  'SM-STEP': ['Locked', 'Open', 'In_Progress', 'Paused', 'Submitted', 'Verified', 'Skipped'],
  'SM-DOC': ['Valid', 'Warning', 'Expired', 'Missing'],
  'SM-TYRE': [
    'In_Stock',
    'Issued',
    'Mounted',
    'Needs_Retread',
    'Worn_Out',
    'On_Retread',
    'Scrapped',
    'Lost',
  ],
  'SM-GR': ['Draft', 'Posted'],
  'SM-SA': ['Draft', 'Pending_Approval', 'Approved'],
  'SM-TC': ['Draft', 'Pending_Approval', 'Approved'],
  'SM-TR': ['Draft', 'Confirmed'],
  'SM-RD': ['Draft', 'Sent', 'Partial', 'Closed'],
  'SM-CR': ['Submitted', 'In_Revision', 'Pending_Approval', 'Approved', 'Rejected'],
  'SM-SCH': ['Not_Planned', 'Planned', 'Missed'],
  'SM-INV': ['Draft', 'Issued', 'Paid', 'Void'],
  'SM-BRK': ['New', 'Converted', 'Rejected'],
};

const FINALS: Record<string, readonly string[]> = {
  'SM-SPK': ['Completed', 'Cancelled'],
  'SM-TYRE': ['Scrapped', 'Lost'],
  'SM-INV': ['Paid', 'Void'],
  'SM-BRK': ['Rejected'],
};

const options = (to: string) =>
  to === 'PREVIOUS' ? { previous: 'In_Progress' } : to === 'BY_DATES' ? { byDates: 'Warning' } : {};
const expectedTarget = (to: string) =>
  to === 'PREVIOUS' ? 'In_Progress' : to === 'BY_DATES' ? 'Warning' : to;

for (const [name, { machine, rows }] of Object.entries(EXPECTED)) {
  describe(`${name} transitions`, () => {
    it(`${name} has exactly the states of PRD §3`, () => {
      expect([...machine.states].sort()).toEqual([...(STATES[name] ?? [])].sort());
    });

    it(`${name} has exactly the final states of PRD §3`, () => {
      expect([...machine.finals].sort()).toEqual([...(FINALS[name] ?? [])].sort());
    });

    it.each(rows)(`${name} accepts %s --%s--> %s`, (from, event, to) => {
      expect(transition(machine, from, event, options(to)).to).toBe(expectedTarget(to));
    });

    it(`${name} refuses every other state and event`, () => {
      const allowed = new Set(rows.map(([from, event]) => `${from ?? '(new)'}|${event}`));
      const events = [...new Set(machine.transitions.map((t) => t.event))];
      let refused = 0;
      for (const from of [null, ...machine.states]) {
        for (const event of events) {
          if (allowed.has(`${from ?? '(new)'}|${event}`)) continue;
          expect(() => transition(machine, from, event)).toThrow(TransitionRefused);
          refused += 1;
        }
      }
      expect(refused).toBeGreaterThan(0);
    });

    it(`${name} has no transition the spec does not list`, () => {
      const listed = machine.transitions
        .filter((t) => !t.release2)
        .flatMap((t) => t.from.map((from) => `${from ?? '(new)'}|${t.event}`));
      const expected = rows.map(([from, event]) => `${from ?? '(new)'}|${event}`);
      expect(listed.sort()).toEqual([...expected].sort());
    });
  });
}

describe('SM-SPK special targets', () => {
  it('SM-SPK T9 and T10 return to the status before the amendment', () => {
    expect(
      transition(SPK_MACHINE, 'Pending_Amendment', 'RevisionApproved', { previous: 'Active' }).to,
    ).toBe('Active');
    expect(
      transition(SPK_MACHINE, 'Pending_Amendment', 'RevisionRejected', { previous: 'In_Progress' })
        .to,
    ).toBe('In_Progress');
  });

  it('SM-SPK refuses a status before the amendment that a change request cannot start from', () => {
    expect(() =>
      transition(SPK_MACHINE, 'Pending_Amendment', 'RevisionApproved', { previous: 'Draft' }),
    ).toThrow(TransitionRefused);
    expect(() => transition(SPK_MACHINE, 'Pending_Amendment', 'RevisionApproved')).toThrow(
      TransitionRefused,
    );
  });

  it('SM-SPK names each transition by its PRD number', () => {
    expect(transition(SPK_MACHINE, 'Pending_Approval', 'Approve').id).toBe('T3');
    expect(transition(SPK_MACHINE, 'In_Progress', 'ApproverCancel').id).toBe('T15');
  });

  it('SM-SPK nothing leaves Completed or Cancelled', () => {
    for (const event of new Set(SPK_MACHINE.transitions.map((t) => t.event))) {
      expect(() => transition(SPK_MACHINE, 'Completed', event)).toThrow(TransitionRefused);
      expect(() => transition(SPK_MACHINE, 'Cancelled', event)).toThrow(TransitionRefused);
    }
  });
});

describe('SM-STEP stored state', () => {
  it('SM-STEP a paused step is In_Progress with the paused flag', () => {
    expect(stepState({ status: 'In_Progress', paused: true })).toBe('Paused');
    expect(stepState({ status: 'In_Progress', paused: false })).toBe('In_Progress');
    expect(stepState({ status: 'Open', paused: false })).toBe('Open');
  });

  it('SM-STEP a paused step cannot be submitted', () => {
    expect(() =>
      transition(STEP_MACHINE, stepState({ status: 'In_Progress', paused: true }), 'Submit'),
    ).toThrow(TransitionRefused);
  });

  it('SM-STEP Skip is a Release 2 transition and is refused until it is switched on', () => {
    expect(() => transition(STEP_MACHINE, 'Open', 'Skip')).toThrow(TransitionRefused);
    expect(transition(STEP_MACHINE, 'Open', 'Skip', { release2: true }).to).toBe('Skipped');
  });
});

describe('SM-DOC dates', () => {
  const today = '2026-11-09';

  it.each([
    ['2026-12-31', 30, 'Valid'],
    ['2026-12-09', 30, 'Warning'],
    ['2026-11-10', 30, 'Warning'],
    ['2026-11-09', 30, 'Expired'],
    ['2026-01-01', 30, 'Expired'],
  ] as const)('SM-DOC expiry %s with %i warning days is %s', (expiry, warningDays, status) => {
    expect(docStatusByDates(expiry, warningDays, today)).toBe(status);
  });

  it('SM-DOC a first entry takes its status from the dates', () => {
    expect(transition(DOC_MACHINE, 'Missing', 'FirstEntry', { byDates: 'Valid' }).to).toBe('Valid');
    expect(() => transition(DOC_MACHINE, 'Missing', 'FirstEntry')).toThrow(TransitionRefused);
  });

  it('SM-DOC refuses a date that is not YYYY-MM-DD', () => {
    expect(() => docStatusByDates('09-11-2026', 30, today)).toThrow(RangeError);
  });
});

describe('SM-VEH derived status', () => {
  const none = { inactive: false, off: false, blocked: false, repair: false };

  it('SM-VEH is Active when nothing holds', () => {
    expect(deriveVehicleStatus(none)).toBe('Active');
  });

  it.each([
    [{ ...none, repair: true }, 'Repair'],
    [{ ...none, blocked: true, repair: true }, 'Blocked'],
    [{ ...none, off: true, blocked: true, repair: true }, 'OFF'],
    [{ inactive: true, off: true, blocked: true, repair: true }, 'Inactive'],
  ] as const)('SM-VEH shows the highest precedence: %o is %s', (holds, status) => {
    expect(deriveVehicleStatus(holds)).toBe(status);
  });
});
