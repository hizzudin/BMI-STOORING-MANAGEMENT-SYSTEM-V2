import type { SessionUser, PermissionCode } from '@bmi/shared';

/** Who asks: the signed-in account and its effective capability set (PRD 2.4). */
export interface Actor {
  user: SessionUser;
  capabilities: ReadonlySet<PermissionCode>;
}