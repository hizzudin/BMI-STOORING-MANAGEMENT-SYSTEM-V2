import { describe, expect, it } from 'vitest';
import { DocumentTypeRequestSchema, DocumentTypeUpdateRequestSchema } from './document-types.js';

const kir = {
  code: 'KIR',
  name: ' KIR ',
  usualValidityMonths: 6,
  warningDays: 30,
  receiptRequired: true,
  classIds: [1, 3],
};

const issue = (body: unknown) =>
  DocumentTypeRequestSchema.safeParse(body).error?.issues[0]?.message;

describe('REQ-DOC-002 DEC-121 a document type', () => {
  it('takes code, name, usual validity, warning days, receipt and the required classes', () => {
    expect(DocumentTypeRequestSchema.parse(kir)).toEqual({ ...kir, name: 'KIR' });
    expect(
      DocumentTypeRequestSchema.parse({ ...kir, usualValidityMonths: null }).usualValidityMonths,
    ).toBeNull();
  });

  it('refuses a bad code, an empty name, warning days of 0 and a class twice', () => {
    expect(issue({ ...kir, code: 'KIR 2' })).toBe(
      'Use letters, digits and underscores in the code.',
    );
    expect(issue({ ...kir, code: '' })).toBe('Enter a code.');
    expect(issue({ ...kir, code: 'K'.repeat(31) })).toBe('A code has at most 30 characters.');
    expect(issue({ ...kir, name: '' })).toBe('Enter a name.');
    expect(issue({ ...kir, name: 'n'.repeat(101) })).toBe('A name has at most 100 characters.');
    expect(issue({ ...kir, warningDays: 0 })).toBe('Warning days are at least 1.');
    expect(issue({ ...kir, warningDays: 366 })).toBe('Warning days are at most 365.');
    expect(issue({ ...kir, warningDays: 2.5 })).toBe('Give the warning days as a whole number.');
    expect(issue({ ...kir, usualValidityMonths: 0 })).toBe(
      'The usual validity is at least 1 month.',
    );
    expect(issue({ ...kir, usualValidityMonths: 241 })).toBe(
      'The usual validity is at most 240 months.',
    );
    expect(issue({ ...kir, classIds: [1, 1] })).toBe('Tick each class once.');
  });

  it('DEC-121 an edit carries no code: the code is fixed once saved', () => {
    const { code: _code, ...edit } = kir;
    expect(DocumentTypeUpdateRequestSchema.parse({ ...edit, code: 'X' })).not.toHaveProperty(
      'code',
    );
  });
});
