import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { ChangePasswordRequest, Client, SessionUser, SignInRequest } from '@bmi/shared';
import type { ClockPort } from '../../ports/clock.js';
import type {
  AccessTokenSigner,
  AuthUser,
  EmailPort,
  IamGateways,
  PasswordHasher,
} from '../../ports/iam.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { AuthRefusedError, type AuthRefusalKind } from './errors.js';

const MINUTE_MS = 60_000;
/** NFR-05, DEC-55 */
export const MAX_FAILED_SIGN_INS = 5;
export const LOCK_MINUTES = 15;
export const WEB_IDLE_MINUTES = 30;
export const MOBILE_SESSION_DAYS = 30;
/** DEC-114 */
export const RESET_LINK_MINUTES = 60;
/** The guard records activity at most once a minute. */
const TOUCH_EVERY_MS = MINUTE_MS;
const TEMPORARY_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const TEMPORARY_LETTERS = 10;

export interface IssuedSession {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
}

type SignInOutcome = { refusal: AuthRefusalKind } | { session: IssuedSession };

export interface Authenticated {
  user: SessionUser;
  sessionId: number;
}

export interface AuthServiceOptions {
  /** The web page that opens a reset link, e.g. https://app.example/reset-password */
  resetPageUrl: string;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');
const minutesAfter = (at: Date, minutes: number) => new Date(at.getTime() + minutes * MINUTE_MS);

/** REQ-IAM-009: a one-time temporary password that meets NFR-05 (letters and digits). */
export function temporaryPassword(): string {
  const letters = Array.from({ length: TEMPORARY_LETTERS }, () =>
    TEMPORARY_ALPHABET.charAt(randomInt(TEMPORARY_ALPHABET.length)),
  );
  return `${letters.join('')}${randomInt(10, 100)}`;
}

function toSessionUser(user: AuthUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

/** REQ-IAM-001, REQ-IAM-009, NFR-05, DEC-102, DEC-114 (design.md 5.1). */
export class AuthService {
  constructor(
    private readonly unitOfWork: UnitOfWork<IamGateways>,
    private readonly hasher: PasswordHasher,
    private readonly tokens: AccessTokenSigner,
    private readonly email: EmailPort,
    private readonly clock: ClockPort,
    private readonly options: AuthServiceOptions,
  ) {}

  async signIn({ email, password, client }: SignInRequest): Promise<IssuedSession> {
    const now = this.clock.now();
    const outcome = await this.unitOfWork.run<SignInOutcome>(async ({ users, sessions }) => {
      const user = await users.findByEmail(email);
      if (!user || user.deleted || !user.isActive) {
        // Same work and the same answer as a wrong password, so accounts cannot be discovered.
        await this.hasher.verify('', password);
        return { refusal: 'wrongCredentials' as const };
      }
      if (user.lockedUntil && user.lockedUntil > now) return { refusal: 'locked' as const };
      if (!(await this.hasher.verify(user.passwordHash, password))) {
        const failedLogins = (user.lockedUntil ? 0 : user.failedLogins) + 1;
        const locks = failedLogins >= MAX_FAILED_SIGN_INS;
        await users.saveSignInState(user.id, {
          failedLogins: locks ? 0 : failedLogins,
          lockedUntil: locks ? minutesAfter(now, LOCK_MINUTES) : null,
        });
        return { refusal: locks ? ('locked' as const) : ('wrongCredentials' as const) };
      }
      if (user.failedLogins > 0 || user.lockedUntil) {
        await users.saveSignInState(user.id, { failedLogins: 0, lockedUntil: null });
      }
      return { session: await this.openSession(sessions, user, client, now) };
    });
    // The failure count is committed even though the answer is a refusal.
    if ('refusal' in outcome) throw new AuthRefusedError(outcome.refusal);
    return outcome.session;
  }

  /** The guard: a valid access token whose session is still open. */
  async authenticate(accessToken: string): Promise<Authenticated> {
    const now = this.clock.now();
    const claims = this.tokens.verify(accessToken, now);
    if (!claims) throw new AuthRefusedError('sessionEnded');
    return this.unitOfWork.run(async ({ users, sessions }) => {
      const session = await sessions.findById(claims.sessionId);
      const user = session ? await users.findById(session.userId) : null;
      if (!session || !user || !isOpen(session, now) || !user.isActive || user.deleted) {
        throw new AuthRefusedError('sessionEnded');
      }
      if (now.getTime() - session.lastSeenAt.getTime() >= TOUCH_EVERY_MS) {
        await sessions.touch(session.id, now);
      }
      return { user: toSessionUser(user), sessionId: session.id };
    });
  }

  async refresh(refreshToken: string): Promise<IssuedSession> {
    const now = this.clock.now();
    return this.unitOfWork.run(async ({ users, sessions }) => {
      const session = await sessions.findByRefreshHash(sha256(refreshToken));
      const user = session ? await users.findById(session.userId) : null;
      if (!session || !user || !isOpen(session, now) || !user.isActive || user.deleted) {
        throw new AuthRefusedError('sessionEnded');
      }
      const next = newToken();
      await sessions.rotate(session.id, sha256(next), now);
      return {
        user: toSessionUser(user),
        accessToken: this.tokens.sign({ userId: user.id, sessionId: session.id }, now),
        refreshToken: next,
      };
    });
  }

  async signOut(sessionId: number): Promise<void> {
    const now = this.clock.now();
    await this.unitOfWork.run(({ sessions }) => sessions.revoke(sessionId, now));
  }

  /** ChangePassword: at the first sign-in the current password is not asked again. */
  async changePassword(
    { userId, sessionId }: { userId: number; sessionId: number },
    request: ChangePasswordRequest,
  ): Promise<SessionUser> {
    const now = this.clock.now();
    const hash = await this.hasher.hash(request.newPassword);
    return this.unitOfWork.run(async ({ users, sessions, resets }) => {
      const user = await users.findById(userId);
      if (!user) throw new AuthRefusedError('sessionEnded');
      if (
        !user.mustChangePassword &&
        !(await this.hasher.verify(user.passwordHash, request.currentPassword ?? ''))
      ) {
        throw new AuthRefusedError('currentPasswordWrong');
      }
      await users.setPassword(userId, hash, false);
      await resets.voidOpen(userId, now);
      await sessions.revokeAllForUser(userId, now, sessionId);
      return toSessionUser({ ...user, mustChangePassword: false });
    });
  }

  /** DEC-102: always the same answer; a link only for an active account. */
  async forgotPassword(email: string): Promise<void> {
    const now = this.clock.now();
    const token = newToken();
    const recipient = await this.unitOfWork.run(async ({ users, resets }) => {
      const user = await users.findByEmail(email);
      if (!user || user.deleted || !user.isActive) return null;
      await resets.voidOpen(user.id, now);
      await resets.create({
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: minutesAfter(now, RESET_LINK_MINUTES),
      });
      return user;
    });
    if (!recipient) return;
    const link = new URL(this.options.resetPageUrl);
    link.searchParams.set('token', token);
    await this.email.sendPasswordReset({
      to: recipient.email,
      name: recipient.name,
      link: link.toString(),
    });
  }

  /** DEC-114: once, within 60 minutes; clears the lock and ends every session. */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const now = this.clock.now();
    const hash = await this.hasher.hash(newPassword);
    await this.unitOfWork.run(async ({ users, sessions, resets }) => {
      const reset = await resets.findByHash(sha256(token));
      if (!reset || reset.usedAt || reset.expiresAt <= now) {
        throw new AuthRefusedError('resetLinkInvalid');
      }
      await resets.markUsed(reset.id, now);
      await users.setPassword(reset.userId, hash, false);
      await sessions.revokeAllForUser(reset.userId, now);
    });
  }

  /** REQ-IAM-001: the Access Manager unlocks an account (screen in TASK-107). */
  async unlock(userId: number): Promise<void> {
    await this.unitOfWork.run(({ users }) =>
      users.saveSignInState(userId, { failedLogins: 0, lockedUntil: null }),
    );
  }

  /** REQ-IAM-009: a one-time temporary password, changed at the next sign-in (screen in TASK-107). */
  async issueTemporaryPassword(userId: number): Promise<string> {
    const now = this.clock.now();
    const temporary = temporaryPassword();
    const hash = await this.hasher.hash(temporary);
    await this.unitOfWork.run(async ({ users, sessions, resets }) => {
      await users.setPassword(userId, hash, true);
      await resets.voidOpen(userId, now);
      await sessions.revokeAllForUser(userId, now);
    });
    return temporary;
  }

  private async openSession(
    sessions: IamGateways['sessions'],
    user: AuthUser,
    client: Client,
    now: Date,
  ): Promise<IssuedSession> {
    const refreshToken = newToken();
    const sessionId = await sessions.create({
      userId: user.id,
      client,
      refreshTokenHash: sha256(refreshToken),
      lastSeenAt: now,
      expiresAt:
        client === 'mobile'
          ? minutesAfter(now, MOBILE_SESSION_DAYS * 24 * 60)
          : minutesAfter(now, WEB_IDLE_MINUTES),
    });
    return {
      user: toSessionUser(user),
      accessToken: this.tokens.sign({ userId: user.id, sessionId }, now),
      refreshToken,
    };
  }
}

function isOpen(
  session: { client: Client; lastSeenAt: Date; expiresAt: Date; revokedAt: Date | null },
  now: Date,
): boolean {
  if (session.revokedAt) return false;
  if (session.client === 'web') return minutesAfter(session.lastSeenAt, WEB_IDLE_MINUTES) > now;
  return session.expiresAt > now;
}
