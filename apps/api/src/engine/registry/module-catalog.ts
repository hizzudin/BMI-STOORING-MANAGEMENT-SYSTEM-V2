import { ModuleRowSchema, type PermissionCode } from '@bmi/shared';
import type { BoundHooksFactory, ModuleCatalog } from '../../ports/registry.js';
import type { ModuleContract, RegisteredModule } from '../module-contract.js';

/**
 * TASK-203 (specs/design.md 5.26): the modules in code, as the composition root hands them over.
 * Pure: the engine and `core/spk` ask it through the `ModuleCatalog` port (DEC-149).
 */
export class ModuleCatalogService implements ModuleCatalog {
  private readonly byCode = new Map<string, RegisteredModule>();
  private readonly codes: readonly PermissionCode[];

  constructor(modules: readonly RegisteredModule[]) {
    for (const module of modules) {
      const { code, row } = module.contract;
      if (this.byCode.has(code)) throw new Error(`Two modules share the code ${code}.`);
      const parsed = ModuleRowSchema.safeParse(row);
      if (!parsed.success || row.code !== code) {
        const why = parsed.success ? `its row code is ${row.code}` : parsed.error.message;
        throw new Error(`The registry row of module ${code} is invalid: ${why}`);
      }
      this.byCode.set(code, module);
    }
    this.codes = [...new Set(modules.map((m) => m.contract.executeCapability))].sort();
  }

  contractOf(code: string): ModuleContract<unknown> | null {
    return this.byCode.get(code)?.contract ?? null;
  }

  executeCapabilityOf(code: string): PermissionCode | null {
    return this.contractOf(code)?.executeCapability ?? null;
  }

  executeCapabilities(): readonly PermissionCode[] {
    return this.codes;
  }

  hooksOf(code: string): BoundHooksFactory | null {
    return this.byCode.get(code)?.bind ?? null;
  }

  isImplemented(code: string): boolean {
    return this.byCode.has(code);
  }
}
