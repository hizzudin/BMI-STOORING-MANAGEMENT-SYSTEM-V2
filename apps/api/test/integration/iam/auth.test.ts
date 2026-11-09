import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AUTH_MESSAGES } from '../../../src/core/iam/errors.js';
import { AuthService } from '../../../src/core/iam/auth-service.js';
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';
import {
  Browser,
  FakeEmail,
  insertAccount,
  postJson,
  startAuthApp,
  WEB_ORIGIN,
} from './auth-harness.js';

const clock = FakeClock.atWib('2026-11-09 08:00');
const email = new FakeEmail();
let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  ({ app, baseUrl } = await startAuthApp(clock, email));
});

afterAll(async () => {
  await app.close();
});

const signIn = (browser: Browser, account: { email: string }, password: string) =>
  browser.call('POST', '/auth/sign-in', { email: account.email, password, client: 'web' });

async function signedIn(options: Parameters<typeof insertAccount>[0] = {}) {
  const account = await insertAccount(options);
  const browser = new Browser(baseUrl);
  const response = await signIn(browser, account, account.password);
  expect(response.status).toBe(200);
  return { account, browser };
}

describe('REQ-IAM-001 sign in with email and password', () => {
  it('REQ-IAM-001 the web signs in and gets HttpOnly SameSite=Strict cookies, never tokens in the body', async () => {
    const account = await insertAccount();
    const response = await postJson(
      baseUrl,
      '/auth/sign-in',
      {
        email: account.email.toUpperCase(),
        password: account.password,
        client: 'web',
      },
      { origin: WEB_ORIGIN },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({
      user: {
        id: account.id,
        name: expect.any(String),
        email: account.email,
        role: 'Planner',
        mustChangePassword: false,
      },
    });
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    for (const cookie of cookies) {
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Strict/);
    }
  });

  it('REQ-IAM-001 GET /me answers for the signed-in account and refuses without a session', async () => {
    const { account, browser } = await signedIn();
    const me = await browser.call('GET', '/me');
    expect(me.status).toBe(200);
    expect(((await me.json()) as { user: { id: number } }).user.id).toBe(account.id);
    expect((await fetch(`${baseUrl}/me`)).status).toBe(401);
  });

  it('REQ-IAM-001 the phone gets its tokens in the body and sends a bearer token', async () => {
    const account = await insertAccount();
    const response = await postJson(baseUrl, '/auth/sign-in', {
      email: account.email,
      password: account.password,
      client: 'mobile',
    });
    const body = (await response.json()) as { accessToken: string; refreshToken: string };
    expect(response.headers.getSetCookie()).toHaveLength(0);
    expect(body.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(body.refreshToken.length).toBeGreaterThan(30);
    const me = await fetch(`${baseUrl}/me`, {
      headers: { authorization: `Bearer ${body.accessToken}` },
    });
    expect(me.status).toBe(200);
  });

  it('REQ-IAM-001 a wrong password, an unknown email and a deactivated account get the same refusal', async () => {
    const account = await insertAccount();
    const inactive = await insertAccount({ active: false });
    const browser = new Browser(baseUrl);
    for (const [who, password] of [
      [account, 'wrong1234'],
      [{ email: 'nobody@bmi.test' }, 'wrong1234'],
      [inactive, inactive.password],
    ] as const) {
      const response = await signIn(browser, who, password);
      expect(response.status).toBe(401);
      expect(((await response.json()) as { message: string }).message).toBe(
        AUTH_MESSAGES.wrongCredentials,
      );
    }
  });

  it('REQ-IAM-001 NFR-05 5 failed sign-ins in a row lock the account for 15 minutes', async () => {
    const account = await insertAccount();
    const browser = new Browser(baseUrl);
    for (let i = 0; i < 4; i += 1)
      expect((await signIn(browser, account, 'wrong1234')).status).toBe(401);
    const fifth = await signIn(browser, account, 'wrong1234');
    expect(fifth.status).toBe(423);
    expect(((await fifth.json()) as { message: string }).message).toBe(AUTH_MESSAGES.locked);
    expect((await signIn(browser, account, account.password)).status).toBe(423);
    clock.advanceMinutes(14);
    expect((await signIn(browser, account, account.password)).status).toBe(423);
    clock.advanceMinutes(1);
    expect((await signIn(browser, account, account.password)).status).toBe(200);
    const { rows } = await testPool().query(
      'SELECT failed_logins, locked_until FROM users WHERE id = $1',
      [account.id],
    );
    expect(rows[0]).toEqual({ failed_logins: 0, locked_until: null });
  });

  it('REQ-IAM-001 a successful sign-in resets the count, so failures must be in a row', async () => {
    const account = await insertAccount();
    const browser = new Browser(baseUrl);
    for (let i = 0; i < 4; i += 1) await signIn(browser, account, 'wrong1234');
    expect((await signIn(browser, account, account.password)).status).toBe(200);
    for (let i = 0; i < 4; i += 1)
      expect((await signIn(browser, account, 'wrong1234')).status).toBe(401);
  });

  it('REQ-IAM-001 an Access Manager can unlock a locked account', async () => {
    const account = await insertAccount();
    const browser = new Browser(baseUrl);
    for (let i = 0; i < 5; i += 1) await signIn(browser, account, 'wrong1234');
    await app.get(AuthService).unlock(account.id);
    expect((await signIn(browser, account, account.password)).status).toBe(200);
  });
});

describe('NFR-05 passwords and sessions', () => {
  it('NFR-05 the password is stored only as a hash', async () => {
    const account = await insertAccount();
    const { rows } = await testPool().query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [account.id],
    );
    expect(rows[0]?.password_hash).not.toContain(account.password);
    expect(rows[0]?.password_hash).toMatch(/^scrypt\$/);
  });

  it('NFR-05 the access token lasts 5 minutes and the refresh token renews it, rotating itself', async () => {
    const { browser } = await signedIn();
    const firstRefresh = browser.cookie('bmi_refresh');
    clock.advanceMinutes(6);
    expect((await browser.call('GET', '/me')).status).toBe(401);
    expect((await browser.call('POST', '/auth/refresh')).status).toBe(200);
    expect(browser.cookie('bmi_refresh')).not.toBe(firstRefresh);
    expect((await browser.call('GET', '/me')).status).toBe(200);
  });

  it('NFR-05 a web session ends after 30 minutes without activity', async () => {
    const { browser } = await signedIn();
    clock.advanceMinutes(20);
    expect((await browser.call('POST', '/auth/refresh')).status).toBe(200);
    clock.advanceMinutes(20);
    expect((await browser.call('POST', '/auth/refresh')).status).toBe(200);
    clock.advanceMinutes(31);
    const ended = await browser.call('POST', '/auth/refresh');
    expect(ended.status).toBe(401);
    expect(((await ended.json()) as { message: string }).message).toBe(AUTH_MESSAGES.sessionEnded);
  });

  it('NFR-05 a mobile session lasts 30 days', async () => {
    const account = await insertAccount();
    const signInResponse = await postJson(baseUrl, '/auth/sign-in', {
      email: account.email,
      password: account.password,
      client: 'mobile',
    });
    let { refreshToken } = (await signInResponse.json()) as { refreshToken: string };
    clock.advanceMinutes(29 * 24 * 60);
    const renewed = await postJson(baseUrl, '/auth/refresh', { refreshToken });
    expect(renewed.status).toBe(200);
    ({ refreshToken } = (await renewed.json()) as { refreshToken: string });
    clock.advanceMinutes(2 * 24 * 60);
    expect((await postJson(baseUrl, '/auth/refresh', { refreshToken })).status).toBe(401);
  });

  it('C-04 sign out ends the session at once', async () => {
    const { browser } = await signedIn();
    const refresh = browser.cookie('bmi_refresh');
    expect((await browser.call('POST', '/auth/sign-out')).status).toBe(200);
    expect(browser.cookie('bmi_access')).toBeUndefined();
    expect(
      (
        await postJson(
          baseUrl,
          '/auth/refresh',
          {},
          { cookie: `bmi_refresh=${refresh}`, origin: WEB_ORIGIN },
        )
      ).status,
    ).toBe(401);
  });

  it('NFR-05 a cookie request from another origin is refused', async () => {
    const { browser } = await signedIn();
    const access = browser.cookie('bmi_access');
    const response = await postJson(
      baseUrl,
      '/auth/sign-out',
      {},
      { cookie: `bmi_access=${access}`, origin: 'https://evil.example' },
    );
    expect(response.status).toBe(403);
  });
});

describe('REQ-IAM-009 temporary password and first sign-in change', () => {
  it('REQ-IAM-009 an Access Manager reset gives a one-time temporary password that must be changed', async () => {
    const account = await insertAccount();
    const oldDevice = new Browser(baseUrl);
    await signIn(oldDevice, account, account.password);
    const temporary = await app.get(AuthService).issueTemporaryPassword(account.id);
    expect(temporary).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{12,}$/);
    expect((await oldDevice.call('GET', '/me')).status).toBe(401);
    const browser = new Browser(baseUrl);
    const response = await signIn(browser, account, temporary);
    expect(
      ((await response.json()) as { user: { mustChangePassword: boolean } }).user
        .mustChangePassword,
    ).toBe(true);
  });

  it('REQ-IAM-009 NFR-05 at the first sign-in the new password follows the rules and clears the flag', async () => {
    const { account, browser } = await signedIn({ mustChange: true });
    const weak = await browser.call('POST', '/auth/change-password', {
      newPassword: 'short',
      repeatPassword: 'short',
    });
    expect(weak.status).toBe(400);
    const done = await browser.call('POST', '/auth/change-password', {
      newPassword: 'newtruck2026',
      repeatPassword: 'newtruck2026',
    });
    expect(done.status).toBe(200);
    expect(
      ((await done.json()) as { user: { mustChangePassword: boolean } }).user.mustChangePassword,
    ).toBe(false);
    expect((await browser.call('GET', '/me')).status).toBe(200);
    expect((await signIn(new Browser(baseUrl), account, 'newtruck2026')).status).toBe(200);
  });

  it('NFR-05 a change from the user menu needs the current password and ends the other sessions', async () => {
    const { account, browser } = await signedIn();
    const other = new Browser(baseUrl);
    await signIn(other, account, account.password);
    const missing = await browser.call('POST', '/auth/change-password', {
      newPassword: 'newtruck2026',
      repeatPassword: 'newtruck2026',
    });
    expect(missing.status).toBe(400);
    expect(((await missing.json()) as { message: string }).message).toBe(
      AUTH_MESSAGES.currentPasswordWrong,
    );
    const done = await browser.call('POST', '/auth/change-password', {
      currentPassword: account.password,
      newPassword: 'newtruck2026',
      repeatPassword: 'newtruck2026',
    });
    expect(done.status).toBe(200);
    expect((await browser.call('GET', '/me')).status).toBe(200);
    expect((await other.call('GET', '/me')).status).toBe(401);
  });
});

describe('DEC-102 DEC-114 forgot password', () => {
  it('DEC-102 the answer is the same for an unknown email and nothing is sent', async () => {
    const before = email.sent.length;
    const response = await postJson(baseUrl, '/auth/forgot-password', { email: 'nobody@bmi.test' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(email.sent.length).toBe(before);
  });

  it('DEC-102 a deactivated account gets no link', async () => {
    const inactive = await insertAccount({ active: false });
    const before = email.sent.length;
    await postJson(baseUrl, '/auth/forgot-password', { email: inactive.email });
    expect(email.sent.length).toBe(before);
  });

  it('DEC-114 the link works once, sets the password, clears the lock and ends every session', async () => {
    const account = await insertAccount();
    const browser = new Browser(baseUrl);
    await signIn(browser, account, account.password);
    for (let i = 0; i < 5; i += 1) await signIn(new Browser(baseUrl), account, 'wrong1234');
    await postJson(baseUrl, '/auth/forgot-password', { email: account.email });
    expect(email.sent.at(-1)?.to).toBe(account.email);
    const token = email.lastToken();
    const { rows } = await testPool().query<{ token_hash: string }>(
      'SELECT token_hash FROM password_reset_tokens WHERE user_id = $1',
      [account.id],
    );
    expect(rows[0]?.token_hash).not.toBe(token);
    const reset = { token, newPassword: 'fresh2026x', repeatPassword: 'fresh2026x' };
    expect((await postJson(baseUrl, '/auth/reset-password', reset)).status).toBe(200);
    expect((await browser.call('GET', '/me')).status).toBe(401);
    expect((await signIn(new Browser(baseUrl), account, 'fresh2026x')).status).toBe(200);
    const again = await postJson(baseUrl, '/auth/reset-password', reset);
    expect(again.status).toBe(400);
    expect(((await again.json()) as { message: string }).message).toBe(
      AUTH_MESSAGES.resetLinkInvalid,
    );
  });

  it('DEC-114 the link expires after 60 minutes', async () => {
    const account = await insertAccount();
    await postJson(baseUrl, '/auth/forgot-password', { email: account.email });
    const token = email.lastToken();
    clock.advanceMinutes(61);
    const response = await postJson(baseUrl, '/auth/reset-password', {
      token,
      newPassword: 'fresh2026x',
      repeatPassword: 'fresh2026x',
    });
    expect(response.status).toBe(400);
  });

  it('DEC-114 a newer link voids the older one', async () => {
    const account = await insertAccount();
    await postJson(baseUrl, '/auth/forgot-password', { email: account.email });
    const older = email.lastToken();
    await postJson(baseUrl, '/auth/forgot-password', { email: account.email });
    const newer = email.lastToken();
    const body = { newPassword: 'fresh2026x', repeatPassword: 'fresh2026x' };
    expect(
      (await postJson(baseUrl, '/auth/reset-password', { ...body, token: older })).status,
    ).toBe(400);
    expect(
      (await postJson(baseUrl, '/auth/reset-password', { ...body, token: newer })).status,
    ).toBe(200);
  });
});
