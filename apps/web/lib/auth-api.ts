import { createApiClient, type ApiClient } from '@bmi/api-client';
import type { SessionUser } from '@bmi/shared';

/** The web reaches the API through the same-origin /api proxy, so the session cookies stay HttpOnly. */
export function browserApi(): ApiClient {
  return createApiClient(`${window.location.origin}/api`, { credentials: 'same-origin' });
}

export type Outcome<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

const UNAUTHORIZED = 401;
const NETWORK_MESSAGE = 'The server cannot be reached. Check the connection and try again.';

/** One sentence from the API (C-34), or a generic one when the answer carries none. */
export async function settle<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<Outcome<T>> {
  try {
    const { data, error, response } = await call;
    if (response.ok && data !== undefined) return { ok: true, data };
    const message = error as { message?: unknown; issues?: { message: string }[] } | undefined;
    const text =
      message?.issues?.[0]?.message ??
      (typeof message?.message === 'string' ? message.message : 'Something went wrong. Try again.');
    return { ok: false, status: response.status, message: text };
  } catch {
    return { ok: false, status: 0, message: NETWORK_MESSAGE };
  }
}

/** Without a client, one is made on the first call: calls run in the browser, never while rendering on the server. */
export function authApi(given?: ApiClient) {
  let made: ApiClient | undefined = given;
  const client = () => (made ??= browserApi());
  let refreshing: Promise<unknown> | undefined;
  return {
    signIn: (email: string, password: string) =>
      settle(client().POST('/auth/sign-in', { body: { email, password, client: 'web' } })),
    // The access token lives 5 minutes: a 401 is answered by one refresh, then the call again (design.md 5.1).
    me: async () => {
      const first = await settle(client().GET('/me'));
      if (first.ok || first.status !== UNAUTHORIZED) return first;
      // Calls that find the token expired together share one refresh; a refused refresh may mean
      // another tab already rotated it, so /me is asked once more before the session counts as ended.
      refreshing ??= settle(client().POST('/auth/refresh', { body: {} })).finally(() => {
        refreshing = undefined;
      });
      await refreshing;
      return settle(client().GET('/me'));
    },
    changePassword: (body: {
      currentPassword?: string;
      newPassword: string;
      repeatPassword: string;
    }) => settle(client().POST('/auth/change-password', { body })),
    forgotPassword: (email: string) =>
      settle(client().POST('/auth/forgot-password', { body: { email } })),
    resetPassword: (body: { token: string; newPassword: string; repeatPassword: string }) =>
      settle(client().POST('/auth/reset-password', { body })),
    signOut: () => settle(client().POST('/auth/sign-out')),
  };
}

export type AuthApi = ReturnType<typeof authApi>;

/** ui-action-map WebLogin: first sign-in → ChangePassword; otherwise the role's home page. */
export function homeAfterSignIn(user: SessionUser): string {
  if (user.mustChangePassword) return '/change-password';
  return '/';
}
