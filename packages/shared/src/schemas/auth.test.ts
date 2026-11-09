import { describe, expect, it } from 'vitest';
import {
  ChangePasswordRequestSchema,
  PasswordSchema,
  ResetPasswordRequestSchema,
  SignInRequestSchema,
} from './auth.js';

const message = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe('NFR-05 password rules', () => {
  it('NFR-05 accepts at least 8 characters with letters and digits', () => {
    expect(PasswordSchema.safeParse('truck2026').success).toBe(true);
  });

  it('NFR-05 refuses fewer than 8 characters', () => {
    expect(message(PasswordSchema.safeParse('ab12'))).toBe(
      'At least 8 characters with letters and digits.',
    );
  });

  it('NFR-05 refuses a password without digits or without letters', () => {
    expect(PasswordSchema.safeParse('onlyletters').success).toBe(false);
    expect(PasswordSchema.safeParse('1234567890').success).toBe(false);
  });

  it('NFR-05 the repeated password must match', () => {
    const result = ResetPasswordRequestSchema.safeParse({
      token: 'x'.repeat(43),
      newPassword: 'truck2026',
      repeatPassword: 'truck2027',
    });
    expect(message(result)).toBe('The two passwords are not the same.');
  });

  it('NFR-05 a change keeps the current password optional and checks the new one', () => {
    expect(
      ChangePasswordRequestSchema.safeParse({
        newPassword: 'truck2026',
        repeatPassword: 'truck2026',
      }).success,
    ).toBe(true);
    expect(
      ChangePasswordRequestSchema.safeParse({ newPassword: 'short', repeatPassword: 'short' })
        .success,
    ).toBe(false);
  });
});

describe('REQ-IAM-001 sign-in request', () => {
  it('REQ-IAM-001 needs an email, a password and the client', () => {
    expect(
      SignInRequestSchema.safeParse({ email: 'Budi.S@bmi.co.id ', password: 'x', client: 'web' })
        .data?.email,
    ).toBe('budi.s@bmi.co.id');
    expect(
      SignInRequestSchema.safeParse({ email: 'no-at', password: 'x', client: 'web' }).success,
    ).toBe(false);
    expect(
      SignInRequestSchema.safeParse({ email: 'a@b.co', password: 'x', client: 'desk' }).success,
    ).toBe(false);
  });
});
