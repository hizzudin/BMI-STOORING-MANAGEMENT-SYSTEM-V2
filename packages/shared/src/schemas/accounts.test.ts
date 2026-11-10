import { describe, expect, it } from 'vitest';
import {
  ASSIGNABLE_ROLES,
  AccountRequestSchema,
  AccountUpdateRequestSchema,
  MoveSystemAdminRequestSchema,
} from './accounts.js';

const issue = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe('REQ-IAM-002 account requests', () => {
  it('BR-14 the account form offers every role but System Admin', () => {
    expect(ASSIGNABLE_ROLES).not.toContain('System_Admin');
    expect(ASSIGNABLE_ROLES).toHaveLength(9);
  });

  it('REQ-IAM-002 a new account needs a name, a valid email and one assignable role', () => {
    const parsed = AccountRequestSchema.safeParse({
      name: ' Dewi ',
      email: ' Dewi@BMI.co.id ',
      role: 'Mechanic',
    });
    expect(parsed.data).toEqual({ name: 'Dewi', email: 'dewi@bmi.co.id', role: 'Mechanic' });
    expect(issue(AccountRequestSchema.safeParse({ name: '', email: 'a@b.co', role: 'GM' }))).toBe(
      'Enter a name.',
    );
    expect(
      issue(AccountRequestSchema.safeParse({ name: 'A', email: 'not-an-email', role: 'GM' })),
    ).toBe('Enter a valid email address.');
    expect(
      AccountRequestSchema.safeParse({ name: 'A', email: 'a@b.co', role: 'System_Admin' }).success,
    ).toBe(false);
  });

  it('AC-IAM-004 RL-1 a request carries exactly one role', () => {
    expect(
      AccountRequestSchema.safeParse({ name: 'A', email: 'a@b.co', role: ['Planner', 'GM'] })
        .success,
    ).toBe(false);
  });

  it('BR-14 an edit may carry the current System Admin role so the holder stays editable', () => {
    expect(
      AccountUpdateRequestSchema.safeParse({ name: 'Y', email: 'y@b.co', role: 'System_Admin' })
        .success,
    ).toBe(true);
  });

  it('REQ-IAM-004 a move needs an account and a reason', () => {
    expect(
      MoveSystemAdminRequestSchema.safeParse({ toUserId: 3, reason: 'Moves office' }).success,
    ).toBe(true);
    expect(issue(MoveSystemAdminRequestSchema.safeParse({ toUserId: 3, reason: '   ' }))).toBe(
      'Give a reason.',
    );
  });
});
