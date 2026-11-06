import { describe, expect, it } from 'vitest';
import {
  invoiceLineAmount,
  markedUpUnitPrice,
  ppnAmount,
  roundHalfUp,
  roundToRupiah,
  toAmount,
  toAverageCost,
} from './index.js';

describe('NFR-16 stored precision', () => {
  it('NFR-16 an amount is stored with 2 decimals', () => {
    expect(toAmount('1240000')).toBe('1240000.00');
    expect(toAmount('1240000.5')).toBe('1240000.50');
  });

  it('NFR-16 an average cost is stored with 4 decimals', () => {
    expect(toAverageCost('64000')).toBe('64000.0000');
    expect(toAverageCost('64000.12345')).toBe('64000.1235');
  });

  it('NFR-16 rounds half up on the decimal value, free of binary float error', () => {
    // 1.005 as a float is below 1.005, so Number rounding would give 1.00.
    expect(toAmount('1.005')).toBe('1.01');
    expect(toAmount(1.005)).toBe('1.01');
    expect(toAmount('1.004')).toBe('1.00');
  });

  it('NFR-16 a negative tie rounds away from zero', () => {
    expect(roundToRupiah('-2.5')).toBe('-3');
  });

  it('NFR-16 a small negative rounds to plain zero', () => {
    expect(roundToRupiah('-0.2')).toBe('0');
  });

  it('NFR-16 keeps very large amounts exact', () => {
    expect(toAmount('999999999999.99')).toBe('999999999999.99');
  });

  it.each(['', 'abc', '1,5', '1.2.3'])('NFR-16 refuses the invalid amount %j', (value) => {
    expect(() => toAmount(value)).toThrow(RangeError);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('NFR-16 refuses the number %s', (value) => {
    expect(() => toAmount(value)).toThrow(RangeError);
  });
});

describe('NFR-16 invoice price and PPN', () => {
  it('NFR-16 a 50% markup on Rp 64.000 is Rp 96.000 per unit', () => {
    expect(markedUpUnitPrice('64000', '50')).toBe('96000');
  });

  it('NFR-16 a marked-up price is rounded half up to a whole rupiah per unit', () => {
    expect(markedUpUnitPrice('33.33', '50')).toBe('50');
    expect(markedUpUnitPrice('33', '50')).toBe('50');
    expect(markedUpUnitPrice('32.99', '50')).toBe('49');
  });

  it('NFR-16 the unit price is rounded before the line is multiplied', () => {
    const unitPrice = markedUpUnitPrice('33.33', '50');
    // Multiplying first would give 3 × 49,995 = 149,985.
    expect(invoiceLineAmount(unitPrice, '3')).toBe('150.00');
    expect(invoiceLineAmount(unitPrice, '18.5')).toBe('925.00');
  });

  it('NFR-16 PPN is computed on the subtotal and rounded half up to a whole rupiah', () => {
    expect(ppnAmount('1000', '11')).toBe('110');
    expect(ppnAmount('50', '11')).toBe('6');
    expect(ppnAmount('1005', '11')).toBe('111');
    expect(ppnAmount('1004', '11')).toBe('110');
  });

  it('NFR-16 a PPN rate of 0 gives 0', () => {
    expect(ppnAmount('1000000', '0')).toBe('0');
  });
});

describe('NFR-16 rounding arguments', () => {
  it.each([-1, 1.5, Number.NaN])('NFR-16 refuses %s decimal places', (decimals) => {
    expect(() => roundHalfUp('5', decimals)).toThrow(RangeError);
  });
});
