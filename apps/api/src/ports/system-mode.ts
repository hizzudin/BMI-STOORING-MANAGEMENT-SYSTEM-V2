import type { Role, SystemMode } from '@bmi/shared';
import type { AuditGateway } from './accounts.js';
import type { IdempotencyGateway } from './idempotency.js';

/** app_settings system_mode and went_live_at (REQ-IAM-010, DEC-132). */
export interface SystemModeGateway {
  read(): Promise<{ mode: SystemMode; wentLiveAt: Date | null }>;
  /** Writes the mode; `wentLiveAt` is written with a Go live. */
  write(mode: SystemMode, wentLiveAt?: Date): Promise<void>;
  /** What the SetupGoLive checklist counts: active accounts, master data, vehicles. */
  counts(): Promise<{ accounts: number; masterData: number; vehicles: number }>;
  /** DEC-132: ends every open session of an account whose role is not one of these. */
  revokeSessionsExceptRoles(roles: readonly Role[], at: Date): Promise<void>;
}

export interface SystemModeGateways {
  systemMode: SystemModeGateway;
  audit: AuditGateway;
  idempotency: IdempotencyGateway;
}
