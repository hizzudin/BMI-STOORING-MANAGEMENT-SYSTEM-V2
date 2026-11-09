// State machines of PRD §3, as data. Who may fire an event and its guards are server policies;
// these tables only decide which (state, event) pairs exist and where they lead (§8.3).
import type { AsgStatus, DocStatus, VehicleStatus } from '../enums/index.js';

/** A target that comes from data: the status saved before an amendment (T9, T10). */
export const PREVIOUS = 'PREVIOUS';
/** A target that comes from the document's dates (SM-DOC). */
export const BY_DATES = 'BY_DATES';

export interface Transition<S extends string, E extends string> {
  readonly id?: string;
  readonly from: readonly (S | null)[];
  readonly event: E;
  readonly to: S | typeof PREVIOUS | typeof BY_DATES;
  /** Release 2 only; refused unless the caller switches Release 2 on. */
  readonly release2?: boolean;
}

export interface Machine<S extends string, E extends string> {
  readonly name: string;
  readonly states: readonly S[];
  readonly finals: readonly S[];
  readonly transitions: readonly Transition<S, E>[];
  /** For a PREVIOUS target: the states it may return to. */
  readonly previousStates?: readonly S[];
}

export interface TransitionOptions {
  readonly previous?: string;
  readonly byDates?: string;
  readonly release2?: boolean;
}

export class TransitionRefused extends Error {
  constructor(machine: string, from: string | null, event: string) {
    super(`${machine}: ${event} is not allowed from ${from ?? '(new)'}`);
    this.name = 'TransitionRefused';
  }
}

/** The next state for an event, or TransitionRefused when PRD §3 does not list the pair. */
export function transition<S extends string, E extends string>(
  machine: Machine<S, E>,
  from: S | null,
  event: E,
  options: TransitionOptions = {},
): { to: S; id?: string } {
  const found = machine.transitions.find(
    (t) => t.event === event && t.from.includes(from) && (!t.release2 || options.release2 === true),
  );
  if (!found) throw new TransitionRefused(machine.name, from, event);
  const target = resolveTarget(machine, found, options);
  if (target === undefined) throw new TransitionRefused(machine.name, from, event);
  return found.id === undefined ? { to: target } : { to: target, id: found.id };
}

function resolveTarget<S extends string, E extends string>(
  machine: Machine<S, E>,
  found: Transition<S, E>,
  options: TransitionOptions,
): S | undefined {
  if (found.to === PREVIOUS) {
    return machine.previousStates?.find((state) => state === options.previous);
  }
  if (found.to === BY_DATES) return machine.states.find((state) => state === options.byDates);
  return found.to as S;
}

const t = <S extends string, E extends string>(
  from: (S | null)[],
  event: E,
  to: Transition<S, E>['to'],
  extra: { id?: string; release2?: boolean } = {},
): Transition<S, E> => ({ from, event, to, ...extra });

// ── SM-SPK (§3.2) ──
type SpkState =
  | 'Draft'
  | 'Pending_Approval'
  | 'Rejected'
  | 'Active'
  | 'In_Progress'
  | 'Pending_Verification'
  | 'Pending_Amendment'
  | 'Completed'
  | 'Cancelled';
const OPEN_SPK: SpkState[] = [
  'Draft',
  'Pending_Approval',
  'Rejected',
  'Active',
  'In_Progress',
  'Pending_Verification',
  'Pending_Amendment',
];
export const SPK_MACHINE: Machine<SpkState, string> = {
  name: 'SM-SPK',
  states: [...OPEN_SPK, 'Completed', 'Cancelled'],
  finals: ['Completed', 'Cancelled'],
  previousStates: ['Active', 'In_Progress'],
  transitions: [
    t<SpkState, string>([null], 'Create', 'Draft', { id: 'T1' }),
    t(['Draft'], 'Submit', 'Pending_Approval', { id: 'T2' }),
    t(['Pending_Approval'], 'Approve', 'Active', { id: 'T3' }),
    t(['Pending_Approval'], 'Reject', 'Rejected', { id: 'T4' }),
    t(['Rejected'], 'Resubmit', 'Pending_Approval', { id: 'T5' }),
    t(['Draft', 'Rejected'], 'CreatorCancel', 'Cancelled', { id: 'T6' }),
    t(['Active'], 'FirstStepStarted', 'In_Progress', { id: 'T7' }),
    t(['Active', 'In_Progress'], 'ChangeRequestSubmitted', 'Pending_Amendment', { id: 'T8' }),
    t(['Pending_Amendment'], 'RevisionApproved', PREVIOUS, { id: 'T9' }),
    t(['Pending_Amendment'], 'RevisionRejected', PREVIOUS, { id: 'T10' }),
    t(['In_Progress'], 'LastStepSubmitted', 'Pending_Verification', { id: 'T11' }),
    t(['Pending_Verification'], 'StepReturned', 'In_Progress', { id: 'T12' }),
    t(['Pending_Verification'], 'CompletionApproved', 'Completed', { id: 'T13' }),
    t(['Pending_Verification'], 'CompletionRejected', 'Pending_Verification', { id: 'T14' }),
    t(OPEN_SPK, 'ApproverCancel', 'Cancelled', { id: 'T15' }),
  ],
};

// ── SM-STEP (§3.3). Paused is In_Progress with the paused flag; Returned is Open with a flag ──
export type StepState = AsgStatus | 'Paused';
export const STEP_MACHINE: Machine<StepState, string> = {
  name: 'SM-STEP',
  states: ['Locked', 'Open', 'In_Progress', 'Paused', 'Submitted', 'Verified', 'Skipped'],
  finals: [],
  transitions: [
    t<StepState, string>(['Locked'], 'Open', 'Open'),
    t(['Open'], 'Start', 'In_Progress'),
    t(['Open'], 'StartEarlier', 'In_Progress'),
    t(['Open'], 'FirstAction', 'In_Progress'),
    t(['In_Progress'], 'Submit', 'Submitted'),
    t(['In_Progress'], 'Pause', 'Paused'),
    t(['Paused'], 'Resume', 'In_Progress'),
    t(['Submitted'], 'Verify', 'Verified'),
    t(['Submitted'], 'Return', 'Open'),
    t(['Open'], 'Skip', 'Skipped', { release2: true }),
  ],
};

/** The machine state of a stored step: In_Progress with the paused flag is Paused. */
export function stepState(step: { status: AsgStatus; paused: boolean }): StepState {
  return step.status === 'In_Progress' && step.paused ? 'Paused' : step.status;
}

// ── SM-DOC (§3.5) ──
export const DOC_MACHINE: Machine<DocStatus, string> = {
  name: 'SM-DOC',
  states: ['Valid', 'Warning', 'Expired', 'Missing'],
  finals: [],
  transitions: [
    t<DocStatus, string>([null], 'VehicleSavedWithout', 'Missing'),
    t(['Missing'], 'FirstEntry', BY_DATES),
    t(['Valid'], 'WarningReached', 'Warning'),
    t(['Warning'], 'ExpiryReached', 'Expired'),
    t(['Warning', 'Expired'], 'RenewalVerified', 'Valid'),
    t(['Missing', 'Valid', 'Warning', 'Expired'], 'CorrectEntry', BY_DATES),
  ],
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
function dayNumber(isoDate: string): number {
  if (!ISO_DATE.test(isoDate)) throw new RangeError(`Not a date as YYYY-MM-DD: ${isoDate}`);
  return Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS;
}

/** The status a document has on a WIB day: Expired from its expiry, Warning from expiry − warning days. */
export function docStatusByDates(expiry: string, warningDays: number, today: string): DocStatus {
  const remaining = dayNumber(expiry) - dayNumber(today);
  if (remaining <= 0) return 'Expired';
  return remaining <= warningDays ? 'Warning' : 'Valid';
}

// ── SM-TYRE (§3.6). Statuses are master data; these are the codes the rules use ──
type TyreState =
  | 'In_Stock'
  | 'Issued'
  | 'Mounted'
  | 'Needs_Retread'
  | 'Worn_Out'
  | 'On_Retread'
  | 'Scrapped'
  | 'Lost';
export const TYRE_MACHINE: Machine<TyreState, string> = {
  name: 'SM-TYRE',
  states: [
    'In_Stock',
    'Issued',
    'Mounted',
    'Needs_Retread',
    'Worn_Out',
    'On_Retread',
    'Scrapped',
    'Lost',
  ],
  finals: ['Scrapped', 'Lost'],
  transitions: [
    t<TyreState, string>([null], 'Receive', 'In_Stock'),
    t([null], 'BoughtOutside', 'Issued'),
    t(['In_Stock'], 'Issue', 'Issued'),
    t(['Issued'], 'Release', 'In_Stock'),
    t(['Issued'], 'Mount', 'Mounted'),
    t(['In_Stock'], 'BaselineMount', 'Mounted'),
    t(['Mounted'], 'Rotate', 'Mounted'),
    t(['Mounted'], 'DemountNeedsRetread', 'Needs_Retread'),
    t(['Mounted'], 'DemountWornOut', 'Worn_Out'),
    t(['Mounted'], 'DemountBackToStock', 'In_Stock'),
    t(['Mounted', 'Needs_Retread', 'Worn_Out'], 'Scrap', 'Scrapped'),
    t(['Needs_Retread'], 'RetreadSent', 'On_Retread'),
    t(['Needs_Retread'], 'MarkWornOut', 'Worn_Out'),
    t(['On_Retread'], 'RetreadAccepted', 'In_Stock'),
    t(['On_Retread'], 'RetreadRejected', 'Scrapped'),
    t(['In_Stock', 'Needs_Retread', 'Worn_Out'], 'CountMissing', 'Lost'),
  ],
};

// ── §3.7 Warehouse and tyre documents (DEC-15), change request, schedule card, invoice, report ──
export const GR_MACHINE: Machine<'Draft' | 'Posted', string> = {
  name: 'SM-GR',
  states: ['Draft', 'Posted'],
  finals: [],
  transitions: [t<'Draft' | 'Posted', string>(['Draft'], 'Post', 'Posted')],
};

type ApprovalDocState = 'Draft' | 'Pending_Approval' | 'Approved';
const approvalDocument = (name: string): Machine<ApprovalDocState, string> => ({
  name,
  states: ['Draft', 'Pending_Approval', 'Approved'],
  finals: [],
  transitions: [
    t<ApprovalDocState, string>(['Draft'], 'Submit', 'Pending_Approval'),
    t(['Pending_Approval'], 'Approve', 'Approved'),
    t(['Pending_Approval'], 'Reject', 'Draft'),
  ],
});
export const SA_MACHINE = approvalDocument('SM-SA');
export const TC_MACHINE = approvalDocument('SM-TC');

export const TR_MACHINE: Machine<'Draft' | 'Confirmed', string> = {
  name: 'SM-TR',
  states: ['Draft', 'Confirmed'],
  finals: [],
  transitions: [t<'Draft' | 'Confirmed', string>(['Draft'], 'Confirm', 'Confirmed')],
};

type RdState = 'Draft' | 'Sent' | 'Partial' | 'Closed';
export const RD_MACHINE: Machine<RdState, string> = {
  name: 'SM-RD',
  states: ['Draft', 'Sent', 'Partial', 'Closed'],
  finals: [],
  transitions: [
    t<RdState, string>(['Draft'], 'Confirm', 'Sent'),
    t(['Sent', 'Partial'], 'ReturnSome', 'Partial'),
    t(['Sent', 'Partial'], 'ReturnLast', 'Closed'),
  ],
};

type CrState = 'Submitted' | 'In_Revision' | 'Pending_Approval' | 'Approved' | 'Rejected';
export const CR_MACHINE: Machine<CrState, string> = {
  name: 'SM-CR',
  states: ['Submitted', 'In_Revision', 'Pending_Approval', 'Approved', 'Rejected'],
  finals: [],
  transitions: [
    t<CrState, string>(['Submitted'], 'OpenByCreator', 'In_Revision'),
    t(['In_Revision'], 'SendRevision', 'Pending_Approval'),
    t(['Pending_Approval'], 'Approve', 'Approved'),
    t(['Pending_Approval'], 'Reject', 'Rejected'),
  ],
};

type SchState = 'Not_Planned' | 'Planned' | 'Missed';
export const SCH_MACHINE: Machine<SchState, string> = {
  name: 'SM-SCH',
  states: ['Not_Planned', 'Planned', 'Missed'],
  finals: [],
  transitions: [
    t<SchState, string>(['Not_Planned'], 'Place', 'Planned'),
    t(['Planned'], 'DayPassed', 'Missed'),
    t(['Missed'], 'RollForward', 'Planned'),
  ],
};

type InvState = 'Draft' | 'Issued' | 'Paid' | 'Void';
export const INV_MACHINE: Machine<InvState, string> = {
  name: 'SM-INV',
  states: ['Draft', 'Issued', 'Paid', 'Void'],
  finals: ['Paid', 'Void'],
  transitions: [
    t<InvState, string>(['Draft'], 'Issue', 'Issued'),
    t(['Issued'], 'RecordPayment', 'Paid'),
    t(['Draft', 'Issued'], 'Void', 'Void'),
  ],
};

type BrkState = 'New' | 'Converted' | 'Rejected';
export const BRK_MACHINE: Machine<BrkState, string> = {
  name: 'SM-BRK',
  states: ['New', 'Converted', 'Rejected'],
  finals: ['Rejected'],
  transitions: [
    t<BrkState, string>(['New'], 'SpkSaved', 'Converted'),
    t(['New'], 'UrgentDraftCreated', 'Converted'),
    t(['New', 'Converted'], 'Reject', 'Rejected'),
    t(['Converted'], 'SpkCancelled', 'New'),
  ],
};

// ── SM-VEH (§3.4): derived, highest precedence wins ──
export interface VehicleConditions {
  readonly inactive: boolean;
  readonly off: boolean;
  readonly blocked: boolean;
  readonly repair: boolean;
}

export function deriveVehicleStatus(holds: VehicleConditions): VehicleStatus {
  if (holds.inactive) return 'Inactive';
  if (holds.off) return 'OFF';
  if (holds.blocked) return 'Blocked';
  if (holds.repair) return 'Repair';
  return 'Active';
}
