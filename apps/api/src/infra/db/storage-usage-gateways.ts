import { inArray, like } from 'drizzle-orm';
import type {
  StorageUsageGateway,
  StorageUsageGateways,
  StorageUsageSettings,
} from '../../ports/storage-usage.js';
import { DrizzleNotificationGateway } from './notification-gateways.js';
import { appSettings, notifications } from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

const BUDGET = 'storage_budget_gb';
const ALERT = 'storage_alert_pct';

const numberOf = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

/** NFR-13, DEC-137: the budget settings and the steps already notified. */
export class DrizzleStorageUsageGateway implements StorageUsageGateway {
  constructor(private readonly tx: DbTransaction) {}

  async settings(): Promise<StorageUsageSettings> {
    const rows = await this.tx
      .select({ key: appSettings.settingKey, value: appSettings.settingValue })
      .from(appSettings)
      .where(inArray(appSettings.settingKey, [BUDGET, ALERT]));
    const value = (key: string) => numberOf(rows.find((row) => row.key === key)?.value);
    return { budgetGb: value(BUDGET), alertPct: value(ALERT) };
  }

  async highestStepSent(budgetGb: number): Promise<number | null> {
    const prefix = `storage-usage:${budgetGb}:`;
    const rows = await this.tx
      .selectDistinct({ key: notifications.dedupeKey })
      .from(notifications)
      .where(like(notifications.dedupeKey, `${prefix}%`));
    const steps = rows
      .map((row) => Number(row.key?.slice(prefix.length)))
      .filter((step) => Number.isFinite(step));
    return steps.length ? Math.max(...steps) : null;
  }
}

export const storageUsageGateways = (tx: DbTransaction): StorageUsageGateways => ({
  usage: new DrizzleStorageUsageGateway(tx),
  notifications: new DrizzleNotificationGateway(tx),
});
