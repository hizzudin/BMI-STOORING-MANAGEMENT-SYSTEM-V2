import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import pg from 'pg';
import { CLOCK, EMAIL, PASSWORD_HASHER, PG_POOL } from './app.tokens.js';
import { AuthService } from './core/iam/auth-service.js';
import { AuthController } from './http/auth/auth.controller.js';
import {
  AUTH_HTTP_CONFIG,
  AuthRefusedFilter,
  SessionGuard,
  type AuthHttpConfig,
} from './http/auth/auth-http.js';
import { ConcurrentUpdateFilter } from './http/concurrent-update.filter.js';
import { ContractInterceptor } from './http/contract.interceptor.js';
import { HealthController } from './http/health.controller.js';
import { SystemClock } from './infra/clock/system-clock.js';
import { HmacAccessTokenSigner } from './infra/crypto/hmac-access-token-signer.js';
import { ScryptPasswordHasher } from './infra/crypto/scrypt-password-hasher.js';
import { iamGateways } from './infra/db/iam-gateways.js';
import { DrizzleUnitOfWork } from './infra/db/unit-of-work.js';
import { ConsoleEmailAdapter } from './infra/email/console-email.js';
import type { ClockPort } from './ports/clock.js';
import type { EmailPort, PasswordHasher } from './ports/iam.js';

const LOCAL_DATABASE_URL = 'postgres://bmi:bmi_local_dev@localhost:5432/bmi_dev';
const LOCAL_WEB_ORIGIN = 'http://localhost:3000';
// Local development only; production refuses to start without AUTH_TOKEN_SECRET (never committed).
const LOCAL_TOKEN_SECRET = 'local-development-only-secret-0123456789';

const production = () => process.env.NODE_ENV === 'production';

function tokenSecret(): string {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (secret) return secret;
  if (production()) throw new Error('AUTH_TOKEN_SECRET is required in production');
  return LOCAL_TOKEN_SECRET;
}

const authHttpConfig = (): AuthHttpConfig => ({
  webOrigin: process.env.WEB_ORIGIN ?? LOCAL_WEB_ORIGIN,
  secureCookies: production(),
});

/** The composition root: the only place that knows both the core and the adapters. */
@Module({
  controllers: [HealthController, AuthController],
  providers: [
    { provide: APP_FILTER, useClass: ConcurrentUpdateFilter },
    { provide: APP_FILTER, useClass: AuthRefusedFilter },
    { provide: APP_INTERCEPTOR, useClass: ContractInterceptor },
    {
      provide: PG_POOL,
      useFactory: () =>
        new pg.Pool({ connectionString: process.env.DATABASE_URL ?? LOCAL_DATABASE_URL }),
    },
    { provide: CLOCK, useClass: SystemClock },
    { provide: EMAIL, useFactory: () => new ConsoleEmailAdapter() },
    { provide: PASSWORD_HASHER, useFactory: () => new ScryptPasswordHasher() },
    { provide: AUTH_HTTP_CONFIG, useFactory: authHttpConfig },
    {
      provide: AuthService,
      inject: [PG_POOL, PASSWORD_HASHER, EMAIL, CLOCK, AUTH_HTTP_CONFIG],
      useFactory: (
        pool: pg.Pool,
        hasher: PasswordHasher,
        email: EmailPort,
        clock: ClockPort,
        config: AuthHttpConfig,
      ) =>
        new AuthService(
          new DrizzleUnitOfWork(pool, iamGateways),
          hasher,
          new HmacAccessTokenSigner(tokenSecret()),
          email,
          clock,
          { resetPageUrl: `${config.webOrigin}/reset-password` },
        ),
    },
    SessionGuard,
  ],
})
export class AppModule {}
