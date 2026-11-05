// Every enum of PRD section 9.1, once. enums.test.ts compares them with docs/prd/data-model.md.

export const ROLES = [
  'Planner',
  'Mechanic',
  'Warehouse_Manager',
  'Supervisor',
  'GM',
  'System_Admin',
  'Access_Manager',
  'Driver',
  'Field_Coordinator',
  'Accounting',
] as const;
export type Role = (typeof ROLES)[number];

export const VEHICLE_STATUSES = ['Active', 'Repair', 'Blocked', 'OFF', 'Inactive'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const DOC_STATUSES = ['Valid', 'Warning', 'Expired', 'Missing'] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const ODO_SOURCES = ['Admin', 'Driver', 'Mechanic', 'GPS'] as const;
export type OdoSource = (typeof ODO_SOURCES)[number];

export const TRIGGERS = ['Mileage', 'Time'] as const;
export type Trigger = (typeof TRIGGERS)[number];

export const ALERT_TYPES = ['PM', 'Part_Item', 'Tyre', 'Document'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_STATUSES = ['Pending', 'Converted_To_SPK', 'Dismissed'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const SPK_STATUSES = [
  'Draft',
  'Pending_Approval',
  'Rejected',
  'Active',
  'In_Progress',
  'Pending_Verification',
  'Pending_Amendment',
  'Completed',
  'Cancelled',
] as const;
export type SpkStatus = (typeof SPK_STATUSES)[number];

export const SPK_SOURCES = [
  'System_PM',
  'Tyre_Alert',
  'Document_Alert',
  'Breakdown_Report',
  'Part_Check',
  'Manual_Planner',
  'Manual_Admin',
] as const;
export type SpkSource = (typeof SPK_SOURCES)[number];

export const REPORT_KINDS = ['Breakdown', 'Inspection_Fail'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_STATUSES = ['New', 'Converted', 'Rejected'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const SPK_CATEGORIES = ['PM', 'Corrective', 'Tyre', 'Document', 'Other'] as const;
export type SpkCategory = (typeof SPK_CATEGORIES)[number];

export const ASG_STATUSES = [
  'Locked',
  'Open',
  'In_Progress',
  'Submitted',
  'Verified',
  'Skipped',
] as const;
export type AsgStatus = (typeof ASG_STATUSES)[number];

export const APPROVAL_STAGES = ['Creation', 'Completion', 'Amendment'] as const;
export type ApprovalStage = (typeof APPROVAL_STAGES)[number];

export const APPROVAL_ACTIONS = [
  'Submit',
  'Approve',
  'Reject',
  'Cancel',
  'Request_Completion',
] as const;
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

export const CR_STATUSES = [
  'Submitted',
  'In_Revision',
  'Pending_Approval',
  'Approved',
  'Rejected',
] as const;
export type CrStatus = (typeof CR_STATUSES)[number];

export const PART_SOURCES = ['Warehouse'] as const;
export type PartSource = (typeof PART_SOURCES)[number];

export const INVOICE_STATUSES = ['Draft', 'Issued', 'Paid', 'Void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const LOCATION_CAPTURES = ['Captured', 'Denied', 'Unavailable'] as const;
export type LocationCapture = (typeof LOCATION_CAPTURES)[number];

export const TEAMS = ['Internal', 'External'] as const;
export type Team = (typeof TEAMS)[number];

export const ATTACHMENT_TYPES = [
  'Invoice',
  'Repair_Photo',
  'Document_Scan',
  'Receipt',
  'DVIR_Photo',
  'Check_Photo',
] as const;
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

export const TYRE_TYPES = ['Tube', 'Tubeless'] as const;
export type TyreType = (typeof TYRE_TYPES)[number];

export const PLACEMENT_ACTS = ['Baseline', 'Mount', 'Rotate', 'Demount', 'Scrap'] as const;
export type PlacementAct = (typeof PLACEMENT_ACTS)[number];

export const STOCK_TX_TYPES = ['OB', 'GR', 'GRC', 'GI', 'GIR', 'SA'] as const;
export type StockTxType = (typeof STOCK_TX_TYPES)[number];

export const REASONS = ['Damaged', 'Entry_Error', 'Lost', 'Found'] as const;
export type Reason = (typeof REASONS)[number];

export const AI_PROVIDERS = ['OpenAI', 'Anthropic'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** The enums by their PostgreSQL type name, for migrations and the drift test. */
export const SQL_ENUMS = {
  role_t: ROLES,
  vehicle_status_t: VEHICLE_STATUSES,
  doc_status_t: DOC_STATUSES,
  odo_source_t: ODO_SOURCES,
  trigger_t: TRIGGERS,
  alert_type_t: ALERT_TYPES,
  alert_status_t: ALERT_STATUSES,
  spk_status_t: SPK_STATUSES,
  spk_source_t: SPK_SOURCES,
  report_kind_t: REPORT_KINDS,
  report_status_t: REPORT_STATUSES,
  spk_category_t: SPK_CATEGORIES,
  asg_status_t: ASG_STATUSES,
  approval_stage_t: APPROVAL_STAGES,
  approval_action_t: APPROVAL_ACTIONS,
  cr_status_t: CR_STATUSES,
  part_source_t: PART_SOURCES,
  invoice_status_t: INVOICE_STATUSES,
  location_capture_t: LOCATION_CAPTURES,
  team_t: TEAMS,
  attachment_t: ATTACHMENT_TYPES,
  tyre_type_t: TYRE_TYPES,
  placement_act_t: PLACEMENT_ACTS,
  stock_tx_t: STOCK_TX_TYPES,
  reason_t: REASONS,
  ai_provider_t: AI_PROVIDERS,
} as const;
