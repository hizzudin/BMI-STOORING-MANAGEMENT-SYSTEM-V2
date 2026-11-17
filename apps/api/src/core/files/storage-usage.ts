import type { StoragePort } from '../../ports/storage.js';
import type { StorageUsageGateways } from '../../ports/storage-usage.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

const GB = 1024 ** 3;
const STEP_PCT = 5;
/** §9.12 defaults of app_settings. */
const DEFAULT_BUDGET_GB = 50;
const DEFAULT_ALERT_PCT = 80;
/** A float like 80.00000000000001 is 80, never 79. */
const EPSILON = 1e-9;

/** DEC-137: the 5% step reached, from the alert percentage on, or null below it. */
export function usageStep(pct: number, alertPct: number): number | null {
  if (pct + EPSILON < alertPct) return null;
  return alertPct + STEP_PCT * Math.floor((pct - alertPct + EPSILON) / STEP_PCT);
}

/** DEC-137: the notice text. */
export function usageNotice(
  usedBytes: number,
  budgetGb: number,
  pct: number,
): { title: string; body: string } {
  return {
    title: `File storage is ${Math.floor(pct + EPSILON)}% full`,
    body: `${(usedBytes / GB).toFixed(1)} GB of the ${budgetGb} GB budget is used.`,
  };
}

export interface StorageUsageResult {
  usedBytes: number;
  budgetGb: number;
  /** The whole percentage used. */
  pct: number;
  step: number | null;
  /** How many System Admins got a new notice. */
  notified: number;
}

/**
 * NFR-13, DEC-137: the daily check of total storage use. The System Admin is notified once per 5%
 * step from the alert percentage, each step once per budget; a rerun adds nothing (NFR-12).
 */
export class StorageUsageCheck {
  constructor(
    private readonly unitOfWork: UnitOfWork<StorageUsageGateways>,
    private readonly storage: StoragePort,
  ) {}

  async run(): Promise<StorageUsageResult> {
    const usedBytes = await this.storage.totalBytes();
    return this.unitOfWork.run(async ({ usage, notifications }) => {
      const settings = await usage.settings();
      const budgetGb = settings.budgetGb ?? DEFAULT_BUDGET_GB;
      const alertPct = settings.alertPct ?? DEFAULT_ALERT_PCT;
      const exact = (usedBytes / (budgetGb * GB)) * 100;
      const pct = Math.floor(exact + EPSILON);
      const step = usageStep(exact, alertPct);
      const result = { usedBytes, budgetGb, pct, step, notified: 0 };
      if (step === null) return result;
      const sent = await usage.highestStepSent(budgetGb);
      if (sent !== null && sent >= step) return result;
      const admins = await notifications.activeUsersWithRoles(['System_Admin']);
      await notifications.send(admins, {
        kind: 'Alert',
        ...usageNotice(usedBytes, budgetGb, exact),
        linkRecord: null,
        dedupeKey: `storage-usage:${budgetGb}:${step}`,
      });
      return { ...result, notified: admins.length };
    });
  }
}
