import { blockedInSetupMode, type PermissionCode, type Role, type SystemMode } from '@bmi/shared';

/** REQ-IAM-008: the approval kinds the Access Manager ticks when switching Planner approval on. */
export const APPROVAL_KINDS = [
  'spk_creation',
  'spk_amendment',
  'spk_completion',
  'stock_opname',
  'tyre_count',
] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

const SPK_KINDS: readonly ApprovalKind[] = ['spk_creation', 'spk_amendment', 'spk_completion'];
const COUNT_KINDS: readonly ApprovalKind[] = ['stock_opname', 'tyre_count'];

export interface PlannerApproval {
  /** Ticked kinds; none ticked means the switch is off. */
  kinds: readonly ApprovalKind[];
  /** Optional end time; once passed the switch counts as off. */
  until: Date | null;
}

export interface CapabilityInputs {
  role: Role | null;
  /** The `role_permissions` codes of the role with `allowed = true`. */
  allowedCodes: readonly PermissionCode[];
  plannerApproval: PlannerApproval;
  systemMode: SystemMode;
  now: Date;
}

export function plannerApprovalOn({ kinds, until }: PlannerApproval, now: Date): boolean {
  return kinds.length > 0 && (until === null || until > now);
}

/**
 * PRD 2.4, REQ-IAM-012, DEC-93: the one effective capability set, used by the endpoint guard, the
 * record policies, the menu and GET /me. role_permissions of the role, plus the Planner approval switch
 * while it is on, minus what Setup mode blocks.
 */
export function effectiveCapabilities(inputs: CapabilityInputs): Set<PermissionCode> {
  const { role, allowedCodes, plannerApproval, systemMode, now } = inputs;
  if (!role) return new Set();
  const codes = new Set<PermissionCode>(allowedCodes);
  if (role === 'Planner' && plannerApprovalOn(plannerApproval, now)) {
    if (plannerApproval.kinds.some((kind) => SPK_KINDS.includes(kind))) codes.add('spk.approve');
    if (plannerApproval.kinds.some((kind) => COUNT_KINDS.includes(kind)))
      codes.add('count.approve');
  }
  if (systemMode === 'Setup') {
    for (const code of [...codes]) if (blockedInSetupMode(code)) codes.delete(code);
  }
  // RL-4: the System Admin never manages accounts, whatever the stored rows say.
  if (role === 'System_Admin') {
    codes.delete('accounts.manage');
    codes.delete('iam.planner_approval_switch');
  }
  return codes;
}
