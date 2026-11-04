import type {
  IdempotencyGateway,
  IdempotentRequest,
  StoredResponse,
} from '../../ports/idempotency.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

export type IdempotentResponse = StoredResponse & { replayed: boolean };

/** TX-22: the key and the action commit or roll back together, so a retry can never repeat a committed action. */
export function runIdempotent<Gateways extends { idempotency: IdempotencyGateway }>(
  unitOfWork: UnitOfWork<Gateways>,
  request: IdempotentRequest,
  action: (gateways: Gateways) => Promise<StoredResponse>,
): Promise<IdempotentResponse> {
  return unitOfWork.run(async (gateways) => {
    const claim = await gateways.idempotency.claim(request);
    if (claim.kind === 'replay') return { ...claim.response, replayed: true };
    const response = await action(gateways);
    await gateways.idempotency.store(request, response);
    return { ...response, replayed: false };
  });
}
