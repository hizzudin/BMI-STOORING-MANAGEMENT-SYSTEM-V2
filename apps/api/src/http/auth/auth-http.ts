import 'reflect-metadata';
import {
  Catch,
  createParamDecorator,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
  type ArgumentsHost,
  type CanActivate,
  type ExceptionFilter,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionCode } from '@bmi/shared';
import type { Request, Response } from 'express';
import { AuthService, WEB_IDLE_MINUTES, type Authenticated } from '../../core/iam/auth-service.js';
import { CapabilityService, type CapabilitySnapshot } from '../../core/iam/capability-service.js';
import { AuthRefusedError, type AuthRefusalKind } from '../../core/iam/errors.js';

export const AUTH_HTTP_CONFIG = Symbol('AUTH_HTTP_CONFIG');

export interface AuthHttpConfig {
  /** The web app's origin; cookie requests that change data must come from it. */
  webOrigin: string;
  /** Secure cookies outside local development. */
  secureCookies: boolean;
}

export const ACCESS_COOKIE = 'bmi_access';
export const REFRESH_COOKIE = 'bmi_refresh';
const COOKIE_SECONDS = WEB_IDLE_MINUTES * 60;

export function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

export function setSessionCookies(
  response: Response,
  config: AuthHttpConfig,
  tokens: { accessToken: string; refreshToken: string },
): void {
  const options = {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: config.secureCookies,
    path: '/',
    maxAge: COOKIE_SECONDS * 1000,
  };
  response.cookie(ACCESS_COOKIE, tokens.accessToken, options);
  response.cookie(REFRESH_COOKIE, tokens.refreshToken, options);
}

export function clearSessionCookies(response: Response, config: AuthHttpConfig): void {
  const options = {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: config.secureCookies,
    path: '/',
    maxAge: 0,
  };
  response.cookie(ACCESS_COOKIE, '', options);
  response.cookie(REFRESH_COOKIE, '', options);
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** design.md 5.1: a cookie request that changes data must carry the web app's Origin. */
export function assertWebOrigin(request: Request, config: AuthHttpConfig): void {
  if (SAFE_METHODS.has(request.method)) return;
  if (request.header('origin') !== config.webOrigin) {
    throw new ForbiddenException('This request did not come from the BMI Stooring System web app.');
  }
}

export type SignedIn = Authenticated & CapabilitySnapshot;
export type AuthenticatedRequest = Request & { auth?: SignedIn };

const REQUIRED_CAPABILITY = Symbol('required-capability');
/** REQ-IAM-006, 2.4 L1: the route needs at least one of these codes of the effective capability set. */
export const RequireCapability = (...codes: PermissionCode[]) =>
  SetMetadata(REQUIRED_CAPABILITY, codes);

export const NOT_ALLOWED = 'You do not have permission to do this.';

const ALLOW_WHILE_PASSWORD_CHANGE = Symbol('allow-while-password-change');
/** REQ-IAM-009: the only routes a session may use before the first password change. */
export const AllowWhilePasswordChange = () => SetMetadata(ALLOW_WHILE_PASSWORD_CHANGE, true);

/** Bearer token (phone) or access cookie (web); the session row must still be open. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(CapabilityService) private readonly capabilities: CapabilityService,
    @Inject(AUTH_HTTP_CONFIG) private readonly config: AuthHttpConfig,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const bearer = /^Bearer (.+)$/.exec(request.header('authorization') ?? '')?.[1];
    const cookie = readCookie(request, ACCESS_COOKIE);
    const token = bearer ?? cookie;
    if (!token) throw new AuthRefusedError('sessionEnded');
    if (!bearer) assertWebOrigin(request, this.config);
    const session = await this.auth.authenticate(token);
    // REQ-IAM-012: computed on every request, so a matrix change counts without a new sign-in.
    request.auth = { ...session, ...(await this.capabilities.forRole(session.user.role)) };
    const allowed = this.reflector.get<boolean | undefined>(
      ALLOW_WHILE_PASSWORD_CHANGE,
      context.getHandler(),
    );
    if (request.auth.user.mustChangePassword && !allowed)
      throw new AuthRefusedError('passwordChangeFirst');
    const required = this.reflector.get<PermissionCode[] | undefined>(
      REQUIRED_CAPABILITY,
      context.getHandler(),
    );
    if (required && !required.some((code) => request.auth?.capabilities.has(code))) {
      throw new ForbiddenException(NOT_ALLOWED);
    }
    return true;
  }
}

export const CurrentSession = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const auth = context.switchToHttp().getRequest<AuthenticatedRequest>().auth;
  if (!auth) throw new Error('CurrentSession needs SessionGuard on the route');
  return auth;
});

const STATUS: Record<AuthRefusalKind, number> = {
  wrongCredentials: HttpStatus.UNAUTHORIZED,
  sessionEnded: HttpStatus.UNAUTHORIZED,
  locked: HttpStatus.LOCKED,
  currentPasswordWrong: HttpStatus.BAD_REQUEST,
  resetLinkInvalid: HttpStatus.BAD_REQUEST,
  passwordChangeFirst: HttpStatus.FORBIDDEN,
};

@Catch(AuthRefusedError)
export class AuthRefusedFilter implements ExceptionFilter<AuthRefusedError> {
  catch(error: AuthRefusedError, host: ArgumentsHost): void {
    const status = STATUS[error.kind];
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
