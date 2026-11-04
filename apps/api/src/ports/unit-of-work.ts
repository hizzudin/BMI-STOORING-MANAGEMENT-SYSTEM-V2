/** D-07: every gateway handed to the work shares one transaction; each TX-* of §9.13 is one `run`. */
export interface UnitOfWork<Gateways> {
  run<T>(work: (gateways: Gateways) => Promise<T>): Promise<T>;
}
