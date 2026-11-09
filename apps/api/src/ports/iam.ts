import type { Client, Role } from '@bmi/shared';

/** The account as sign-in sees it (§9.2 users + its one role). */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  deleted: boolean;
  failedLogins: number;
  mustChangePassword: boolean;
  lockedUntil: Date | null;
  role: Role | null;
}

export interface UserGateway {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: number): Promise<AuthUser | null>;
  /** REQ-IAM-001: the failure count and the lock after 5 failures. */
  saveSignInState(
    id: number,
    state: { failedLogins: number; lockedUntil: Date | null },
  ): Promise<void>;
  /** REQ-IAM-009: a new hash; `mustChange` is true for a temporary password. Clears the lock. */
  setPassword(id: number, passwordHash: string, mustChange: boolean): Promise<void>;
}

export interface AuthSession {
  id: number;
  userId: number;
  client: Client;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface AuthSessionGateway {
  create(session: {
    userId: number;
    client: Client;
    refreshTokenHash: string;
    lastSeenAt: Date;
    expiresAt: Date;
  }): Promise<number>;
  findById(id: number): Promise<AuthSession | null>;
  findByRefreshHash(hash: string): Promise<AuthSession | null>;
  /** Rotates the refresh token and records activity. */
  rotate(id: number, refreshTokenHash: string, at: Date): Promise<void>;
  touch(id: number, at: Date): Promise<void>;
  revoke(id: number, at: Date): Promise<void>;
  /** Every open session of the user, except `keepSessionId` when given. */
  revokeAllForUser(userId: number, at: Date, keepSessionId?: number): Promise<void>;
}

export interface PasswordResetToken {
  id: number;
  userId: number;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface PasswordResetGateway {
  /** A newer link or a password change voids the older ones. */
  voidOpen(userId: number, at: Date): Promise<void>;
  create(token: { userId: number; tokenHash: string; expiresAt: Date }): Promise<void>;
  findByHash(hash: string): Promise<PasswordResetToken | null>;
  markUsed(id: number, at: Date): Promise<void>;
}

export interface IamGateways {
  users: UserGateway;
  sessions: AuthSessionGateway;
  resets: PasswordResetGateway;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}

export interface AccessTokenClaims {
  userId: number;
  sessionId: number;
}

/** Short-lived access tokens; the session row decides whether they still count. */
export interface AccessTokenSigner {
  sign(claims: AccessTokenClaims, now: Date): string;
  /** Null when the signature is wrong or the token expired. */
  verify(token: string, now: Date): AccessTokenClaims | null;
}

/** NFR-11, DEC-102: the one email of Release 1. */
export interface EmailPort {
  sendPasswordReset(message: { to: string; name: string; link: string }): Promise<void>;
}
