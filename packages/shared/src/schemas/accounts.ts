import { z } from 'zod';
import { ROLES } from '../enums/index.js';

/** REQ-IAM-002: what the Access Manager may do on one account (its `allowedActions`). */
export const ACCOUNT_ACTIONS = [
  'edit',
  'unlock',
  'reset_password',
  'deactivate',
  'activate',
] as const;
export type AccountAction = (typeof ACCOUNT_ACTIONS)[number];

/** Page-level actions of Users and roles (FLW-AM-01, FLW-AM-03). */
export const ACCOUNTS_PAGE_ACTIONS = ['create', 'move_system_admin'] as const;
export type AccountsPageAction = (typeof ACCOUNTS_PAGE_ACTIONS)[number];

export const ACCOUNT_STATUSES = ['Active', 'Locked', 'Inactive'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** BR-14: System Admin is given only by Move System Admin role, never by the account form. */
const AssignableRoleSchema = z.enum(ROLES, { error: 'Choose one role.' }).exclude(['System_Admin']);
export const ASSIGNABLE_ROLES = AssignableRoleSchema.options;
export type AssignableRole = z.infer<typeof AssignableRoleSchema>;

export const AccountSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  /** Null after the account handed System Admin on, until it is given a role (DEC-116). */
  role: z.enum(ROLES).nullable(),
  status: z.enum(ACCOUNT_STATUSES),
  /** ISO time of the last sign-in, or null when the account never signed in. */
  lastSignInAt: z.string().nullable(),
  allowedActions: z.array(z.enum(ACCOUNT_ACTIONS)),
});
export type Account = z.infer<typeof AccountSchema>;

export const AccountListResponseSchema = z.object({
  accounts: z.array(AccountSchema),
  allowedActions: z.array(z.enum(ACCOUNTS_PAGE_ACTIONS)),
});
export type AccountListResponse = z.infer<typeof AccountListResponseSchema>;

const NameSchema = z.string().trim().min(1, 'Enter a name.').max(100, 'At most 100 characters.');
const AccountEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.').max(150, 'At most 150 characters.'));

/** FLW-AM-01: name, email and exactly one role (RL-1, AC-IAM-004). */
export const AccountRequestSchema = z.object({
  name: NameSchema,
  email: AccountEmailSchema,
  role: AssignableRoleSchema,
});
export type AccountRequest = z.infer<typeof AccountRequestSchema>;

/**
 * Edit: the form sends the account's current role, which may be System Admin; the server refuses a
 * change to or from System Admin (BR-14) with a sentence, so the holder's name and email stay editable.
 */
export const AccountUpdateRequestSchema = z.object({
  name: NameSchema,
  email: AccountEmailSchema,
  role: z.enum(ROLES, { error: 'Choose one role.' }),
});
export type AccountUpdateRequest = z.infer<typeof AccountUpdateRequestSchema>;

/** REQ-IAM-009: the one-time temporary password, shown once to the Access Manager. */
export const AccountWithPasswordSchema = z.object({
  account: AccountSchema,
  temporaryPassword: z.string(),
});
export type AccountWithPassword = z.infer<typeof AccountWithPasswordSchema>;

export const AccountResponseSchema = z.object({ account: AccountSchema });
export type AccountResponse = z.infer<typeof AccountResponseSchema>;

/** FLW-AM-03: another active account and a reason (REQ-IAM-004). */
export const MoveSystemAdminRequestSchema = z.object({
  toUserId: z.number().int().positive(),
  reason: z.string().trim().min(1, 'Give a reason.').max(500, 'At most 500 characters.'),
});
export type MoveSystemAdminRequest = z.infer<typeof MoveSystemAdminRequestSchema>;
