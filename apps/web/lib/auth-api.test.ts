// @vitest-environment node
// This test needs no DOM, so it does not wait for jsdom to load.
import { createApiClient } from '@bmi/api-client';
import { describe, expect, it, vi } from 'vitest';
import { authApi, homeAfterSignIn } from './auth-api';

const user = {
  id: 1,
  name: 'Budi',
  email: 'b@bmi.co.id',
  role: 'Planner' as const,
  mustChangePassword: false,
};

function apiAnswering(status: number, body: unknown) {
  const fetchStub = vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  return { api: authApi(createApiClient('http://web.test/api', { fetch: fetchStub })), fetchStub };
}

const requestOf = (stub: ReturnType<typeof vi.fn<typeof fetch>>) =>
  stub.mock.calls[0]?.[0] as Request;

describe('DEC-66 the web reaches the sign-in API through the generated client', () => {
  it('REQ-IAM-001 signs in as the web client and hands back the account', async () => {
    const { api, fetchStub } = apiAnswering(200, { user });
    expect(await api.signIn('b@bmi.co.id', 'truck2026')).toEqual({ ok: true, data: { user } });
    const request = requestOf(fetchStub);
    expect(request.url).toBe('http://web.test/api/auth/sign-in');
    expect(await request.json()).toEqual({
      email: 'b@bmi.co.id',
      password: 'truck2026',
      client: 'web',
    });
  });

  it('C-34 a refusal carries the one sentence of the API', async () => {
    const { api } = apiAnswering(423, { statusCode: 423, message: 'This account is locked.' });
    expect(await api.signIn('b@bmi.co.id', 'x')).toEqual({
      ok: false,
      status: 423,
      message: 'This account is locked.',
    });
  });

  it('C-34 a validation refusal shows its first issue', async () => {
    const { api } = apiAnswering(400, {
      message: 'Validation failed',
      issues: [{ path: 'newPassword', message: 'At least 8 characters with letters and digits.' }],
    });
    const outcome = await api.changePassword({ newPassword: 'x', repeatPassword: 'x' });
    expect(outcome).toEqual({
      ok: false,
      status: 400,
      message: 'At least 8 characters with letters and digits.',
    });
  });

  it('C-34 an answer without a message gets a plain sentence, a dead network another', async () => {
    const { api } = apiAnswering(500, {});
    expect(await api.me()).toEqual({
      ok: false,
      status: 500,
      message: 'Something went wrong. Try again.',
    });
    const offline = authApi(
      createApiClient('http://web.test/api', { fetch: () => Promise.reject(new Error('down')) }),
    );
    expect(await offline.signOut()).toEqual({
      ok: false,
      status: 0,
      message: 'The server cannot be reached. Check the connection and try again.',
    });
  });

  it('DEC-102 forgot and reset password call their routes', async () => {
    const forgot = apiAnswering(200, { ok: true });
    await forgot.api.forgotPassword('b@bmi.co.id');
    expect(requestOf(forgot.fetchStub).url).toBe('http://web.test/api/auth/forgot-password');
    const reset = apiAnswering(200, { ok: true });
    await reset.api.resetPassword({
      token: 't'.repeat(43),
      newPassword: 'fresh2026x',
      repeatPassword: 'fresh2026x',
    });
    expect(requestOf(reset.fetchStub).url).toBe('http://web.test/api/auth/reset-password');
  });

  it('NFR-05 a 401 from /me is answered by one refresh and the call again', async () => {
    const answers = [
      [401, { message: 'Your session ended. Sign in again.' }],
      [200, { user }],
      [200, { user, capabilities: [], systemMode: 'Live' }],
    ] as const;
    let calls = 0;
    const fetchStub = vi.fn<typeof fetch>((): Promise<Response> => {
      const [status, body] = answers[calls] ?? [500, {}];
      calls += 1;
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    const api = authApi(createApiClient('http://web.test/api', { fetch: fetchStub }));
    expect(await api.me()).toMatchObject({ ok: true, data: { systemMode: 'Live' } });
    expect(fetchStub.mock.calls.map((call) => (call[0] as Request).url)).toEqual([
      'http://web.test/api/me',
      'http://web.test/api/auth/refresh',
      'http://web.test/api/me',
    ]);
  });

  it('NFR-05 when the refresh is refused too, /me stays refused', async () => {
    const { api, fetchStub } = apiAnswering(401, { message: 'Your session ended. Sign in again.' });
    expect(await api.me()).toEqual({
      ok: false,
      status: 401,
      message: 'Your session ended. Sign in again.',
    });
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('REQ-IAM-009 the first sign-in goes to ChangePassword, any other to the home page', () => {
    expect(homeAfterSignIn({ ...user, mustChangePassword: true })).toBe('/change-password');
    expect(homeAfterSignIn(user)).toBe('/');
  });
});
