import { z } from 'zod';
import { ROLES } from '../enums/index.js';

/** NFR-05: one rule for web, phone and API. */
export const PASSWORD_RULE = 'At least 8 characters with letters and digits.';
const PASSWORDS_DIFFER = 'The two passwords are not the same.';

export const PasswordSchema = z
  .string()
  .min(8, PASSWORD_RULE)
  .max(128, PASSWORD_RULE)
  .regex(/[A-Za-z]/, PASSWORD_RULE)
  .regex(/\d/, PASSWORD_RULE);

const EmailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'));

export const ClientSchema = z.enum(['web', 'mobile']);
export type Client = z.infer<typeof ClientSchema>;

export const SignInRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Enter your password.').max(128),
  client: ClientSchema,
});
export type SignInRequest = z.infer<typeof SignInRequestSchema>;

export const SessionUserSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  role: z.enum(ROLES).nullable(),
  mustChangePassword: z.boolean(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

/** The web gets its tokens as HttpOnly cookies; the phone gets them in the body (design.md 5.1). */
export const SignInResponseSchema = z.object({
  user: SessionUserSchema,
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
});
export type SignInResponse = z.infer<typeof SignInResponseSchema>;

/** The web sends no body: its refresh token is a cookie. */
export const RefreshRequestSchema = z
  .object({ refreshToken: z.string().max(200).optional() })
  .default({});

const sameRepeat = {
  check: (value: { newPassword: string; repeatPassword: string }) =>
    value.newPassword === value.repeatPassword,
  params: { message: PASSWORDS_DIFFER, path: ['repeatPassword'] },
};

/** At the first sign-in the current password is not asked again; from the user menu it is. */
export const ChangePasswordRequestSchema = z
  .object({
    currentPassword: z.string().max(128).optional(),
    newPassword: PasswordSchema,
    repeatPassword: z.string(),
  })
  .refine(sameRepeat.check, sameRepeat.params);
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export const ForgotPasswordRequestSchema = z.object({ email: EmailSchema });

export const ResetPasswordRequestSchema = z
  .object({
    token: z.string().min(20).max(200),
    newPassword: PasswordSchema,
    repeatPassword: z.string(),
  })
  .refine(sameRepeat.check, sameRepeat.params);
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const OkResponseSchema = z.object({ ok: z.literal(true) });

/** GET /me and a password change answer with the account only. */
export const SessionResponseSchema = z.object({ user: SessionUserSchema });
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
