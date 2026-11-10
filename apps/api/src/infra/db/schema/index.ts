import { ROLES } from '@bmi/shared';
import {
  bigint,
  boolean,
  char,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  varchar,
  type PgTable,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role_t', ROLES);

const id = () => bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity();
const createdAt = () => timestamp('created_at').notNull().defaultNow();
const updatedAt = () => timestamp('updated_at');

// §9.2 Identity, access and audit
export const users = pgTable('users', {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: timestamp('deleted_at'),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 150 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  failedLogins: smallint('failed_logins').notNull().default(0),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  lockedUntil: timestamp('locked_until'),
});

// DEC-114: sign-in sessions and reset links; tokens only as SHA-256 hashes.
export const authSessions = pgTable('auth_sessions', {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  client: varchar('client', { length: 10 }).notNull(),
  refreshTokenHash: varchar('refresh_token_hash', { length: 64 }).notNull().unique(),
  lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
});

export const userRoles = pgTable(
  'user_roles',
  {
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    role: roleEnum('role').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.role] })],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    role: roleEnum('role').notNull(),
    permissionCode: varchar('permission_code', { length: 60 }).notNull(),
    allowed: boolean('allowed').notNull(),
    isLocked: boolean('is_locked').notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.role, table.permissionCode] })],
);

export const auditLogs = pgTable('audit_logs', {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  entity: varchar('entity', { length: 60 }).notNull(),
  entityId: bigint('entity_id', { mode: 'number' }).notNull(),
  action: varchar('action', { length: 40 }).notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  reason: text('reason'),
  userId: bigint('user_id', { mode: 'number' }),
  userRole: roleEnum('user_role'),
  selfDecision: boolean('self_decision').notNull().default(false),
  at: timestamp('at').notNull().defaultNow(),
});

// §9.12 Platform tables used in R1 step 1
export const appSettings = pgTable('app_settings', {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  settingKey: varchar('setting_key', { length: 60 }).notNull().unique(),
  settingValue: jsonb('setting_value').notNull(),
});

export const storedFiles = pgTable('stored_files', {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  storageKey: varchar('storage_key', { length: 300 }).notNull().unique(),
  thumbKey: varchar('thumb_key', { length: 300 }),
  profile: varchar('profile', { length: 10 }).notNull(),
  mimeType: varchar('mime_type', { length: 30 }).notNull(),
  originalName: varchar('original_name', { length: 255 }),
  originalBytes: integer('original_bytes'),
  storedBytes: integer('stored_bytes'),
  width: integer('width'),
  height: integer('height'),
  pageCount: integer('page_count'),
  sha256: char('sha256', { length: 64 }),
  capturedAt: timestamp('captured_at'),
  captureSource: varchar('capture_source', { length: 8 }),
  status: varchar('status', { length: 10 }).notNull().default('Pending'),
  rejectReason: text('reject_reason'),
  uploadedBy: bigint('uploaded_by', { mode: 'number' }).notNull(),
  attachedAt: timestamp('attached_at'),
});

export const userTablePreferences = pgTable(
  'user_table_preferences',
  {
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    tableKey: varchar('table_key', { length: 60 }).notNull(),
    columns: jsonb('columns').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tableKey] })],
);

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at'),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    idemKey: varchar('idem_key', { length: 100 }).notNull(),
    requestHash: char('request_hash', { length: 64 }).notNull(),
    responseStatus: smallint('response_status'),
    responseBody: jsonb('response_body'),
  },
  (table) => [unique().on(table.userId, table.idemKey)],
);

// §9.3 vehicle classes and chassis layouts (DEC-120)
export const chassisLayouts = pgTable(
  'chassis_layouts',
  {
    id: id(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    code: varchar('code', { length: 40 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    version: integer('version').notNull().default(1),
    definition: jsonb('definition').notNull(),
    axleCount: smallint('axle_count').notNull(),
    tyreCount: smallint('tyre_count').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [unique().on(table.code, table.version)],
);

export const vehicleClasses = pgTable('vehicle_classes', {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  unitKind: varchar('unit_kind', { length: 7 }).notNull().default('Powered'),
  name: varchar('name', { length: 100 }).notNull(),
  defaultChassisLayoutId: bigint('default_chassis_layout_id', { mode: 'number' }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
});

export const partPositions = pgTable(
  'part_positions',
  {
    id: id(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    chassisLayoutId: bigint('chassis_layout_id', { mode: 'number' }).notNull(),
    code: varchar('code', { length: 40 }).notNull(),
    positionKind: varchar('position_kind', { length: 5 }).notNull().default('Wheel'),
    axleIndex: smallint('axle_index'),
    side: varchar('side', { length: 5 }),
    ordinal: smallint('ordinal').notNull(),
    label: varchar('label', { length: 80 }).notNull(),
  },
  (table) => [unique().on(table.chassisLayoutId, table.code)],
);

// One entry per table of §9 as its migration arrives. The drift test reads this list.
export const allTables: readonly PgTable[] = [
  idempotencyKeys,
  users,
  authSessions,
  passwordResetTokens,
  userRoles,
  rolePermissions,
  auditLogs,
  appSettings,
  storedFiles,
  userTablePreferences,
  chassisLayouts,
  vehicleClasses,
  partPositions,
];
