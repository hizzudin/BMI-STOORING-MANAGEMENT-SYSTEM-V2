/**
 * DEC-149: the transaction of a unit of work as an opaque value, so a module's own gateways can be
 * built on the engine's transaction while the engine never sees the database type. Only infra
 * creates one (from its transaction) and reads it back.
 */
export interface TxHandle {
  readonly __txHandle: never;
}

/** D-07: every gateway handed to the work shares one transaction; each TX-* of §9.13 is one `run`. */
export interface UnitOfWork<Gateways> {
  run<T>(work: (gateways: Gateways) => Promise<T>): Promise<T>;
}
