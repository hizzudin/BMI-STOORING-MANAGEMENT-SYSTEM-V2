import {
  ChangePasswordRequestSchema,
  ForgotPasswordRequestSchema,
  OkResponseSchema,
  RefreshRequestSchema,
  ResetPasswordRequestSchema,
  MeResponseSchema,
  SessionResponseSchema,
  SignInRequestSchema,
  SignInResponseSchema,
  type ChangePasswordRequest,
  type ResetPasswordRequest,
  type MeResponse,
  type SessionResponse,
  type SignInRequest,
  type SignInResponse,
} from '@bmi/shared';
import { Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';
import {
  AuthService,
  type Authenticated,
  type IssuedSession,
} from '../../core/iam/auth-service.js';
import { AuthRefusedError } from '../../core/iam/errors.js';
import { ApiContract, ValidBody } from '../contract.js';
import {
  AllowWhilePasswordChange,
  assertWebOrigin,
  AUTH_HTTP_CONFIG,
  clearSessionCookies,
  CurrentSession,
  readCookie,
  REFRESH_COOKIE,
  SessionGuard,
  setSessionCookies,
  type AuthHttpConfig,
  type SignedIn,
} from './auth-http.js';

const SignIn = { name: 'SignInResponse', schema: SignInResponseSchema };
const Session = { name: 'SessionResponse', schema: SessionResponseSchema };
const Ok = { name: 'OkResponse', schema: OkResponseSchema };
type OkResponse = z.infer<typeof OkResponseSchema>;

/** REQ-IAM-001, REQ-IAM-009, NFR-05, DEC-102, DEC-114. Sign-in has no account yet, so no Idempotency-Key. */
@Controller()
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AUTH_HTTP_CONFIG) private readonly config: AuthHttpConfig,
  ) {}

  @Post('auth/sign-in')
  @HttpCode(200)
  @ApiContract({
    operationId: 'signIn',
    summary: 'Signs in with email and password (web: cookies, phone: tokens in the body)',
    body: { name: 'SignInRequest', schema: SignInRequestSchema },
    response: SignIn,
  })
  async signIn(
    @ValidBody() body: SignInRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignInResponse> {
    const session = await this.auth.signIn(body);
    return this.deliver(session, body.client === 'web', response);
  }

  @Post('auth/refresh')
  @HttpCode(200)
  @ApiContract({
    operationId: 'refreshSession',
    summary: 'Renews the access token and rotates the refresh token',
    body: { name: 'RefreshRequest', schema: RefreshRequestSchema },
    response: SignIn,
  })
  async refresh(
    @ValidBody() body: z.infer<typeof RefreshRequestSchema>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignInResponse> {
    const fromCookie = body.refreshToken === undefined;
    if (fromCookie) assertWebOrigin(request, this.config);
    const token = body.refreshToken ?? readCookie(request, REFRESH_COOKIE);
    if (!token) throw new AuthRefusedError('sessionEnded');
    try {
      return this.deliver(await this.auth.refresh(token), fromCookie, response);
    } catch (error) {
      if (fromCookie) clearSessionCookies(response, this.config);
      throw error;
    }
  }

  @Post('auth/sign-out')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @AllowWhilePasswordChange()
  @ApiContract({ operationId: 'signOut', summary: 'Ends this session (C-04)', response: Ok })
  async signOut(
    @CurrentSession() session: Authenticated,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OkResponse> {
    await this.auth.signOut(session.sessionId);
    clearSessionCookies(response, this.config);
    return { ok: true };
  }

  @Post('auth/change-password')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @AllowWhilePasswordChange()
  @ApiContract({
    operationId: 'changePassword',
    summary: 'Changes the password; the current one is asked except at the first sign-in',
    body: { name: 'ChangePasswordRequest', schema: ChangePasswordRequestSchema },
    response: Session,
  })
  async changePassword(
    @CurrentSession() session: Authenticated,
    @ValidBody() body: ChangePasswordRequest,
  ): Promise<SessionResponse> {
    const user = await this.auth.changePassword(
      { userId: session.user.id, sessionId: session.sessionId },
      body,
    );
    return { user };
  }

  @Post('auth/forgot-password')
  @HttpCode(200)
  @ApiContract({
    operationId: 'forgotPassword',
    summary: 'Emails one reset link when the address belongs to an active account (DEC-102)',
    body: { name: 'ForgotPasswordRequest', schema: ForgotPasswordRequestSchema },
    response: Ok,
  })
  async forgotPassword(
    @ValidBody() body: z.infer<typeof ForgotPasswordRequestSchema>,
  ): Promise<OkResponse> {
    await this.auth.forgotPassword(body.email);
    return { ok: true };
  }

  @Post('auth/reset-password')
  @HttpCode(200)
  @ApiContract({
    operationId: 'resetPassword',
    summary: 'Sets a new password from a reset link (once, within 60 minutes)',
    body: { name: 'ResetPasswordRequest', schema: ResetPasswordRequestSchema },
    response: Ok,
  })
  async resetPassword(@ValidBody() body: ResetPasswordRequest): Promise<OkResponse> {
    await this.auth.resetPassword(body.token, body.newPassword);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @AllowWhilePasswordChange()
  @ApiContract({
    operationId: 'getMe',
    summary:
      'The signed-in account, its effective capability set and the system mode (REQ-IAM-013)',
    response: { name: 'MeResponse', schema: MeResponseSchema },
  })
  me(@CurrentSession() session: SignedIn): MeResponse {
    return {
      user: session.user,
      capabilities: [...session.capabilities].sort(),
      systemMode: session.systemMode,
    };
  }

  private deliver(session: IssuedSession, web: boolean, response: Response): SignInResponse {
    if (!web) return session;
    setSessionCookies(response, this.config, session);
    return { user: session.user };
  }
}
