import { Controller, Post, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { runIdempotent } from '../../../src/core/idempotency/run-idempotent.js';
import { hashRequest, IdempotencyKey } from '../../../src/http/idempotency-key.decorator.js';
import {
  DrizzleIdempotencyGateway,
  purgeIdempotencyKeys,
} from '../../../src/infra/db/idempotency-gateway.js';
import { DrizzleUnitOfWork } from '../../../src/infra/db/unit-of-work.js';
import {
  IdempotencyKeyReusedError,
  type IdempotencyGateway,
} from '../../../src/ports/idempotency.js';
import { testPool } from '../harness/database.js';
import { insertUsers } from '../harness/users.js';

let USER = 0;
let OTHER_USER = 0;
const HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);

interface Gateways {
  idempotency: IdempotencyGateway;
  addProbe(marker: string): Promise<void>;
}

function unitOfWork(): DrizzleUnitOfWork<Gateways> {
  return new DrizzleUnitOfWork(testPool(), (tx) => ({
    idempotency: new DrizzleIdempotencyGateway(tx),
    addProbe: async (marker) => {
      await tx.execute(`INSERT INTO harness_probe (marker) VALUES ('${marker}')`);
    },
  }));
}

async function probeCount(): Promise<number> {
  const { rows } = await testPool().query<{ total: string }>(
    'SELECT count(*) AS total FROM harness_probe',
  );
  return Number(rows[0]?.total);
}

const issueStock = (gateways: Gateways) =>
  gateways.addProbe('issued').then(() => ({ status: 201, body: { issued: true } }));

describe('NFR-01 TX-22 idempotency', () => {
  beforeAll(async () => {
    [USER = 0, OTHER_USER = 0] = await insertUsers(2);
  });

  beforeEach(async () => {
    await testPool().query('DELETE FROM harness_probe');
    await testPool().query('DELETE FROM idempotency_keys');
  });

  it('TX-22 idempotency: a retry returns the stored response and the action does not run again', async () => {
    const request = { userId: USER, key: 'k-1', requestHash: HASH };
    const first = await runIdempotent(unitOfWork(), request, issueStock);
    const retry = await runIdempotent(unitOfWork(), request, issueStock);
    expect(first).toEqual({ status: 201, body: { issued: true }, replayed: false });
    expect(retry).toEqual({ status: 201, body: { issued: true }, replayed: true });
    expect(await probeCount()).toBe(1);
  });

  it('TX-22 idempotency: a failed action leaves no key, so the retry runs', async () => {
    const request = { userId: USER, key: 'k-2', requestHash: HASH };
    const failing = runIdempotent(unitOfWork(), request, async (gateways) => {
      await gateways.addProbe('half');
      throw new Error('stock check failed');
    });
    await expect(failing).rejects.toThrow('stock check failed');
    expect(await probeCount()).toBe(0);
    const retry = await runIdempotent(unitOfWork(), request, issueStock);
    expect(retry.replayed).toBe(false);
    expect(await probeCount()).toBe(1);
  });

  it('TX-22 idempotency: the same key with another request is refused', async () => {
    await runIdempotent(unitOfWork(), { userId: USER, key: 'k-3', requestHash: HASH }, issueStock);
    const other = runIdempotent(
      unitOfWork(),
      { userId: USER, key: 'k-3', requestHash: OTHER_HASH },
      issueStock,
    );
    await expect(other).rejects.toThrow(IdempotencyKeyReusedError);
    expect(await probeCount()).toBe(1);
  });

  it('TX-22 idempotency: two requests at once run the action once and answer the same', async () => {
    const request = { userId: USER, key: 'k-4', requestHash: HASH };
    const [a, b] = await Promise.all([
      runIdempotent(unitOfWork(), request, issueStock),
      runIdempotent(unitOfWork(), request, issueStock),
    ]);
    expect(await probeCount()).toBe(1);
    expect(a.body).toEqual(b.body);
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
  });

  it('TX-22 idempotency: the same key from another user is another request', async () => {
    await runIdempotent(unitOfWork(), { userId: USER, key: 'k-5', requestHash: HASH }, issueStock);
    const other = await runIdempotent(
      unitOfWork(),
      { userId: OTHER_USER, key: 'k-5', requestHash: OTHER_HASH },
      issueStock,
    );
    expect(other.replayed).toBe(false);
    expect(await probeCount()).toBe(2);
  });

  it('DEC-108 idempotency: the daily job removes keys older than 30 days and no others', async () => {
    await testPool().query(
      `INSERT INTO idempotency_keys (user_id, idem_key, request_hash, response_status, created_at)
       VALUES ($2, 'old', $1, 200, now() - interval '31 days'), ($2, 'recent', $1, 200, now() - interval '29 days')`,
      [HASH, USER],
    );
    expect(await purgeIdempotencyKeys(testPool(), new Date())).toBe(1);
    const { rows } = await testPool().query<{ idem_key: string }>(
      'SELECT idem_key FROM idempotency_keys',
    );
    expect(rows.map((row) => row.idem_key)).toEqual(['recent']);
  });
});

@Controller('probe')
class KeyProbeController {
  @Post('key')
  echo(@IdempotencyKey() key: string): { key: string } {
    return { key };
  }

  @Post('reused')
  reused(): never {
    throw new IdempotencyKeyReusedError();
  }
}

describe('NFR-01 idempotency over HTTP', () => {
  let app: INestApplication;
  let baseUrl: string;

  const post = (path: string, key?: string): Promise<Response> =>
    fetch(`${baseUrl}/probe/${path}`, {
      method: 'POST',
      headers: key === undefined ? {} : { 'Idempotency-Key': key },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [KeyProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('NFR-01 idempotency: a mutating request hands its key to the handler', async () => {
    const response = await post('key', 'k-9');
    expect(await response.json()).toEqual({ key: 'k-9' });
  });

  it('TX-22 idempotency: the request hash covers method, path and body', () => {
    const base = hashRequest('POST', '/spks/1/submit', { a: 1 });
    expect(hashRequest('POST', '/spks/1/submit', { a: 1 })).toBe(base);
    expect(base).toHaveLength(64);
    expect(hashRequest('POST', '/spks/1/submit', { a: 2 })).not.toBe(base);
    expect(hashRequest('POST', '/spks/2/submit', { a: 1 })).not.toBe(base);
  });

  it('NFR-01 idempotency: a missing or oversized key answers 400', async () => {
    expect((await post('key')).status).toBe(400);
    expect((await post('key', 'x'.repeat(101))).status).toBe(400);
  });

  it('NFR-01 idempotency: a reused key answers 409 with a clear message', async () => {
    const response = await post('reused', 'k-9');
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      message: 'This key was already used for a different request.',
    });
  });
});
