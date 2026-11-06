import { z } from 'zod';
import { formatDateWib } from '../time/wib.js';

export const DOCUMENT_KINDS = [
  'SPK',
  'RB',
  'CR',
  'GR',
  'GRC',
  'GI',
  'SA',
  'OB',
  'TR',
  'RD',
  'TC',
  'TY',
  'INVOICE',
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** A format per document kind. Tokens: {NNNN} running number, {yymmdd} and {dd-mm-yy} WIB date. */
export type NumberingConfig = Readonly<Record<DocumentKind, string>>;

const RUNNING_NUMBER_TOKEN = '{NNNN}';
const DATE_TOKENS = ['{yymmdd}', '{dd-mm-yy}'];
const MIN_RUNNING_DIGITS = 4;

/** True when a format has exactly one running number and no unknown token or stray brace. */
function isValidFormat(format: string): boolean {
  const tokens = format.match(/\{[^{}]*\}/g) ?? [];
  const literalText = tokens.reduce((rest, token) => rest.replace(token, ''), format);
  const runningNumbers = tokens.filter((token) => token === RUNNING_NUMBER_TOKEN).length;
  const everyTokenKnown = tokens.every(
    (token) => token === RUNNING_NUMBER_TOKEN || DATE_TOKENS.includes(token),
  );
  return runningNumbers === 1 && everyTokenKnown && !/[{}]/.test(literalText);
}

/** Checks the stored setting `app_settings.numbering_formats` before use (NFR-15, DEC-111). */
export const NumberingConfigSchema = z.record(
  z.enum(DOCUMENT_KINDS),
  z.string().refine(isValidFormat, 'Needs one {NNNN} and only {yymmdd} or {dd-mm-yy} besides it'),
);

/** The one numbering configuration (NFR-15, DEC-46, DEC-104, DEC-109, DEC-110). */
export const NUMBERING_CONFIG: NumberingConfig = {
  SPK: 'SPK-{yymmdd}{NNNN}',
  RB: 'RB-{yymmdd}{NNNN}',
  CR: 'CR-{yymmdd}{NNNN}',
  GR: 'GR-{yymmdd}{NNNN}',
  GRC: 'GRC-{yymmdd}{NNNN}',
  GI: 'GI-{yymmdd}{NNNN}',
  SA: 'SA-{yymmdd}{NNNN}',
  OB: 'OB-{yymmdd}{NNNN}',
  TR: 'TR-{yymmdd}{NNNN}',
  RD: 'RD-{yymmdd}{NNNN}',
  TC: 'TC-{yymmdd}{NNNN}',
  TY: 'TY-{yymmdd}{NNNN}',
  INVOICE: '{NNNN}/BMI/{dd-mm-yy}',
};

function assertRunningNumber(sequence: number | bigint): void {
  const valid =
    typeof sequence === 'bigint' ? sequence > 0n : Number.isSafeInteger(sequence) && sequence > 0;
  if (!valid) throw new RangeError(`Not a running number: ${String(sequence)}`);
}

/**
 * Builds a number from a running number of its own database sequence and the creation instant.
 * The caller passes the sequence value, so a number is never reused, also after cancel or void.
 */
export function formatDocumentNumber(
  kind: DocumentKind,
  sequence: number | bigint,
  createdAt: Date,
  config: NumberingConfig = NUMBERING_CONFIG,
): string {
  assertRunningNumber(sequence);
  const format = config[kind];
  if (!isValidFormat(format)) {
    throw new RangeError(`The ${kind} format is not valid: ${format}`);
  }
  const [year = '', month = '', day = ''] = formatDateWib(createdAt).split('-');
  const shortYear = year.slice(2);
  return format
    .replace(RUNNING_NUMBER_TOKEN, String(sequence).padStart(MIN_RUNNING_DIGITS, '0'))
    .replaceAll('{yymmdd}', `${shortYear}${month}${day}`)
    .replaceAll('{dd-mm-yy}', `${day}-${month}-${shortYear}`);
}
