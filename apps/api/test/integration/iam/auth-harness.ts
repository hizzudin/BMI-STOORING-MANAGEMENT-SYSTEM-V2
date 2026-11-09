import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module.js';
import { CLOCK, EMAIL, PASSWORD_HASHER, PG_POOL } from '../../../src/app.tokens.js';
import { ScryptPasswordHasher } from '../../../src/infra/crypto/scrypt-password-hasher.js';
import type { EmailPort } from '../../../src/ports/iam.js';
import { testPool } from '../harness/database.js';
import type { FakeClock } from '../harness/fake-clock.js';

export const WEB_ORIGIN = 'http://localhost:3000';
// A lower cost keeps the suite fast; the stored parameters still drive every check.
const TEST_COST = 2 ** 12;
const hasher = new ScryptPasswordHasher(TEST_COST);

export class FakeEmail implements EmailPort {
  readonly sent: { to: string; name: string; link: string }[] = [];

  sendPasswordReset(message: { to: string; name: string; link: string }): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  lastToken(): string {
    const link = this.sent.at(-1)?.link ?? '';
    return new URL(link).searchParams.get('token') ?? '';
  }
}

export async function startAuthApp(
  clock: FakeClock,
  email: FakeEmail,
): Promise<{ app: INestApplication; baseUrl: string }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PG_POOL)
    .useValue(testPool())
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(EMAIL)
    .useValue(email)
    .overrideProvider(PASSWORD_HASHER)
    .useValue(hasher)
    .compile();
  const app = moduleRef.createNestApplication();
  await app.listen(0);
  return { app, baseUrl: await app.getUrl() };
}

let sequence = 0;

/** An account with a known password and one role. */
export async function insertAccount(
  options: { password?: string; mustChange?: boolean; active?: boolean; role?: string } = {},
): Promise<{ id: number; email: string; password: string }> {
  sequence += 1;
  const password = options.password ?? `truck${sequence}2026`;
  const email = `account${sequence}.${Date.now()}@bmi.test`;
  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO users (name, email, password_hash, must_change_password, is_active)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      `Account ${sequence}`,
      email,
      await hasher.hash(password),
      options.mustChange ?? false,
      options.active ?? true,
    ],
  );
  const id = Number(rows[0]?.id);
  await testPool().query(`INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`, [
    id,
    options.role ?? 'Planner',
  ]);
  return { id, email, password };
}

/** A browser: keeps cookies and sends the web app's Origin, as the Next.js proxy does. */
export class Browser {
  private readonly cookies = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  cookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  async call(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = { origin: WEB_ORIGIN };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (this.cookies.size > 0) {
      headers.cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const line of response.headers.getSetCookie()) {
      const [pair = ''] = line.split(';');
      const [name = '', value = ''] = pair.split('=');
      if (value === '' || /max-age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return response;
  }
}

export async function postJson(
  baseUrl: string,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
