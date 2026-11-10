import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import pg from 'pg';
import { CLOCK, EMAIL, PASSWORD_HASHER, PG_POOL, PLANNER_APPROVAL_END } from './app.tokens.js';
import { AccountService } from './core/iam/account-service.js';
import { AuthService } from './core/iam/auth-service.js';
import { CapabilityService } from './core/iam/capability-service.js';
import { PlannerApprovalService } from './core/iam/planner-approval-service.js';
import { RolePermissionService } from './core/iam/role-permission-service.js';
import { AccountErrorFilter, AccountsController } from './http/accounts/accounts.controller.js';
import { AuthController } from './http/auth/auth.controller.js';
import {
  ActionRefusedFilter,
  AUTH_HTTP_CONFIG,
  AuthRefusedFilter,
  SessionGuard,
  type AuthHttpConfig,
} from './http/auth/auth-http.js';
import { ConcurrentUpdateFilter } from './http/concurrent-update.filter.js';
import { ContractInterceptor } from './http/contract.interceptor.js';
import { HealthController } from './http/health.controller.js';
import {
  PlannerApprovalController,
  PlannerApprovalErrorFilter,
} from './http/planner-approval/planner-approval.controller.js';
import { RolePermissionsController } from './http/role-permissions/role-permissions.controller.js';
import { SystemClock } from './infra/clock/system-clock.js';
import { HmacAccessTokenSigner } from './infra/crypto/hmac-access-token-signer.js';
import { ScryptPasswordHasher } from './infra/crypto/scrypt-password-hasher.js';
import { accountGateways } from './infra/db/account-gateways.js';
import { iamGateways } from './infra/db/iam-gateways.js';
import { plannerApprovalGateways } from './infra/db/planner-approval-gateways.js';
import { rolePermissionGateways } from './infra/db/role-permission-gateways.js';
import { DrizzleUnitOfWork } from './infra/db/unit-of-work.js';
import { ConsoleEmailAdapter } from './infra/email/console-email.js';
import { PlannerApprovalEndQueue } from './infra/queue/planner-approval-end-queue.js';
import type { ClockPort } from './ports/clock.js';
import type { EmailPort, PasswordHasher } from './ports/iam.js';
import type { PlannerApprovalEndScheduler } from './ports/planner-approval.js';

const LOCAL_DATABASE_URL = 'postgres://bmi:bmi_local_dev@localhost:5432/bmi_dev';
const LOCAL_WEB_ORIGIN = 'http://localhost:3000';
const LOCAL_REDIS_URL = 'redis://localhost:6379';
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
  controllers: [
    HealthController,
    AuthController,
    AccountsController,
    RolePermissionsController,
    PlannerApprovalController,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ConcurrentUpdateFilter },
    { provide: APP_FILTER, useClass: AuthRefusedFilter },
    { provide: APP_FILTER, useClass: ActionRefusedFilter },
    { provide: APP_FILTER, useClass: AccountErrorFilter },
    { provide: APP_FILTER, useClass: PlannerApprovalErrorFilter },
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
    {
      provide: CapabilityService,
      inject: [PG_POOL, CLOCK],
      useFactory: (pool: pg.Pool, clock: ClockPort) =>
        new CapabilityService(new DrizzleUnitOfWork(pool, iamGateways), clock),
    },
    {
      provide: AccountService,
      inject: [PG_POOL, PASSWORD_HASHER, CLOCK],
      useFactory: (pool: pg.Pool, hasher: PasswordHasher, clock: ClockPort) =>
        new AccountService(new DrizzleUnitOfWork(pool, accountGateways), hasher, clock),
    },
    {
      provide: RolePermissionService,
      inject: [PG_POOL],
      useFactory: (pool: pg.Pool) =>
        new RolePermissionService(new DrizzleUnitOfWork(pool, rolePermissionGateways)),
    },
    {
      provide: PLANNER_APPROVAL_END,
      inject: [CLOCK],
      useFactory: (clock: ClockPort) =>
        new PlannerApprovalEndQueue(process.env.REDIS_URL ?? LOCAL_REDIS_URL, () => clock.now()),
    },
    {
      provide: PlannerApprovalService,
      inject: [PG_POOL, CLOCK, PLANNER_APPROVAL_END],
      useFactory: (pool: pg.Pool, clock: ClockPort, scheduler: PlannerApprovalEndScheduler) =>
        new PlannerApprovalService(
          new DrizzleUnitOfWork(pool, plannerApprovalGateways),
          clock,
          scheduler,
        ),
    },
    SessionGuard,
  ],
  // Feature modules guard their routes with SessionGuard and @RequireCapability (2.4 L1).
  exports: [
    AuthService,
    CapabilityService,
    PlannerApprovalService,
    PLANNER_APPROVAL_END,
    AUTH_HTTP_CONFIG,
    SessionGuard,
  ],
})
export class AppModule {}
