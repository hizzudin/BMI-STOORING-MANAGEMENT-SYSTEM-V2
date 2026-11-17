import { z } from 'zod';

/** §9.7 vendors.vendor_type (REQ-INV-014). */
export const VENDOR_KINDS = ['Supplier', 'Workshop', 'Retread', 'Shop'] as const;
export type VendorKind = (typeof VENDOR_KINDS)[number];

/** DEC-134: what the System Admin may do on SettingsVendors (its `allowedActions`). */
export const VENDORS_PAGE_ACTIONS = ['create', 'edit', 'deactivate', 'activate'] as const;
export type VendorsPageAction = (typeof VENDORS_PAGE_ACTIONS)[number];

export const VENDOR_MESSAGES = {
  codeTaken: 'This code is taken.',
  notFound: 'This vendor does not exist.',
} as const;

/** REQ-INV-014: one vendor; a deactivated one stays listed, marked Inactive (DEC-134). */
export const VendorSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  name: z.string(),
  kind: z.enum(VENDOR_KINDS),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  isActive: z.boolean(),
});
export type Vendor = z.infer<typeof VendorSchema>;

export const VendorListResponseSchema = z.object({
  vendors: z.array(VendorSchema),
  allowedActions: z.array(z.enum(VENDORS_PAGE_ACTIONS)),
});
export type VendorListResponse = z.infer<typeof VendorListResponseSchema>;

export const VendorResponseSchema = z.object({ vendor: VendorSchema });
export type VendorResponse = z.infer<typeof VendorResponseSchema>;

const fields = {
  name: z
    .string()
    .trim()
    .min(1, { error: 'Enter a name.' })
    .max(150, { error: 'A name has at most 150 characters.' }),
  kind: z.enum(VENDOR_KINDS, { error: 'Choose Supplier, Workshop, Retread or Shop.' }),
  phone: z
    .string()
    .trim()
    .max(30, { error: 'A phone number has at most 30 characters.' })
    .nullable(),
  address: z
    .string()
    .trim()
    .max(500, { error: 'An address has at most 500 characters.' })
    .nullable(),
};

/** DEC-134: a vendor's editable fields; the code is fixed once saved. */
export const VendorUpdateRequestSchema = z.object(fields);
export type VendorUpdateRequest = z.infer<typeof VendorUpdateRequestSchema>;

/** C-31: New vendor, with its code. */
export const VendorRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, { error: 'Enter a code.' })
    .max(20, { error: 'A code has at most 20 characters.' })
    .regex(/^[A-Za-z0-9_]+$/, { error: 'Use letters, digits and underscores in the code.' }),
  ...fields,
});
export type VendorRequest = z.infer<typeof VendorRequestSchema>;

/** REQ-INV-014: the active vendors a later screen picks from, optionally of one kind. */
export const VendorOptionsQuerySchema = z.object({ kind: z.enum(VENDOR_KINDS).optional() });
export type VendorOptionsQuery = z.infer<typeof VendorOptionsQuerySchema>;

export const VendorOptionsResponseSchema = z.object({
  vendors: z.array(
    z.object({
      id: z.number().int(),
      code: z.string(),
      name: z.string(),
      kind: z.enum(VENDOR_KINDS),
    }),
  ),
});
export type VendorOptionsResponse = z.infer<typeof VendorOptionsResponseSchema>;
