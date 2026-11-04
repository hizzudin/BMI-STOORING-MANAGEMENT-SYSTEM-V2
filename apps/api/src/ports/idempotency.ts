export interface IdempotentRequest {
  userId: number;
  key: string;
  requestHash: string;
}

export interface StoredResponse {
  status: number;
  body: unknown;
}

export type ClaimResult = { kind: 'new' } | { kind: 'replay'; response: StoredResponse };

/** TX-22: both calls take part in the transaction of the action. */
export interface IdempotencyGateway {
  claim(request: IdempotentRequest): Promise<ClaimResult>;
  store(request: IdempotentRequest, response: StoredResponse): Promise<void>;
}

/** The same key arrived with another request. HTTP maps it to 409. */
export class IdempotencyKeyReusedError extends Error {
  constructor() {
    super('This key was already used for a different request.');
    this.name = 'IdempotencyKeyReusedError';
  }
}
