import {
  CompletionSectionSchema,
  ConfigSchemaSchema,
  CreationSchemaSchema,
  ScopeRulesSchema,
  type Role,
} from '@bmi/shared';
import { asc, eq } from 'drizzle-orm';
import type { RegistryGateway, RegistryGateways, StoredModuleRow } from '../../ports/registry.js';
import { DrizzleAuditGateway } from './account-gateways.js';
import { DrizzleIdempotencyGateway } from './idempotency-gateway.js';
import { assignmentModules } from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

const columns = {
  id: assignmentModules.id,
  code: assignmentModules.code,
  name: assignmentModules.name,
  uiComponent: assignmentModules.uiComponent,
  configSchema: assignmentModules.configSchema,
  creationSchema: assignmentModules.creationSchema,
  executorRoles: assignmentModules.executorRoles,
  scopeRules: assignmentModules.scopeRules,
  completionSection: assignmentModules.completionSection,
  costKind: assignmentModules.costKind,
  tracksWorkTime: assignmentModules.tracksWorkTime,
  isActive: assignmentModules.isActive,
  sortOrder: assignmentModules.sortOrder,
};

interface Selected {
  id: number;
  code: string;
  name: string;
  uiComponent: string;
  configSchema: unknown;
  creationSchema: unknown;
  executorRoles: string[];
  scopeRules: unknown;
  completionSection: unknown;
  costKind: string;
  tracksWorkTime: boolean;
  isActive: boolean;
  sortOrder: number;
}

/** A stored row read with the shared shapes (DEC-149); a row that does not fit is a defect. */
function toRow(row: Selected): StoredModuleRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    uiComponent: row.uiComponent,
    configSchema: ConfigSchemaSchema.nullable().parse(row.configSchema),
    creationSchema: CreationSchemaSchema.nullable().parse(row.creationSchema),
    executorRoles: row.executorRoles as Role[],
    scopeRules: ScopeRulesSchema.parse(row.scopeRules),
    completionSection: CompletionSectionSchema.parse(row.completionSection),
    costKind: row.costKind as StoredModuleRow['costKind'],
    tracksWorkTime: row.tracksWorkTime,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

/** TASK-203: §9.6 assignment_modules for the registry service (specs/design.md 5.26). */
export class DrizzleRegistryGateway implements RegistryGateway {
  constructor(private readonly db: DbTransaction) {}

  async list(): Promise<StoredModuleRow[]> {
    const rows = await this.db
      .select(columns)
      .from(assignmentModules)
      .orderBy(asc(assignmentModules.sortOrder), asc(assignmentModules.name));
    return rows.map(toRow);
  }

  async lock(code: string): Promise<StoredModuleRow | null> {
    const [row] = await this.db
      .select(columns)
      .from(assignmentModules)
      .where(eq(assignmentModules.code, code))
      .for('update');
    return row ? toRow(row) : null;
  }

  async setActive(code: string, isActive: boolean, at: Date): Promise<void> {
    await this.db
      .update(assignmentModules)
      .set({ isActive, updatedAt: at })
      .where(eq(assignmentModules.code, code));
  }
}

export const registryGateways = (tx: DbTransaction): RegistryGateways => ({
  modules: new DrizzleRegistryGateway(tx),
  audit: new DrizzleAuditGateway(tx),
  idempotency: new DrizzleIdempotencyGateway(tx),
});
