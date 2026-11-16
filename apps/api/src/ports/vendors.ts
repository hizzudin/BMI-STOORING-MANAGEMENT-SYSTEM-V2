import type { VendorKind } from '@bmi/shared';
import type { AuditGateway } from './accounts.js';

/** §9.7 vendors (REQ-INV-014). */
export interface VendorRow {
  id: number;
  code: string;
  name: string;
  kind: VendorKind;
  phone: string | null;
  address: string | null;
  isActive: boolean;
}

export type VendorFields = Pick<VendorRow, 'name' | 'kind' | 'phone' | 'address'>;

export interface VendorGateway {
  /** Every vendor that is not deleted, active or not, by name. */
  list(): Promise<VendorRow[]>;
  /** Active vendors by name, of one kind when given: the pick list of later screens. */
  listActive(kind?: VendorKind): Promise<VendorRow[]>;
  /** `forUpdate` holds the row until the transaction ends, so two saves do not interleave. */
  findById(id: number, options?: { forUpdate?: boolean }): Promise<VendorRow | null>;
  /** Case-insensitive, active or not. */
  codeTaken(code: string): Promise<boolean>;
  insert(code: string, fields: VendorFields): Promise<number>;
  update(id: number, fields: VendorFields): Promise<void>;
  setActive(id: number, active: boolean): Promise<void>;
}

export interface VendorGateways {
  vendors: VendorGateway;
  audit: AuditGateway;
}
