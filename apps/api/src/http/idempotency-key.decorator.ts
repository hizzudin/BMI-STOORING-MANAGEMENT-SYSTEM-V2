import { createHash } from 'node:crypto';
import { BadRequestException, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

const MAX_KEY_LENGTH = 100;

/** NFR-01: every mutating request carries an Idempotency-Key header. */
export const IdempotencyKey = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const key = context.switchToHttp().getRequest<Request>().header('idempotency-key');
  if (!key || key.length > MAX_KEY_LENGTH) {
    throw new BadRequestException(
      `Idempotency-Key is required, at most ${MAX_KEY_LENGTH} characters`,
    );
  }
  return key;
});

export function hashRequest(method: string, path: string, body: unknown): string {
  return createHash('sha256')
    .update(`${method} ${path} ${JSON.stringify(body ?? null)}`)
    .digest('hex');
}
