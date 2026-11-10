import { PERMISSION_CODES, type PermissionCode, type Role, type SystemMode } from '@bmi/shared';
import type { ClockPort } from '../../ports/clock.js';
import type { IamGateways } from '../../ports/iam.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { APPROVAL_KINDS, effectiveCapabilities, type ApprovalKind } from './capabilities.js';

const isCode = (code: string): code is PermissionCode =>
  (PERMISSION_CODES as readonly string[]).includes(code);
const isKind = (kind: string): kind is ApprovalKind =>
  (APPROVAL_KINDS as readonly string[]).includes(kind);

export interface CapabilitySnapshot {
  capabilities: Set<PermissionCode>;
  systemMode: SystemMode;
}

/**
 * REQ-IAM-012: read on every request, never cached, so a change to the matrix or the Planner approval
 * switch, or the switch's end time passing, shows on the next request without a new sign-in.
 */
export class CapabilityService {
  constructor(
    private readonly unitOfWork: UnitOfWork<IamGateways>,
    private readonly clock: ClockPort,
  ) {}

  forRole(role: Role | null): Promise<CapabilitySnapshot> {
    return this.unitOfWork.run(async ({ capabilities }) => {
      const systemMode = await capabilities.systemMode();
      if (!role) return { capabilities: new Set(), systemMode };
      const [codes, switched] = await Promise.all([
        capabilities.allowedCodes(role),
        capabilities.plannerApproval(),
      ]);
      return {
        systemMode,
        capabilities: effectiveCapabilities({
          role,
          // Only codes of the 2.4 catalogue exist; anything else in the table is ignored.
          allowedCodes: codes.filter(isCode),
          plannerApproval: { kinds: switched.kinds.filter(isKind), until: switched.until },
          systemMode,
          now: this.clock.now(),
        }),
      };
    });
  }
}
