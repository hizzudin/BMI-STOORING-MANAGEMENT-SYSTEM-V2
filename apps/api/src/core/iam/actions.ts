import type { PermissionCode, SessionUser } from '@bmi/shared';

/** Who asks: the signed-in account and its effective capability set (PRD 2.4). */
export interface Actor {
  user: SessionUser;
  capabilities: ReadonlySet<PermissionCode>;
}

/**
 * L2 record rule: null when the action may go ahead, otherwise the one sentence that refuses it.
 * `input` is the payload of the action when it is sent; when the list of allowed actions is built there
 * is no payload yet, so a rule that needs one (BR-02 scope lock) answers null without it.
 */
export type Rule<Entity> = (actor: Actor, record: Entity, input?: unknown) => string | null;

export interface ActionPolicy<Entity> {
  /** L1: the action needs at least one of these codes. */
  anyOf: readonly PermissionCode[];
  /** L2: every rule must pass. */
  rules?: readonly Rule<Entity>[];
}

/** One policy per action of a record type; the same table answers "may I?" and "what may I?". */
export type Policies<Entity, Action extends string> = Readonly<
  Record<Action, ActionPolicy<Entity>>
>;

export const NOT_ALLOWED = 'You do not have permission to do this.';

/** HTTP maps it to 403; the sentence tells the user why (C-34). */
export class ActionRefusedError extends Error {
  constructor(
    readonly action: string,
    message: string,
  ) {
    super(message);
    this.name = 'ActionRefusedError';
  }
}

/** L1 then L2, in one place (REQ-IAM-014): the sentence that refuses the action, or null. */
export function refusalOf<Entity, Action extends string>(
  policies: Policies<Entity, Action>,
  actor: Actor,
  record: Entity,
  action: Action,
  input?: unknown,
): string | null {
  const policy = policies[action];
  if (!policy.anyOf.some((code) => actor.capabilities.has(code))) return NOT_ALLOWED;
  for (const rule of policy.rules ?? []) {
    const refusal = rule(actor, record, input);
    if (refusal) return refusal;
  }
  return null;
}

/** REQ-IAM-014: what the signed-in user may do on this record now, for the response. */
export function allowedActions<Entity, Action extends string>(
  policies: Policies<Entity, Action>,
  actor: Actor,
  record: Entity,
): Action[] {
  return (Object.keys(policies) as Action[]).filter(
    (action) => refusalOf(policies, actor, record, action) === null,
  );
}

/** The check made when the action is sent: the same function that built the list. */
export function assertAllowed<Entity, Action extends string>(
  policies: Policies<Entity, Action>,
  actor: Actor,
  record: Entity,
  action: Action,
  input?: unknown,
): void {
  const refusal = refusalOf(policies, actor, record, action, input);
  if (refusal) throw new ActionRefusedError(action, refusal);
}

/** The record must be in one of these states (PRD 3: the state machine decides). */
export function inState<Entity, State extends string>(
  stateOf: (record: Entity) => State,
  states: readonly State[],
  refusal: string,
): Rule<Entity> {
  return (_actor, record) => (states.includes(stateOf(record)) ? null : refusal);
}

/**
 * BR-03: nobody decides on their own work (create and approve, execute and verify, count and approve).
 * The one exception the rule itself names is the System Admin, whose decision is marked as a self
 * decision; use `isSelfDecision` to set that mark.
 */
export function notOwnWork<Entity>(
  ownerOf: (record: Entity) => number | null,
  refusal: string,
): Rule<Entity> {
  return (actor, record) =>
    ownerOf(record) === actor.user.id && actor.user.role !== 'System_Admin' ? refusal : null;
}

/** BR-03: true when the System Admin decides on its own work; stamp and audit log mark it. */
export function isSelfDecision(actor: Actor, ownerId: number | null): boolean {
  return ownerId === actor.user.id;
}

/** Only this user may act, e.g. the creator of a draft. */
export function onlyOwner<Entity>(
  ownerOf: (record: Entity) => number | null,
  refusal: string,
): Rule<Entity> {
  return (actor, record) => (ownerOf(record) === actor.user.id ? null : refusal);
}

/**
 * BR-02 scope lock: the payload may only name what the record names. Without a payload (while the
 * list of allowed actions is built) the rule passes; the server checks it again when the action is sent.
 */
export function withinScope<Entity>(
  inScope: (record: Entity, input: unknown) => boolean,
  refusal: string,
): Rule<Entity> {
  return (_actor, record, input) =>
    input === undefined || inScope(record, input) ? null : refusal;
}
