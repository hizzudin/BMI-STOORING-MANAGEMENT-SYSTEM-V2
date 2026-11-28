import type { ModuleRow, PermissionCode } from '@bmi/shared';
import type {
  BoundHooksFactory,
  ModuleRefusal,
  SubmitContext,
  TxHandle,
} from '../ports/registry.js';

/**
 * TASK-203 (specs/design.md 5.26, DEC-148, DEC-149): what every module, current or future, gives the
 * engine. Its registry row is `row`; its submit behaviour is the two hooks, run inside the engine's
 * submit transaction on the module's own gateways `G`.
 */
export interface ModuleContract<G = void> {
  /** = assignment_modules.code. */
  code: string;
  /** DEC-148: one code of the 2.4 catalogue that the step's executors must hold. */
  executeCapability: PermissionCode;
  /** The values the module's migration writes into its registry row. */
  row: ModuleRow;
  /** A refusal leaves the step as it was (400 or 409 with its sentence). */
  validateSubmit?(ctx: SubmitContext, gateways: G): Promise<ModuleRefusal | null>;
  /** The module's TX; database work only, through `G` (DEC-149). A throw rolls the submit back. */
  onSubmit?(ctx: SubmitContext, gateways: G): Promise<void>;
}

/** A contract with its gateway type erased: what the catalog holds. */
export interface RegisteredModule {
  contract: ModuleContract<unknown>;
  bind: BoundHooksFactory;
}

/**
 * DEC-149: pairs a contract with the factory of its own gateways, so a wrong factory fails `tsc`
 * and the engine never meets the module's types. Used only by the composition root and the tests.
 */
export function defineModule<G>(module: {
  contract: ModuleContract<G>;
  gateways: (tx: TxHandle) => G;
}): RegisteredModule {
  const { contract, gateways } = module;
  return {
    contract: contract as ModuleContract<unknown>,
    bind: (tx) => {
      const bound = gateways(tx);
      return {
        validate: (ctx) => contract.validateSubmit?.(ctx, bound) ?? Promise.resolve(null),
        submit: (ctx) => contract.onSubmit?.(ctx, bound) ?? Promise.resolve(),
      };
    },
  };
}
