import {
  APPROVAL_ACTIONS,
  APPROVAL_STAGES,
  ASG_STATUSES,
  ATTACHMENT_TYPES,
  LOCATION_CAPTURES,
  PART_SOURCES,
  ROLES,
  SPK_CATEGORIES,
  SPK_SOURCES,
  SPK_STATUSES,
  TEAMS,
  VEHICLE_STATUSES,
} from '@bmi/shared';
import {
  bigint,
  boolean,
  char,
  date,
  integer,
  jsonb,
  numeric,
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

// §9.4 document types (DEC-121); preset_id comes with the SPK presets in TASK-208.
export const documentTypes = pgTable('document_types', {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  usualValidityMonths: smallint('usual_validity_months'),
  warningDays: smallint('warning_days').notNull().default(30),
  receiptRequired: boolean('receipt_required').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
});

export const documentTypeClasses = pgTable(
  'document_type_classes',
  {
    documentTypeId: bigint('document_type_id', { mode: 'number' }).notNull(),
    vehicleClassId: bigint('vehicle_class_id', { mode: 'number' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.documentTypeId, table.vehicleClassId] })],
);

// §9.3 vehicles (DEC-122): customer_id gets its reference with the customers in TASK-701.
export const vehicleStatusEnum = pgEnum('vehicle_status_t', VEHICLE_STATUSES);

export const vehicles = pgTable('vehicles', {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: timestamp('deleted_at'),
  licensePlate: varchar('license_plate', { length: 20 }).notNull(),
  vin: varchar('vin', { length: 30 }),
  engineNumber: varchar('engine_number', { length: 30 }),
  vehicleClassId: bigint('vehicle_class_id', { mode: 'number' }).notNull(),
  chassisLayoutId: bigint('chassis_layout_id', { mode: 'number' }).notNull(),
  brand: varchar('brand', { length: 50 }),
  model: varchar('model', { length: 50 }),
  year: smallint('year'),
  fuelType: varchar('fuel_type', { length: 20 }),
  customerId: bigint('customer_id', { mode: 'number' }),
  currentOdometer: integer('current_odometer').notNull().default(0),
  status: vehicleStatusEnum('status').notNull().default('Active'),
  deactivatedAt: timestamp('deactivated_at'),
  deactivateReason: text('deactivate_reason'),
  version: integer('version').notNull().default(1),
});

// §9.6, §9.7 SPKs (DEC-124): references to tables of later tasks are plain columns until then.
export const spkStatusEnum = pgEnum('spk_status_t', SPK_STATUSES);
export const spkSourceEnum = pgEnum('spk_source_t', SPK_SOURCES);
export const spkCategoryEnum = pgEnum('spk_category_t', SPK_CATEGORIES);
export const asgStatusEnum = pgEnum('asg_status_t', ASG_STATUSES);
export const teamEnum = pgEnum('team_t', TEAMS);
export const locationCaptureEnum = pgEnum('location_capture_t', LOCATION_CAPTURES);
export const approvalStageEnum = pgEnum('approval_stage_t', APPROVAL_STAGES);
export const approvalActionEnum = pgEnum('approval_action_t', APPROVAL_ACTIONS);
export const partSourceEnum = pgEnum('part_source_t', PART_SOURCES);
export const attachmentEnum = pgEnum('attachment_t', ATTACHMENT_TYPES);

const money = (name: string) => numeric(name, { precision: 14, scale: 2 }).notNull().default('0');

export const assignmentModules = pgTable('assignment_modules', {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  code: varchar('code', { length: 40 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  uiComponent: varchar('ui_component', { length: 80 }).notNull(),
  configSchema: jsonb('config_schema'),
  creationSchema: jsonb('creation_schema'),
  executorRoles: roleEnum('executor_roles').array().notNull(),
  scopeRules: jsonb('scope_rules').notNull(),
  completionSection: jsonb('completion_section').notNull(),
  costKind: varchar('cost_kind', { length: 10 }).notNull(),
  tracksWorkTime: boolean('tracks_work_time').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const spks = pgTable('spks', {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: timestamp('deleted_at'),
  spkNumber: varchar('spk_number', { length: 30 }).notNull(),
  vehicleId: bigint('vehicle_id', { mode: 'number' }).notNull(),
  title: varchar('title', { length: 150 }).notNull(),
  category: spkCategoryEnum('category').notNull(),
  requiresDowntime: boolean('requires_downtime').notNull().default(true),
  presetId: bigint('preset_id', { mode: 'number' }),
  requestSource: spkSourceEnum('request_source').notNull(),
  alertId: bigint('alert_id', { mode: 'number' }),
  breakdownReportId: bigint('breakdown_report_id', { mode: 'number' }),
  vehicleDocumentId: bigint('vehicle_document_id', { mode: 'number' }),
  sourceAssignmentId: bigint('source_assignment_id', { mode: 'number' }),
  priority: varchar('priority', { length: 10 }).notNull().default('Normal'),
  description: text('description').notNull(),
  findingNote: text('finding_note'),
  status: spkStatusEnum('status').notNull().default('Draft'),
  statusBeforeAmendment: spkStatusEnum('status_before_amendment'),
  amendmentNo: integer('amendment_no').notNull().default(0),
  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  approvedBy: bigint('approved_by', { mode: 'number' }),
  approvedAt: timestamp('approved_at'),
  activatedAt: timestamp('activated_at'),
  startedAt: timestamp('started_at'),
  completionRequestedAt: timestamp('completion_requested_at'),
  completionApprovedBy: bigint('completion_approved_by', { mode: 'number' }),
  completedAt: timestamp('completed_at'),
  cancelledBy: bigint('cancelled_by', { mode: 'number' }),
  cancelReason: text('cancel_reason'),
  laborCost: money('labor_cost'),
  partsCost: money('parts_cost'),
  documentCost: money('document_cost'),
  stooringCost: money('stooring_cost'),
  offDays: integer('off_days').notNull().default(0),
  offLastCountedDate: date('off_last_counted_date'),
  version: integer('version').notNull().default(1),
});

export const spkAssignments = pgTable(
  'spk_assignments',
  {
    id: id(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    spkId: bigint('spk_id', { mode: 'number' }).notNull(),
    sequenceNo: integer('sequence_no').notNull(),
    module: varchar('module', { length: 40 }).notNull(),
    stepConfig: jsonb('step_config').notNull().default({}),
    isOptional: boolean('is_optional').notNull().default(false),
    executorRoles: roleEnum('executor_roles').array().notNull(),
    verifierRole: roleEnum('verifier_role').notNull(),
    status: asgStatusEnum('status').notNull().default('Locked'),
    team: teamEnum('team'),
    locationLat: numeric('location_lat', { precision: 9, scale: 6 }),
    locationLng: numeric('location_lng', { precision: 9, scale: 6 }),
    locationAccuracyM: integer('location_accuracy_m'),
    locationCapturedAt: timestamp('location_captured_at'),
    locationCapture: locationCaptureEnum('location_capture'),
    stooringRateId: bigint('stooring_rate_id', { mode: 'number' }),
    stooringFee: money('stooring_fee'),
    assignedTo: bigint('assigned_to', { mode: 'number' }),
    claimedAt: timestamp('claimed_at'),
    openedAt: timestamp('opened_at'),
    executedBy: bigint('executed_by', { mode: 'number' }),
    startedAt: timestamp('started_at'),
    startEntered: boolean('start_entered').notNull().default(false),
    attemptNo: smallint('attempt_no').notNull().default(1),
    workedSeconds: integer('worked_seconds'),
    pausedSeconds: integer('paused_seconds'),
    submittedAt: timestamp('submitted_at'),
    verifiedBy: bigint('verified_by', { mode: 'number' }),
    verifiedAt: timestamp('verified_at'),
    selfVerified: boolean('self_verified').notNull().default(false),
    returnNote: text('return_note'),
    skipReason: text('skip_reason'),
  },
  (table) => [unique().on(table.spkId, table.sequenceNo)],
);

export const spkApprovals = pgTable('spk_approvals', {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  spkId: bigint('spk_id', { mode: 'number' }).notNull(),
  changeRequestId: bigint('change_request_id', { mode: 'number' }),
  stage: approvalStageEnum('stage').notNull(),
  action: approvalActionEnum('action').notNull(),
  actedBy: bigint('acted_by', { mode: 'number' }).notNull(),
  approverRole: roleEnum('approver_role').notNull(),
  actedAt: timestamp('acted_at').notNull().defaultNow(),
  note: text('note'),
  selfApproved: boolean('self_approved').notNull().default(false),
});

export const spkParts = pgTable('spk_parts', {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  spkId: bigint('spk_id', { mode: 'number' }).notNull(),
  assignmentId: bigint('assignment_id', { mode: 'number' }),
  sku: varchar('sku', { length: 40 }),
  tyreSize: varchar('tyre_size', { length: 30 }),
  tyreId: bigint('tyre_id', { mode: 'number' }),
  partName: varchar('part_name', { length: 150 }).notNull(),
  forStep: varchar('for_step', { length: 13 }).notNull().default('Stock'),
  plannedQty: integer('planned_qty').notNull().default(0),
  qty: integer('qty').notNull().default(0),
  unitPrice: numeric('unit_price', { precision: 14, scale: 4 }).notNull().default('0'),
  source: partSourceEnum('source'),
  goodsIssueItemId: bigint('goods_issue_item_id', { mode: 'number' }),
  reversesLineId: bigint('reverses_line_id', { mode: 'number' }),
});

export const spkAttachments = pgTable('spk_attachments', {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  spkId: bigint('spk_id', { mode: 'number' }).notNull(),
  assignmentId: bigint('assignment_id', { mode: 'number' }).notNull(),
  spkPartId: bigint('spk_part_id', { mode: 'number' }),
  spkServiceId: bigint('spk_service_id', { mode: 'number' }),
  checkItemId: bigint('check_item_id', { mode: 'number' }),
  attachmentType: attachmentEnum('attachment_type').notNull(),
  label: varchar('label', { length: 10 }),
  fileUrl: varchar('file_url', { length: 500 }).notNull(),
  fileName: varchar('file_name', { length: 255 }),
  mimeType: varchar('mime_type', { length: 100 }),
  sizeBytes: integer('size_bytes'),
  uploadedBy: bigint('uploaded_by', { mode: 'number' }).notNull(),
});

// §9.12 in-app notifications (DEC-125); device_id gets its reference with push_devices.
export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    kind: varchar('kind', { length: 20 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body'),
    linkRecord: varchar('link_record', { length: 60 }),
    dedupeKey: varchar('dedupe_key', { length: 120 }),
    readAt: timestamp('read_at'),
  },
  (table) => [unique().on(table.userId, table.dedupeKey)],
);

export const notificationDeliveries = pgTable('notification_deliveries', {
  id: id(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  notificationId: bigint('notification_id', { mode: 'number' }).notNull(),
  channel: varchar('channel', { length: 10 }).notNull(),
  deviceId: bigint('device_id', { mode: 'number' }),
  status: varchar('status', { length: 10 }).notNull().default('Pending'),
  sentAt: timestamp('sent_at'),
});

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
  documentTypes,
  documentTypeClasses,
  vehicles,
  assignmentModules,
  spks,
  spkAssignments,
  spkApprovals,
  spkParts,
  spkAttachments,
  notifications,
  notificationDeliveries,
];
