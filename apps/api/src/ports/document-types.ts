import type { AuditGateway } from './accounts.js';

/** §9.4 document_types with its required classes (document_type_classes). */
export interface DocumentTypeRow {
  id: number;
  code: string;
  name: string;
  usualValidityMonths: number | null;
  warningDays: number;
  receiptRequired: boolean;
  isActive: boolean;
  classIds: number[];
}

export type DocumentTypeFields = Omit<DocumentTypeRow, 'id' | 'code' | 'isActive' | 'classIds'>;

export interface DocumentTypeGateway {
  /** Active types, by name. */
  listActive(): Promise<DocumentTypeRow[]>;
  /** `forUpdate` holds the type until the transaction ends, so two saves do not interleave. */
  findById(id: number, options?: { forUpdate?: boolean }): Promise<DocumentTypeRow | null>;
  /** Case-insensitive, active or not, so KIR and kir are one code. */
  codeTaken(code: string): Promise<boolean>;
  /** The classes a type can be required for, with their vehicles that are not Inactive (REQ-DOC-002). */
  classes(): Promise<{ id: number; name: string; vehicleCount: number }[]>;
  insert(code: string, fields: DocumentTypeFields): Promise<number>;
  update(id: number, fields: DocumentTypeFields): Promise<void>;
  /** Replaces the required classes of the type. */
  setClasses(id: number, classIds: readonly number[]): Promise<void>;
  deactivate(id: number): Promise<void>;
}

export interface DocumentTypeGateways {
  documentTypes: DocumentTypeGateway;
  audit: AuditGateway;
}
