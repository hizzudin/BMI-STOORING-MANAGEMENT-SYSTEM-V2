import {
  passesExecutorCheck,
  type AsgStatus,
  type PermissionCode,
  type Role,
  type SpkStatus,
  type StepAction,
} from '@bmi/shared';
import { NOT_ALLOWED, type Policies, type Rule } from '../core/iam/actions.js';

/** One step of an SPK, as the step policies judge it. */
export interface StepItem {
  spkStatus: SpkStatus;
  module: string;
  status: AsgStatus;
  executorRoles: readonly Role[];
  /** DEC-148: from the module catalog; null when the row has no module in code. */
  executeCapability: PermissionCode | null;
}

export const STEP_MESSAGES = {
  notExecutor: 'Only an executor of this step may submit it.',
  alreadySubmitted: 'This step is already submitted.',
  notOpen: 'This step is not open yet.',
  spkNotRunning: 'The steps of this SPK cannot be submitted now.',
  pendingFile: 'Wait until every file is ready.',
  fileNotUsable: 'A file of this step cannot be used here.',
  stepNotFound: 'This step was not found.',
  moduleNotAvailable: 'The module of this step is not available yet.',
} as const;

/** T7 to T11, T8: steps are submitted only while the SPK runs; Pending_Amendment freezes them. */
export const SUBMITTABLE_SPK: readonly SpkStatus[] = ['Active', 'In_Progress'];
/** SM-STEP, DEC-146: Open or In_Progress may be submitted (the "not paused" check is TASK-204). */
export const SUBMITTABLE_STEP: readonly AsgStatus[] = ['Open', 'In_Progress'];

/** The state of the SPK and the step allow a submit: null, or why not (HTTP 409). */
export function submitConflict(item: StepItem): string | null {
  if (!SUBMITTABLE_SPK.includes(item.spkStatus)) return STEP_MESSAGES.spkNotRunning;
  if (item.status === 'Submitted' || item.status === 'Verified') {
    return STEP_MESSAGES.alreadySubmitted;
  }
  if (!SUBMITTABLE_STEP.includes(item.status)) return STEP_MESSAGES.notOpen;
  return null;
}

/** L1 of REQ-ENG-003: the execute capability the step's own module declares (DEC-148). */
const holdsModuleCapability: Rule<StepItem> = (actor, item) => {
  if (!item.executeCapability) return STEP_MESSAGES.moduleNotAvailable;
  return actor.capabilities.has(item.executeCapability) ? null : NOT_ALLOWED;
};

/** L2 of REQ-ENG-003: one of the step's executor roles, or the System Admin (RL-3, DEC-08). */
const isExecutor: Rule<StepItem> = (actor, item) =>
  passesExecutorCheck(actor.user.role, item.executorRoles) ? null : STEP_MESSAGES.notExecutor;

const inSubmittableState: Rule<StepItem> = (_actor, item) => submitConflict(item);

/**
 * DEC-93: the step actions; the same table builds SPKDetail's `allowedActions` and checks the route.
 * `executeCodes` is the union of the registered modules' execute capabilities (DEC-149), the same
 * codes the route's guard asks for; the code of the step's own module is its rule.
 */
export function stepPolicies(
  executeCodes: readonly PermissionCode[],
): Policies<StepItem, StepAction> {
  return {
    submit: {
      anyOf: executeCodes,
      rules: [inSubmittableState, holdsModuleCapability, isExecutor],
    },
  };
}
