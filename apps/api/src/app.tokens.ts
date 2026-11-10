/** Injection tokens of the adapters the composition root wires; tests override them. */
export const PG_POOL = Symbol('PG_POOL');
export const CLOCK = Symbol('CLOCK');
export const EMAIL = Symbol('EMAIL');
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
/** DEC-118: schedules the job that ends the Planner approval switch at its end time. */
export const PLANNER_APPROVAL_END = Symbol('PLANNER_APPROVAL_END');
