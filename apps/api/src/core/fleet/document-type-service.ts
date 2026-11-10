import type {
  DocumentType,
  DocumentTypeListResponse,
  DocumentTypeRequest,
  DocumentTypeUpdateRequest,
} from '@bmi/shared';
import type {
  DocumentTypeFields,
  DocumentTypeGateways,
  DocumentTypeRow,
} from '../../ports/document-types.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { ActionRefusedError, NOT_ALLOWED, type Actor } from '../iam/actions.js';

export const DOCUMENT_TYPE_MESSAGES = {
  codeTaken: 'Another document type already uses this code.',
  notFound: 'This document type does not exist or is no longer active.',
  unknownClass: 'Choose the required classes from the list.',
} as const;

/** 404: no active type with this id. */
export class DocumentTypeNotFoundError extends Error {
  constructor() {
    super(DOCUMENT_TYPE_MESSAGES.notFound);
    this.name = 'DocumentTypeNotFoundError';
  }
}

/** 409: the code is taken. */
export class DocumentTypeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentTypeConflictError';
  }
}

/** 400: the request names a class that does not exist. */
export class DocumentTypeInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentTypeInvalidError';
  }
}

const view = (row: DocumentTypeRow): DocumentType => ({
  id: row.id,
  code: row.code,
  name: row.name,
  usualValidityMonths: row.usualValidityMonths,
  warningDays: row.warningDays,
  receiptRequired: row.receiptRequired,
  classIds: [...row.classIds],
});

const fieldsOf = (request: DocumentTypeUpdateRequest): DocumentTypeFields => ({
  name: request.name,
  usualValidityMonths: request.usualValidityMonths,
  warningDays: request.warningDays,
  receiptRequired: request.receiptRequired,
});

/** REQ-DOC-001, REQ-DOC-002, DEC-20, DEC-121: the document types master of the System Admin. */
export class DocumentTypeService {
  constructor(private readonly unitOfWork: UnitOfWork<DocumentTypeGateways>) {}

  list(actor: Actor): Promise<DocumentTypeListResponse> {
    this.requireManager(actor);
    return this.unitOfWork.run(async ({ documentTypes }) => ({
      documentTypes: (await documentTypes.listActive()).map(view),
      classes: await documentTypes.classes(),
      allowedActions: ['create', 'edit', 'deactivate'],
    }));
  }

  /** C-31: a new type with a typed code (unique without regard to case). */
  create(actor: Actor, request: DocumentTypeRequest): Promise<DocumentType> {
    this.requireManager(actor);
    return this.unitOfWork.run(async (gateways) => {
      if (await gateways.documentTypes.codeTaken(request.code)) {
        throw new DocumentTypeConflictError(DOCUMENT_TYPE_MESSAGES.codeTaken);
      }
      await this.checkClasses(gateways, request.classIds);
      const id = await gateways.documentTypes.insert(request.code, fieldsOf(request));
      await gateways.documentTypes.setClasses(id, request.classIds);
      const after = await this.load(gateways, id);
      await this.audit(gateways, actor, id, 'create', null, after);
      return view(after);
    });
  }

  /** C-17: one save of the fields and the required classes, one audit record. */
  update(actor: Actor, id: number, request: DocumentTypeUpdateRequest): Promise<DocumentType> {
    this.requireManager(actor);
    return this.unitOfWork.run(async (gateways) => {
      const before = await this.load(gateways, id, true);
      await this.checkClasses(gateways, request.classIds);
      await gateways.documentTypes.update(id, fieldsOf(request));
      await gateways.documentTypes.setClasses(id, request.classIds);
      const after = await this.load(gateways, id);
      await this.audit(gateways, actor, id, 'update', before, after);
      return view(after);
    });
  }

  /** C-32: no longer offered for new documents; documents already entered keep it. */
  deactivate(actor: Actor, id: number): Promise<void> {
    this.requireManager(actor);
    return this.unitOfWork.run(async (gateways) => {
      const before = await this.load(gateways, id, true);
      await gateways.documentTypes.deactivate(id);
      await this.audit(gateways, actor, id, 'deactivate', before, { ...before, isActive: false });
    });
  }

  private async checkClasses(gateways: DocumentTypeGateways, classIds: readonly number[]) {
    const known = new Set((await gateways.documentTypes.classes()).map((c) => c.id));
    if (classIds.some((id) => !known.has(id))) {
      throw new DocumentTypeInvalidError(DOCUMENT_TYPE_MESSAGES.unknownClass);
    }
  }

  private async load(
    gateways: DocumentTypeGateways,
    id: number,
    forUpdate = false,
  ): Promise<DocumentTypeRow> {
    const row = await gateways.documentTypes.findById(id, { forUpdate });
    if (!row?.isActive) throw new DocumentTypeNotFoundError();
    return row;
  }

  private audit(
    gateways: DocumentTypeGateways,
    actor: Actor,
    id: number,
    action: string,
    before: DocumentTypeRow | null,
    after: DocumentTypeRow,
  ): Promise<void> {
    return gateways.audit.write({
      entity: 'document_type',
      entityId: id,
      action,
      ...(before ? { before } : {}),
      after,
      userId: actor.user.id,
      userRole: actor.user.role,
    });
  }

  private requireManager(actor: Actor): void {
    if (!actor.capabilities.has('masterdata.manage')) {
      throw new ActionRefusedError('document_types', NOT_ALLOWED);
    }
  }
}
