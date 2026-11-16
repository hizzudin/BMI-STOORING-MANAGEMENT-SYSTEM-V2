import type { Role, SystemMode } from '@bmi/shared';
import { and, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import type { SystemModeGateway, SystemModeGateways } from '../../ports/system-mode.js';
import { DrizzleAuditGateway } from './account-gateways.js';
import { DrizzleIdempotencyGateway } from './idempotency-gateway.js';
import {
  appSettings,
  authSessions,
  documentTypes,
  userRoles,
  users,
  vehicleClasses,
  vehicles,
} from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

const SYSTEM_MODE = 'system_mode';
const WENT_LIVE_AT = 'went_live_at';

/** REQ-IAM-010, DEC-132: the mode keys of app_settings, the checklist counts and the session cut. */
export class DrizzleSystemModeGateway implements SystemModeGateway {
  constructor(private readonly tx: DbTransaction) {}

  async read(): Promise<{ mode: SystemMode; wentLiveAt: Date | null }> {
    const rows = await this.tx
      .select({ key: appSettings.settingKey, value: appSettings.settingValue })
      .from(appSettings)
      .where(inArray(appSettings.settingKey, [SYSTEM_MODE, WENT_LIVE_AT]));
    const settings = new Map(rows.map((row) => [row.key, row.value]));
    const wentLiveAt = settings.get(WENT_LIVE_AT);
    return {
      // REQ-IAM-010: the system starts in Setup mode until Go live writes Live.
      mode: settings.get(SYSTEM_MODE) === 'Live' ? 'Live' : 'Setup',
      wentLiveAt: typeof wentLiveAt === 'string' ? new Date(wentLiveAt) : null,
    };
  }

  async write(mode: SystemMode, wentLiveAt?: Date): Promise<void> {
    await this.upsert(SYSTEM_MODE, mode);
    if (wentLiveAt) await this.upsert(WENT_LIVE_AT, wentLiveAt.toISOString());
  }

  async counts(): Promise<{ accounts: number; masterData: number; vehicles: number }> {
    const count = sql<number>`count(*)::int`;
    const [accounts] = await this.tx
      .select({ count })
      .from(users)
      .where(and(eq(users.isActive, true), isNull(users.deletedAt)));
    const [classes] = await this.tx
      .select({ count })
      .from(vehicleClasses)
      .where(eq(vehicleClasses.isActive, true));
    const [types] = await this.tx
      .select({ count })
      .from(documentTypes)
      .where(eq(documentTypes.isActive, true));
    const [fleet] = await this.tx
      .select({ count })
      .from(vehicles)
      .where(isNull(vehicles.deletedAt));
    return {
      accounts: accounts?.count ?? 0,
      masterData: (classes?.count ?? 0) + (types?.count ?? 0),
      vehicles: fleet?.count ?? 0,
    };
  }

  async revokeSessionsExceptRoles(roles: readonly Role[], at: Date): Promise<void> {
    const kept = this.tx
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(inArray(userRoles.role, [...roles]));
    await this.tx
      .update(authSessions)
      .set({ revokedAt: at, updatedAt: sql`now()` })
      .where(and(isNull(authSessions.revokedAt), notInArray(authSessions.userId, kept)));
  }

  private async upsert(key: string, value: unknown): Promise<void> {
    await this.tx
      .insert(appSettings)
      .values({ settingKey: key, settingValue: value })
      .onConflictDoUpdate({
        target: appSettings.settingKey,
        set: { settingValue: value, updatedAt: sql`now()` },
      });
  }
}

export const systemModeGateways = (tx: DbTransaction): SystemModeGateways => ({
  systemMode: new DrizzleSystemModeGateway(tx),
  audit: new DrizzleAuditGateway(tx),
  idempotency: new DrizzleIdempotencyGateway(tx),
});
