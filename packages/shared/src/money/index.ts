import Big from 'big.js';

// A private Big constructor: its rounding settings cannot leak to or from other users of big.js.
const Decimal = Big();
Decimal.RM = Big.roundHalfUp;
Decimal.DP = 20;

const AMOUNT_DECIMALS = 2;
const AVERAGE_COST_DECIMALS = 4;

/** A decimal as text (as PostgreSQL NUMERIC returns it) or a finite number. */
export type DecimalInput = string | number;

/** Reads a decimal exactly; money never goes through a binary float. */
export function parseDecimal(value: DecimalInput): Big {
  try {
    return new Decimal(value);
  } catch {
    throw new RangeError(`Not a decimal value: ${String(value)}`);
  }
}

/** Rounds half up to a fixed number of decimals; a rounded zero never keeps a minus sign. */
export function roundHalfUp(value: DecimalInput, decimals: number): string {
  const text = parseDecimal(value).toFixed(decimals);
  return new Decimal(text).eq(0) ? new Decimal(0).toFixed(decimals) : text;
}

/** An amount as stored: 2 decimals (NFR-16). */
export function toAmount(value: DecimalInput): string {
  return roundHalfUp(value, AMOUNT_DECIMALS);
}

/** An average cost as stored: 4 decimals (NFR-16). */
export function toAverageCost(value: DecimalInput): string {
  return roundHalfUp(value, AVERAGE_COST_DECIMALS);
}

/** Rounds half up to a whole rupiah (NFR-16). */
export function roundToRupiah(value: DecimalInput): string {
  return roundHalfUp(value, 0);
}

/** The invoice price of one unit: cost plus markup, in whole rupiah before any multiplication (NFR-16). */
export function markedUpUnitPrice(unitCost: DecimalInput, markupPct: DecimalInput): string {
  const factor = parseDecimal(markupPct).plus(100).div(100);
  return roundToRupiah(parseDecimal(unitCost).times(factor).toFixed());
}

/** An invoice line: the already rounded unit price times the quantity (NFR-16). */
export function invoiceLineAmount(unitPrice: DecimalInput, quantity: DecimalInput): string {
  return toAmount(parseDecimal(unitPrice).times(parseDecimal(quantity)).toFixed());
}

/** PPN on the subtotal, in whole rupiah (NFR-16). */
export function ppnAmount(subtotal: DecimalInput, ratePct: DecimalInput): string {
  return roundToRupiah(parseDecimal(subtotal).times(parseDecimal(ratePct)).div(100).toFixed());
}
