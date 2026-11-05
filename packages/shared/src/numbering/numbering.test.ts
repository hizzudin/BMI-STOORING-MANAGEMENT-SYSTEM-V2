import { describe, expect, it } from 'vitest';
import { DOCUMENT_KINDS, formatDocumentNumber, NUMBERING_CONFIG } from './index.js';

const wibNov4 = new Date('2026-11-04T02:00:00Z');

describe('NFR-15 DEC-110 document numbers', () => {
  it('NFR-15 builds an SPK number as SPK-yymmddNNNN', () => {
    expect(formatDocumentNumber('SPK', 142, wibNov4)).toBe('SPK-2611040142');
  });

  it.each([
    ['RB', 'RB-2611040007'],
    ['CR', 'CR-2611040007'],
    ['GR', 'GR-2611040007'],
    ['GRC', 'GRC-2611040007'],
    ['GI', 'GI-2611040007'],
    ['SA', 'SA-2611040007'],
    ['OB', 'OB-2611040007'],
    ['TR', 'TR-2611040007'],
    ['RD', 'RD-2611040007'],
    ['TC', 'TC-2611040007'],
    ['TY', 'TY-2611040007'],
  ] as const)('DEC-110 builds %s as %s', (kind, expected) => {
    expect(formatDocumentNumber(kind, 7, wibNov4)).toBe(expected);
  });

  it('NFR-15 yymmdd is the WIB date, not the UTC date', () => {
    expect(formatDocumentNumber('GR', 1, new Date('2026-11-04T16:59:59Z'))).toBe('GR-2611040001');
    expect(formatDocumentNumber('GR', 1, new Date('2026-11-04T17:00:00Z'))).toBe('GR-2611050001');
  });

  it('NFR-15 the running number has four digits and widens when needed', () => {
    expect(formatDocumentNumber('SPK', 1, wibNov4)).toBe('SPK-2611040001');
    expect(formatDocumentNumber('SPK', 9999, wibNov4)).toBe('SPK-2611049999');
    expect(formatDocumentNumber('SPK', 10000, wibNov4)).toBe('SPK-26110410000');
  });

  it('NFR-15 takes a bigint running number from a database sequence', () => {
    expect(formatDocumentNumber('SPK', 142n, wibNov4)).toBe('SPK-2611040142');
  });

  it.each([0, -1, 1.5, Number.NaN])('NFR-15 refuses the running number %s', (sequence) => {
    expect(() => formatDocumentNumber('SPK', sequence, wibNov4)).toThrow(RangeError);
  });

  it('NFR-15 refuses a running number of zero as a bigint', () => {
    expect(() => formatDocumentNumber('SPK', 0n, wibNov4)).toThrow(RangeError);
  });
});

describe('NFR-15 DEC-46 invoice number', () => {
  it('DEC-46 builds an invoice number as NNNN/BMI/dd-mm-yy', () => {
    expect(formatDocumentNumber('INVOICE', 102, new Date('2026-10-26T02:00:00Z'))).toBe(
      '0102/BMI/26-10-26',
    );
  });

  it('DEC-46 uses the WIB date of the issue', () => {
    expect(formatDocumentNumber('INVOICE', 1, new Date('2026-10-26T17:00:00Z'))).toBe(
      '0001/BMI/27-10-26',
    );
  });
});

describe('NFR-15 one numbering configuration', () => {
  it('NFR-15 has one format for every document kind', () => {
    expect(Object.keys(NUMBERING_CONFIG).sort()).toEqual([...DOCUMENT_KINDS].sort());
  });

  it('NFR-15 a changed format needs no code change', () => {
    const changed = { ...NUMBERING_CONFIG, GR: 'GRN/{yymmdd}/{NNNN}' };
    expect(formatDocumentNumber('GR', 5, wibNov4, changed)).toBe('GRN/261104/0005');
  });

  it('NFR-15 refuses a format with no running number, which could repeat a number', () => {
    const broken = { ...NUMBERING_CONFIG, GR: 'GR-{yymmdd}' };
    expect(() => formatDocumentNumber('GR', 5, wibNov4, broken)).toThrow(RangeError);
  });
});
