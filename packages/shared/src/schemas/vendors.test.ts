import { describe, expect, it } from 'vitest';
import { VENDOR_KINDS, VendorRequestSchema, VendorUpdateRequestSchema } from './vendors.js';

const supplier = {
  code: 'SUMBER_FILTER',
  name: ' PT Sumber Filter ',
  kind: 'Supplier',
  phone: '021-555-0101',
  address: 'Jl. Industri 12, Cikarang',
};

const issue = (body: unknown) => VendorRequestSchema.safeParse(body).error?.issues[0]?.message;

describe('REQ-INV-014 DEC-134 a vendor', () => {
  it('offers the four kinds of §9', () => {
    expect(VENDOR_KINDS).toEqual(['Supplier', 'Workshop', 'Retread', 'Shop']);
  });

  it('takes code, name, kind, phone and address; phone and address may be empty', () => {
    expect(VendorRequestSchema.parse(supplier)).toEqual({ ...supplier, name: 'PT Sumber Filter' });
    expect(VendorRequestSchema.parse({ ...supplier, phone: null, address: null })).toMatchObject({
      phone: null,
      address: null,
    });
  });

  it('refuses a bad code, an empty name, an unknown kind and long values', () => {
    expect(issue({ ...supplier, code: 'SUMBER FILTER' })).toBe(
      'Use letters, digits and underscores in the code.',
    );
    expect(issue({ ...supplier, code: '' })).toBe('Enter a code.');
    expect(issue({ ...supplier, code: 'V'.repeat(21) })).toBe('A code has at most 20 characters.');
    expect(issue({ ...supplier, name: '' })).toBe('Enter a name.');
    expect(issue({ ...supplier, name: 'n'.repeat(151) })).toBe(
      'A name has at most 150 characters.',
    );
    expect(issue({ ...supplier, kind: 'Bank' })).toBe(
      'Choose Supplier, Workshop, Retread or Shop.',
    );
    expect(issue({ ...supplier, phone: '1'.repeat(31) })).toBe(
      'A phone number has at most 30 characters.',
    );
    expect(issue({ ...supplier, address: 'a'.repeat(501) })).toBe(
      'An address has at most 500 characters.',
    );
  });

  it('DEC-134 an edit carries no code: the code is fixed once saved', () => {
    const { code: _code, ...edit } = supplier;
    expect(VendorUpdateRequestSchema.parse({ ...edit, code: 'OTHER' })).not.toHaveProperty('code');
  });
});
