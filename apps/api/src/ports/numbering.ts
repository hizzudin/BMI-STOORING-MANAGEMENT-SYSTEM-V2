import type { DocumentKind } from '@bmi/shared';

/**
 * NFR-15, DEC-111: the codes whose sequence exists so far. Each later task that issues a number adds
 * its code with the sequence §9 gives it (RB report_number_seq, CR cr_number_seq, ...).
 */
export type NumberedKind = Extract<DocumentKind, 'SPK'>;

/** The setting numbering_formats is missing or does not pass NumberingConfigSchema (DEC-111). */
export class NumberingConfigError extends Error {
  constructor(detail: string) {
    super(`The numbering formats cannot be used: ${detail}`);
    this.name = 'NumberingConfigError';
  }
}

/** Issues document numbers inside the caller's transaction (the number is taken, never given back). */
export interface DocumentNumberGateway {
  /** The next number of `kind` for a document created at `createdAt` (its WIB date). */
  next(kind: NumberedKind, createdAt: Date): Promise<string>;
}
