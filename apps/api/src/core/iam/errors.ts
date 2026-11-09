/** One sentence per refusal (C-34); HTTP maps each kind to its status. */
export const AUTH_MESSAGES = {
  wrongCredentials: 'The email or password is not correct.',
  locked:
    'This account is locked after 5 failed sign-ins. Try again in 15 minutes, or ask your Access Manager to unlock it.',
  sessionEnded: 'Your session ended. Sign in again.',
  currentPasswordWrong: 'The current password is not correct.',
  resetLinkInvalid: 'This reset link is no longer valid. Ask for a new one.',
  passwordChangeFirst: 'Change your password before you continue.',
} as const;

export type AuthRefusalKind =
  | 'wrongCredentials'
  | 'locked'
  | 'sessionEnded'
  | 'currentPasswordWrong'
  | 'resetLinkInvalid'
  | 'passwordChangeFirst';

export class AuthRefusedError extends Error {
  constructor(readonly kind: AuthRefusalKind) {
    super(AUTH_MESSAGES[kind]);
    this.name = 'AuthRefusedError';
  }
}
