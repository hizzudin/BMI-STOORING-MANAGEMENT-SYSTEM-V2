import { APPROVAL_KINDS, type ApprovalKind } from '@bmi/shared';
import { inArray, sql } from 'drizzle-orm';
import type {
  PlannerApprovalGateway,
  PlannerApprovalGateways,
  PlannerApprovalState,
} from '../../ports/planner-approval.js';
import { DrizzleAuditGateway } from './account-gateways.js';
import { DrizzleNotificationGateway } from './notification-gateways.js';
import { appSettings } from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

const KINDS = 'planner_approval_kinds';
const UNTIL = 'planner_approval_until';
/** One advisory lock for the switch: the two app_settings rows may not exist yet. */
const SWITCH_LOCK_ID = 7_250_108;

const isKind = (kind: unknown): kind is ApprovalKind =>
  typeof kind === 'string' && (APPROVAL_KINDS as readonly string[]).includes(kind);

export class DrizzlePlannerApprovalGateway implements PlannerApprovalGateway {
  constructor(private readonly tx: DbTransaction) {}

  async lock(): Promise<void> {
    await this.tx.execute(sql`SELECT pg_advisory_xact_lock(${SWITCH_LOCK_ID})`);
  }

  async read(): Promise<PlannerApprovalState> {
    const rows = await this.tx
      .select({ key: appSettings.settingKey, value: appSettings.settingValue })
      .from(appSettings)
      .where(inArray(appSettings.settingKey, [KINDS, UNTIL]));
    const values = new Map(rows.map((row) => [row.key, row.value]));
    const kinds = values.get(KINDS);
    const until = values.get(UNTIL);
    return {
      kinds: Array.isArray(kinds) ? kinds.filter(isKind) : [],
      until: typeof until === 'string' ? new Date(until) : null,
    };
  }

  async write(state: PlannerApprovalState): Promise<void> {
    // A JSON null, not SQL NULL: setting_value is NOT NULL, and an empty end time means no end.
    const until = state.until ? state.until.toISOString() : sql`'null'::jsonb`;
    for (const [key, value] of [
      [KINDS, state.kinds],
      [UNTIL, until],
    ] as const) {
      await this.tx
        .insert(appSettings)
        .values({ settingKey: key, settingValue: value })
        .onConflictDoUpdate({
          target: appSettings.settingKey,
          set: { settingValue: value, updatedAt: sql`now()` },
        });
    }
  }
}

export const plannerApprovalGateways = (tx: DbTransaction): PlannerApprovalGateways => ({
  plannerApproval: new DrizzlePlannerApprovalGateway(tx),
  audit: new DrizzleAuditGateway(tx),
  notifications: new DrizzleNotificationGateway(tx),
});
