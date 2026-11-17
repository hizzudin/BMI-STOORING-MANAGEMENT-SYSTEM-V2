import type { NotificationGateway } from './notifications.js';

/** §9.12 app_settings: `storage_budget_gb` and `storage_alert_pct`, null when a key is missing. */
export interface StorageUsageSettings {
  budgetGb: number | null;
  alertPct: number | null;
}

export interface StorageUsageGateway {
  settings(): Promise<StorageUsageSettings>;
  /** DEC-137: the highest step already notified for this budget, from the dedupe keys. */
  highestStepSent(budgetGb: number): Promise<number | null>;
}

export interface StorageUsageGateways {
  usage: StorageUsageGateway;
  notifications: NotificationGateway;
}
