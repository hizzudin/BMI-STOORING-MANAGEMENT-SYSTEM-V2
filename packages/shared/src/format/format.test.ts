import { describe, expect, it } from 'vitest';
import { formatKm, formatMm, formatNumber, formatRupiah } from './index.js';

describe('NFR-09 DEC-30 Indonesian number format', () => {
  it('NFR-09 shows 48.210 km', () => {
    expect(formatKm(48210)).toBe('48.210 km');
  });

  it('NFR-09 shows Rp 1.240.000', () => {
    expect(formatRupiah('1240000.00')).toBe('Rp 1.240.000');
  });

  it('NFR-09 shows 2,4 mm', () => {
    expect(formatMm('2.4')).toBe('2,4 mm');
    expect(formatMm(2.4)).toBe('2,4 mm');
  });

  it('DEC-30 uses a dot for thousands and a comma for decimals', () => {
    expect(formatNumber('1234567.89')).toBe('1.234.567,89');
  });

  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1.000'],
    [1000000, '1.000.000'],
  ])('DEC-30 groups %s as %s', (value, expected) => {
    expect(formatNumber(value)).toBe(expected);
  });

  it('DEC-30 keeps the sign of a negative number', () => {
    expect(formatNumber('-1240.5')).toBe('-1.240,5');
    expect(formatRupiah('-1000')).toBe('-Rp 1.000');
  });

  it('DEC-30 hides trailing zeros on a measure', () => {
    expect(formatNumber('2.40')).toBe('2,4');
  });

  it('DEC-30 shows real cents on money with two decimals', () => {
    expect(formatRupiah('1240000.50')).toBe('Rp 1.240.000,50');
  });

  it('DEC-30 can show a fixed number of decimals, rounded half up', () => {
    expect(formatNumber('2.4', { decimals: 2 })).toBe('2,40');
    expect(formatNumber('2.445', { decimals: 2 })).toBe('2,45');
    expect(formatNumber('1500', { decimals: 0 })).toBe('1.500');
  });

  it('DEC-30 writes huge and tiny numbers without an exponent', () => {
    expect(formatNumber('100000000000000000000000')).toBe('100.000.000.000.000.000.000.000');
    expect(formatNumber('0.00000001')).toBe('0,00000001');
  });

  it('DEC-30 refuses a value that is not a number', () => {
    expect(() => formatNumber('abc')).toThrow(RangeError);
  });
});
