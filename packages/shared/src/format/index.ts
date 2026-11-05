import { type DecimalInput, parseDecimal, roundHalfUp } from '../money/index.js';

const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;
const MONEY_DECIMALS = 2;

function groupDigits(plainNumber: string): string {
  const [whole = '', fraction] = plainNumber.replace('-', '').split('.');
  const grouped = whole.replace(THOUSANDS, '.');
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}

/** Indonesian format: a dot for thousands and a comma for decimals (NFR-09, DEC-30). */
export function formatNumber(value: DecimalInput, options: { decimals?: number } = {}): string {
  const plain =
    options.decimals === undefined
      ? parseDecimal(value).toFixed()
      : roundHalfUp(value, options.decimals);
  return `${plain.startsWith('-') ? '-' : ''}${groupDigits(plain)}`;
}

/** Whole rupiah show no decimals; an amount with cents shows both digits. */
export function formatRupiah(value: DecimalInput): string {
  const plain = roundHalfUp(value, MONEY_DECIMALS);
  const digits = groupDigits(plain).replace(/,00$/, '');
  return `${plain.startsWith('-') ? '-' : ''}Rp ${digits}`;
}

export function formatKm(value: DecimalInput): string {
  return `${formatNumber(value)} km`;
}

export function formatMm(value: DecimalInput): string {
  return `${formatNumber(value)} mm`;
}
