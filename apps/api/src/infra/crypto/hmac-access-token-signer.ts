import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AccessTokenClaims, AccessTokenSigner } from '../../ports/iam.js';

/** design.md 5.1: the access token lives 5 minutes. */
export const ACCESS_TOKEN_SECONDS = 5 * 60;
const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const MIN_SECRET_LENGTH = 32;

interface Payload {
  sub: string;
  sid: number;
  iat: number;
  exp: number;
}

/** A compact HS256 JWT; node:crypto only, so no token library joins the dependencies. */
export class HmacAccessTokenSigner implements AccessTokenSigner {
  constructor(private readonly secret: string) {
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new Error(`AUTH_TOKEN_SECRET needs at least ${MIN_SECRET_LENGTH} characters`);
    }
  }

  sign({ userId, sessionId }: AccessTokenClaims, now: Date): string {
    const iat = Math.floor(now.getTime() / 1000);
    const payload: Payload = {
      sub: String(userId),
      sid: sessionId,
      iat,
      exp: iat + ACCESS_TOKEN_SECONDS,
    };
    const body = `${HEADER}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
    return `${body}.${this.signature(body)}`;
  }

  verify(token: string, now: Date): AccessTokenClaims | null {
    const [header, payload, signature] = token.split('.');
    if (header !== HEADER || !payload || !signature) return null;
    const expected = Buffer.from(this.signature(`${header}.${payload}`));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    try {
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Payload;
      if (claims.exp <= Math.floor(now.getTime() / 1000)) return null;
      return { userId: Number(claims.sub), sessionId: claims.sid };
    } catch {
      return null;
    }
  }

  private signature(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }
}
