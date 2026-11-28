import type { ModuleRow, PermissionCode } from '@bmi/shared';
import type { Actor } from '../core/iam/actions.js';
import type { AuditGateway } from './accounts.js';
import type { IdempotencyGateway } from './idempotency.js';
import type { TxHandle } from './unit-of-work.js';

export type { TxHandle };

/** What a module's submit hooks receive (specs/design.md 5.26). */
export interface SubmitContext {
  spkId: number;
  stepId: number;
  sequenceNo: number;
  /** The frozen step options; the module parses them with its own schema (DEC-149). */
  stepConfig: unknown;
  actor: Actor;
  fileIds: readonly number[];
  now: Date;
}

/** A module's refusal of a submit: 400 for the input, 409 for a state another action changed. */
export interface ModuleRefusal {
  status: 400 | 409;
  sentence: string;
}

/** A module's hooks bound to the gateways of one transaction. */
export interface BoundHooks {
  validate(ctx: SubmitContext): Promise<ModuleRefusal | null>;
  submit(ctx: SubmitContext): Promise<void>;
}

export type BoundHooksFactory = (tx: TxHandle) => BoundHooks;

/**
 * DEC-149: the narrow port through which the engine and `core/spk` learn what a module code may do,
 * without importing any module.
 */
export interface ModuleCatalog {
  /** DEC-148: the execute capability the module's contract declares; null for a row with no code. */
  executeCapabilityOf(code: string): PermissionCode | null;
  /** The union over every registered module, sorted, each once. */
  executeCapabilities(): readonly PermissionCode[];
  hooksOf(code: string): BoundHooksFactory | null;
  isImplemented(code: string): boolean;
}

/** A row as stored, with its id for the audit record. */
export type StoredModuleRow = ModuleRow & { id: number };

/** §9.6 assignment_modules, read and changed by the registry service. */
export interface RegistryGateway {
  /** Every row, by `sort_order`, then `name`. */
  list(): Promise<StoredModuleRow[]>;
  /** The row held for update; null when absent. */
  lock(code: string): Promise<StoredModuleRow | null>;
  setActive(code: string, isActive: boolean, at: Date): Promise<void>;
}

export interface RegistryGateways {
  modules: RegistryGateway;
  audit: AuditGateway;
  idempotency: IdempotencyGateway;
}
