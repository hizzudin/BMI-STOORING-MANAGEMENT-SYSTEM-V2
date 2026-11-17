/** Injection tokens of the adapters the composition root wires; tests override them. */
export const PG_POOL = Symbol('PG_POOL');
export const CLOCK = Symbol('CLOCK');
export const EMAIL = Symbol('EMAIL');
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
/** DEC-118: schedules the job that ends the Planner approval switch at its end time. */
export const PLANNER_APPROVAL_END = Symbol('PLANNER_APPROVAL_END');
/** DEC-122: answers whether a vehicle has a mounted tyre or an open SPK (REQ-VEH-003, REQ-VEH-004). */
export const VEHICLE_ACTIVITY = Symbol('VEHICLE_ACTIVITY');
/** NFR-13, DEC-135: the StoragePort adapter (filesystem locally, S3 for R2 in staging and production). */
export const STORAGE = Symbol('STORAGE');
/** D-03: the adapter that serves its own signed links (the filesystem adapter only). */
export const STORAGE_LINKS = Symbol('STORAGE_LINKS');
