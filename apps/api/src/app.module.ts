import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import pg from 'pg';
import {
  CLOCK,
  EMAIL,
  PASSWORD_HASHER,
  PG_POOL,
  PLANNER_APPROVAL_END,
  STORAGE,
  STORAGE_LINKS,
  FILE_JOBS,
  MEDIA,
  MODULE_CATALOG,
  MODULE_LIST,
  VEHICLE_ACTIVITY,
} from './app.tokens.js';
import { MODULES } from './app.modules.js';
import type { RegisteredModule } from './engine/module-contract.js';
import { ModuleCatalogService } from './engine/registry/module-catalog.js';
import type { ModuleCatalog } from './ports/registry.js';
import { DocumentTypeService } from './core/fleet/document-type-service.js';
import { VehicleClassService } from './core/fleet/vehicle-class-service.js';
import { VehicleService } from './core/fleet/vehicle-service.js';
import { NotificationService } from './core/notifications/notification-service.js';
import { SpkService } from './core/spk/spk-service.js';
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
import {
  DocumentTypeErrorFilter,
  DocumentTypesController,
} from './http/document-types/document-types.controller.js';
import { HealthController } from './http/health.controller.js';
import {
  NotificationErrorFilter,
  NotificationsController,
} from './http/notifications/notifications.controller.js';
import {
  PlannerApprovalController,
  PlannerApprovalErrorFilter,
} from './http/planner-approval/planner-approval.controller.js';
import { RolePermissionsController } from './http/role-permissions/role-permissions.controller.js';
import { SpkErrorFilter, SpksController } from './http/spks/spks.controller.js';
import { SpkListService } from './core/spk/spk-list-service.js';
import {
  VehicleClassErrorFilter,
  VehicleClassesController,
} from './http/vehicle-classes/vehicle-classes.controller.js';
import { VehicleErrorFilter, VehiclesController } from './http/vehicles/vehicles.controller.js';
import { SystemClock } from './infra/clock/system-clock.js';
import { HmacAccessTokenSigner } from './infra/crypto/hmac-access-token-signer.js';
import { ScryptPasswordHasher } from './infra/crypto/scrypt-password-hasher.js';
import { accountGateways } from './infra/db/account-gateways.js';
import { documentTypeGateways } from './infra/db/document-type-gateways.js';
import { iamGateways } from './infra/db/iam-gateways.js';
import { notificationGateways } from './infra/db/notification-gateways.js';
import { plannerApprovalGateways } from './infra/db/planner-approval-gateways.js';
import { rolePermissionGateways } from './infra/db/role-permission-gateways.js';
import { spkGateways } from './infra/db/spk-gateways.js';
import { approvalGateways } from './infra/db/approval-gateways.js';
import { engineGateways } from './infra/db/engine-gateways.js';
import { StepService } from './engine/step-service.js';
import { StepErrorFilter, StepsController } from './http/spks/steps.controller.js';
import { ApprovalService } from './core/approvals/approval-service.js';
import { ApprovalsController } from './http/approvals/approvals.controller.js';
import { AuditLogService } from './core/audit/audit-log-service.js';
import {
  AccessHistoryController,
  AuditLogController,
  AuditLogErrorFilter,
} from './http/audit-log/audit-log.controller.js';
import { auditLogGateways } from './infra/db/audit-log-gateways.js';
import { SystemModeService } from './core/iam/system-mode-service.js';
import {
  SystemModeController,
  SystemModeErrorFilter,
} from './http/system-mode/system-mode.controller.js';
import { systemModeGateways } from './infra/db/system-mode-gateways.js';
import { VendorService } from './core/inventory/vendor-service.js';
import { FileCleanup, FileProcessor } from './core/files/file-jobs.js';
import { FileService } from './core/files/file-service.js';
import { StorageUsageCheck } from './core/files/storage-usage.js';
import { AuditArchiveJob } from './core/audit/audit-archive.js';
import { auditArchiveGateways } from './infra/db/audit-archive-gateways.js';
import { storageUsageGateways } from './infra/db/storage-usage-gateways.js';
import { FileErrorFilter, FilesController } from './http/files/files.controller.js';
import { fileGateways } from './infra/db/file-gateways.js';
import { SharpPdfjsMediaProcessor } from './infra/files/media-processor.js';
import {
  FileCleanupQueue,
  FileProcessingQueue,
  StorageUsageQueue,
  AuditArchiveQueue,
} from './infra/queue/file-queues.js';
import type { FileJobs, MediaProcessor } from './ports/files.js';
import type { StoragePort } from './ports/storage.js';
import { VendorErrorFilter, VendorsController } from './http/vendors/vendors.controller.js';
import { vendorGateways } from './infra/db/vendor-gateways.js';
import { FsStorageController, StorageErrorFilter } from './http/storage/fs-storage.controller.js';
import { FsStorageAdapter } from './infra/storage/fs-storage.js';
import { S3StorageAdapter } from './infra/storage/s3-storage.js';
import { ExcelJsSpreadsheetWriter } from './infra/files/exceljs-spreadsheet-writer.js';
import { DrizzleUnitOfWork } from './infra/db/unit-of-work.js';
import { vehicleClassGateways } from './infra/db/vehicle-class-gateways.js';
import { DrizzleVehicleActivity, vehicleGateways } from './infra/db/vehicle-gateways.js';
import { ConsoleEmailAdapter } from './infra/email/console-email.js';
import { PlannerApprovalEndQueue } from './infra/queue/planner-approval-end-queue.js';
import type { ClockPort } from './ports/clock.js';
import type { EmailPort, PasswordHasher } from './ports/iam.js';
import type { PlannerApprovalEndScheduler } from './ports/planner-approval.js';
import type { VehicleActivityGateway } from './ports/vehicles.js';

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

// Local development only; production refuses to start without STORAGE_SIGNING_SECRET (never committed).
const LOCAL_STORAGE_SECRET = 'local-development-only-storage-0123456789';

function storageSecret(): string {
  const secret = process.env.STORAGE_SIGNING_SECRET;
  if (secret) return secret;
  if (production()) throw new Error('STORAGE_SIGNING_SECRET is required in production');
  return LOCAL_STORAGE_SECRET;
}

/** D-03, DEC-135: the filesystem adapter locally and in tests, S3 (R2) in staging and production. */
const storageDriver = () => (process.env.STORAGE_DRIVER === 's3' ? 's3' : 'fs');

function setting(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required when STORAGE_DRIVER is s3`);
  return value;
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
    VehicleClassesController,
    DocumentTypesController,
    VehiclesController,
    NotificationsController,
    SpksController,
    StepsController,
    ApprovalsController,
    AuditLogController,
    AccessHistoryController,
    SystemModeController,
    VendorsController,
    FilesController,
    ...(storageDriver() === 'fs' ? [FsStorageController] : []),
  ],
  providers: [
    { provide: APP_FILTER, useClass: ConcurrentUpdateFilter },
    { provide: APP_FILTER, useClass: AuthRefusedFilter },
    { provide: APP_FILTER, useClass: ActionRefusedFilter },
    { provide: APP_FILTER, useClass: AccountErrorFilter },
    { provide: APP_FILTER, useClass: PlannerApprovalErrorFilter },
    { provide: APP_FILTER, useClass: VehicleClassErrorFilter },
    { provide: APP_FILTER, useClass: DocumentTypeErrorFilter },
    { provide: APP_FILTER, useClass: VehicleErrorFilter },
    { provide: APP_FILTER, useClass: NotificationErrorFilter },
    { provide: APP_FILTER, useClass: SpkErrorFilter },
    { provide: APP_FILTER, useClass: StepErrorFilter },
    { provide: APP_FILTER, useClass: AuditLogErrorFilter },
    { provide: APP_FILTER, useClass: SystemModeErrorFilter },
    { provide: APP_FILTER, useClass: VendorErrorFilter },
    { provide: APP_FILTER, useClass: StorageErrorFilter },
    { provide: APP_FILTER, useClass: FileErrorFilter },
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
    {
      provide: VehicleClassService,
      inject: [PG_POOL],
      useFactory: (pool: pg.Pool) =>
        new VehicleClassService(new DrizzleUnitOfWork(pool, vehicleClassGateways)),
    },
    {
      provide: DocumentTypeService,
      inject: [PG_POOL],
      useFactory: (pool: pg.Pool) =>
        new DocumentTypeService(new DrizzleUnitOfWork(pool, documentTypeGateways)),
    },
    {
      provide: VEHICLE_ACTIVITY,
      inject: [PG_POOL],
      useFactory: (pool: pg.Pool) => new DrizzleVehicleActivity(pool),
    },
    {
      provide: VehicleService,
      inject: [PG_POOL, VEHICLE_ACTIVITY, CLOCK],
      useFactory: (pool: pg.Pool, activity: VehicleActivityGateway, clock: ClockPort) =>
        new VehicleService(new DrizzleUnitOfWork(pool, vehicleGateways), activity, clock),
    },
    {
      provide: NotificationService,
      inject: [PG_POOL, CLOCK],
      useFactory: (pool: pg.Pool, clock: ClockPort) =>
        new NotificationService(new DrizzleUnitOfWork(pool, notificationGateways), clock),
    },
    {
      provide: SpkService,
      inject: [PG_POOL, CLOCK],
      useFactory: (pool: pg.Pool, clock: ClockPort) =>
        new SpkService(new DrizzleUnitOfWork(pool, spkGateways), clock),
    },
    {
      provide: SpkListService,
      inject: [PG_POOL, MODULE_CATALOG],
      useFactory: (pool: pg.Pool, catalog: ModuleCatalog) =>
        new SpkListService(new DrizzleUnitOfWork(pool, spkGateways), catalog),
    },
    {
      provide: ApprovalService,
      inject: [PG_POOL, CLOCK],
      useFactory: (pool: pg.Pool, clock: ClockPort) =>
        new ApprovalService(new DrizzleUnitOfWork(pool, approvalGateways), clock),
    },
    {
      provide: StepService,
      inject: [PG_POOL, CLOCK, MODULE_CATALOG],
      useFactory: (pool: pg.Pool, clock: ClockPort, catalog: ModuleCatalog) =>
        new StepService(new DrizzleUnitOfWork(pool, engineGateways), clock, catalog),
    },
    // TASK-203, DEC-148, DEC-149: the modules in code and the catalog the engine reads.
    { provide: MODULE_LIST, useValue: MODULES },
    {
      provide: MODULE_CATALOG,
      inject: [MODULE_LIST],
      useFactory: (modules: readonly RegisteredModule[]) => new ModuleCatalogService(modules),
    },
    {
      provide: AuditLogService,
      inject: [PG_POOL, CLOCK],
      useFactory: (pool: pg.Pool, clock: ClockPort) =>
        new AuditLogService(
          new DrizzleUnitOfWork(pool, auditLogGateways),
          clock,
          new ExcelJsSpreadsheetWriter(),
        ),
    },
    {
      provide: SystemModeService,
      inject: [PG_POOL, CLOCK],
      useFactory: (pool: pg.Pool, clock: ClockPort) =>
        new SystemModeService(new DrizzleUnitOfWork(pool, systemModeGateways), clock),
    },
    {
      provide: VendorService,
      inject: [PG_POOL],
      useFactory: (pool: pg.Pool) => new VendorService(new DrizzleUnitOfWork(pool, vendorGateways)),
    },
    {
      provide: STORAGE,
      inject: [CLOCK],
      useFactory: (clock: ClockPort) =>
        storageDriver() === 's3'
          ? new S3StorageAdapter({
              endpoint: setting('R2_ENDPOINT'),
              bucket: setting('R2_BUCKET'),
              accessKeyId: setting('R2_ACCESS_KEY_ID'),
              secretAccessKey: setting('R2_SECRET_ACCESS_KEY'),
              region: process.env.R2_REGION,
            })
          : new FsStorageAdapter({
              root: process.env.STORAGE_FS_ROOT ?? '.data/storage',
              secret: storageSecret(),
              clock,
              baseUrl: () => process.env.STORAGE_PUBLIC_URL ?? 'http://localhost:3001',
            }),
    },
    // The fs routes are registered only with the fs driver, so this is the filesystem adapter.
    { provide: STORAGE_LINKS, useExisting: STORAGE },
    {
      provide: FILE_JOBS,
      useFactory: () => new FileProcessingQueue(process.env.REDIS_URL ?? LOCAL_REDIS_URL),
    },
    { provide: MEDIA, useFactory: () => new SharpPdfjsMediaProcessor() },
    {
      provide: FileService,
      inject: [PG_POOL, STORAGE, FILE_JOBS, CLOCK],
      useFactory: (pool: pg.Pool, storage: StoragePort, jobs: FileJobs, clock: ClockPort) =>
        new FileService(
          new DrizzleUnitOfWork(pool, fileGateways),
          storage,
          jobs,
          clock,
          process.env.STORAGE_ENV ?? 'local',
        ),
    },
    {
      provide: FileProcessor,
      inject: [PG_POOL, STORAGE, MEDIA],
      useFactory: (pool: pg.Pool, storage: StoragePort, media: MediaProcessor) =>
        new FileProcessor(new DrizzleUnitOfWork(pool, fileGateways), storage, media),
    },
    {
      provide: FileCleanup,
      inject: [PG_POOL, STORAGE, CLOCK],
      useFactory: (pool: pg.Pool, storage: StoragePort, clock: ClockPort) =>
        new FileCleanup(new DrizzleUnitOfWork(pool, fileGateways), storage, clock),
    },
    {
      provide: StorageUsageCheck,
      inject: [PG_POOL, STORAGE],
      useFactory: (pool: pg.Pool, storage: StoragePort) =>
        new StorageUsageCheck(new DrizzleUnitOfWork(pool, storageUsageGateways), storage),
    },
    {
      provide: AuditArchiveJob,
      inject: [PG_POOL, STORAGE, CLOCK],
      useFactory: (pool: pg.Pool, storage: StoragePort, clock: ClockPort) =>
        new AuditArchiveJob(
          new DrizzleUnitOfWork(pool, auditArchiveGateways),
          storage,
          clock,
          process.env.STORAGE_ENV ?? 'local',
        ),
    },
    {
      provide: AuditArchiveQueue,
      useFactory: () => new AuditArchiveQueue(process.env.REDIS_URL ?? LOCAL_REDIS_URL),
    },
    {
      provide: StorageUsageQueue,
      useFactory: () => new StorageUsageQueue(process.env.REDIS_URL ?? LOCAL_REDIS_URL),
    },
    {
      provide: FileCleanupQueue,
      useFactory: () => new FileCleanupQueue(process.env.REDIS_URL ?? LOCAL_REDIS_URL),
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
