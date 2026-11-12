import { z } from "zod";

export const SPK_ACTIONS = ["edit", "submit"] as const;
export type SpkAction = (typeof SPK_ACTIONS)[number];

export const SPKS_PAGE_ACTIONS = ["create"] as const;
export type SpksPageAction = (typeof SPKS_PAGE_ACTIONS)[number];

export const SPK_LIST_TABS = ["active", "mine", "draft", "pending", "rejected", "completed", "cancelled", "all"] as const;
export type SpkListTab = (typeof SPK_LIST_TABS)[number];

export const SPK_DETAIL_TABS = ["steps", "parts", "cost", "history", "cr"] as const;
export type SpkDetailTab = (typeof SPK_DETAIL_TABS)[number];

export const SPK_LIST_ACTIONS = ["open", "view", "edit"] as const;
export type SpkListAction = (typeof SPK_LIST_ACTIONS)[number];

export const SPK_DETAIL_ACTIONS = ["document", "change_request", "cancel", "reverse_issue", "assign", "reassign", "correct_time"] as const;
export type SpkDetailAction = (typeof SPK_DETAIL_ACTIONS)[number];

export const SpkSchema = z.object({
  id: z.number().int(),
  spkNumber: z.string(),
  vehicle: z.object({ id: z.number().int(), licensePlate: z.string(), className: z.string() }),
  title: z.string(),
  category: z.enum(["PM", "Corrective", "Tyre", "Document", "Other"]),
  priority: z.enum(["Low", "Normal", "High", "Urgent"]),
  requiresDowntime: z.boolean(),
  description: z.string(),
  requestSource: z.enum(["System_PM", "Tyre_Alert", "Part_Item_Alert", "Document_Alert", "Breakdown_Report", "Part_Check", "Manual_Planner", "Manual_Admin"]),
  status: z.enum(["Draft", "Pending_Approval", "Rejected", "Active", "In_Progress", "Pending_Verification", "Pending_Amendment", "Completed", "Cancelled"]),
  stepCount: z.number().int(),
  version: z.number().int(),
  allowedActions: z.array(z.string()),
});
export type Spk = z.infer<typeof SpkSchema>;

export const SpkResponseSchema = z.object({ spk: SpkSchema });
export type SpkResponse = z.infer<typeof SpkResponseSchema>;

export const SpkFormOptionsResponseSchema = z.object({
  vehicles: z.array(
    z.object({
      id: z.number().int(),
      licensePlate: z.string(),
      className: z.string(),
      status: z.enum(["Active", "Repair", "Blocked", "OFF", "Inactive"]),
    }),
  ),
  allowedActions: z.array(z.enum(["create"])),
});
export type SpkFormOptionsResponse = z.infer<typeof SpkFormOptionsResponseSchema>;

export const SpkListItemSchema = z.object({
  id: z.number().int(),
  spkNumber: z.string(),
  vehicle: z.object({ id: z.number().int(), licensePlate: z.string(), className: z.string() }),
  category: z.enum(["PM", "Corrective", "Tyre", "Document", "Other"]),
  priority: z.enum(["Low", "Normal", "High", "Urgent"]),
  status: z.enum(["Draft", "Pending_Approval", "Rejected", "Active", "In_Progress", "Pending_Verification", "Pending_Amendment", "Completed", "Cancelled"]),
  currentStep: z.string().nullable(),
  waitingOn: z.string().nullable(),
  allowedActions: z.array(z.enum(["open", "view", "edit"])),
  isMine: z.boolean(),
});
export type SpkListItem = z.infer<typeof SpkListItemSchema>;

export const SpkTabCountsSchema = z.object({
  active: z.number().int(),
  mine: z.number().int(),
  draft: z.number().int(),
  pending: z.number().int(),
  rejected: z.number().int(),
  completed: z.number().int(),
  cancelled: z.number().int(),
  all: z.number().int(),
});
export type SpkTabCounts = z.infer<typeof SpkTabCountsSchema>;

export const SpkListResultSchema = z.object({
  items: z.array(z.object({
    id: z.number().int(),
    spkNumber: z.string(),
    vehicle: z.object({ id: z.number().int(), licensePlate: z.string(), className: z.string() }),
    category: z.enum(["PM", "Corrective", "Tyre", "Document", "Other"]),
    priority: z.enum(["Low", "Normal", "High", "Urgent"]),
    status: z.enum(["Draft", "Pending_Approval", "Rejected", "Active", "In_Progress", "Pending_Verification", "Pending_Amendment", "Completed", "Cancelled"]),
    currentStep: z.string().nullable(),
    waitingOn: z.string().nullable(),
    allowedActions: z.array(z.enum(["open", "view", "edit"])),
    isMine: z.boolean(),
  })),
  tabCounts: z.object({
    active: z.number().int(),
    mine: z.number().int(),
    draft: z.number().int(),
    pending: z.number().int(),
    rejected: z.number().int(),
    completed: z.number().int(),
    cancelled: z.number().int(),
    all: z.number().int(),
  }),
  allowedActions: z.array(z.string()),
});
export type SpkListResult = z.infer<typeof SpkListResultSchema>;

export const SpkListResponseSchema = z.object({
  spkList: SpkListResultSchema,
});
export type SpkListResponse = z.infer<typeof SpkListResponseSchema>;

export const SpkAssignmentSchema = z.object({
  id: z.number().int(),
  sequenceNo: z.number().int(),
  module: z.string(),
  moduleName: z.string(),
  moduleIcon: z.string(),
  status: z.enum(["Locked", "Open", "In_Progress", "Submitted", "Verified", "Skipped"]),
  executorRoles: z.array(z.enum(["Planner", "Mechanic", "Warehouse_Manager", "Supervisor", "GM", "System_Admin", "Access_Manager", "Driver", "Field_Coordinator", "Accounting"])),
  verifierRole: z.enum(["Planner", "Mechanic", "Warehouse_Manager", "Supervisor", "GM", "System_Admin", "Access_Manager", "Driver", "Field_Coordinator", "Accounting"]),
  assignedTo: z.object({ id: z.number().int(), name: z.string() }).nullable(),
  executedBy: z.object({ id: z.number().int(), name: z.string() }).nullable(),
  verifiedBy: z.object({ id: z.number().int(), name: z.string() }).nullable(),
  openedAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  submittedAt: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  returnNote: z.string().nullable(),
  skipReason: z.string().nullable(),
  isOptional: z.boolean(),
  allowedActions: z.array(z.enum(["start", "verify", "return", "assign", "reassign", "correct_time", "open", "view"])),
  stooringFee: z.number().optional(),
  assignedToName: z.string().nullable(),
});
export type SpkAssignment = z.infer<typeof SpkAssignmentSchema>;

export const SpkApprovalSchema = z.object({
  id: z.number().int(),
  stage: z.enum(["Creation", "Completion", "Amendment"]),
  action: z.enum(["Submit", "Approve", "Reject", "Cancel", "Request_Completion"]),
  actedBy: z.object({ id: z.number().int(), name: z.string(), role: z.enum(["Planner", "Mechanic", "Warehouse_Manager", "Supervisor", "GM", "System_Admin", "Access_Manager", "Driver", "Field_Coordinator", "Accounting"]) }),
  actedAt: z.string(),
  note: z.string().nullable(),
  selfApproved: z.boolean(),
});
export type SpkApproval = z.infer<typeof SpkApprovalSchema>;

export const SpkCostBreakdownSchema = z.object({
  parts: z.number(),
  services: z.number(),
  documents: z.number(),
  stooring: z.number(),
  offUnit: z.number(),
  total: z.number(),
});
export type SpkCostBreakdown = z.infer<typeof SpkCostBreakdownSchema>;

export const SpkHistoryEntrySchema = z.object({
  when: z.string(),
  who: z.object({ id: z.number().int(), name: z.string(), role: z.enum(["Planner", "Mechanic", "Warehouse_Manager", "Supervisor", "GM", "System_Admin", "Access_Manager", "Driver", "Field_Coordinator", "Accounting"]) }),
  what: z.string(),
});
export type SpkHistoryEntry = z.infer<typeof SpkHistoryEntrySchema>;

export const SpkChangeRequestSummarySchema = z.object({
  id: z.number().int(),
  crNumber: z.string(),
  raisedBy: z.object({ id: z.number().int(), name: z.string() }),
  reason: z.string(),
  status: z.string(),
  raisedAt: z.string(),
});
export type SpkChangeRequestSummary = z.infer<typeof SpkChangeRequestSummarySchema>;

export const SpkPartLineSchema = z.object({
  partName: z.string(),
  source: z.string(),
  plannedQty: z.number(),
  usedQty: z.number().nullable(),
  unitPrice: z.number(),
  total: z.number(),
  step: z.string(),
});
export type SpkPartLine = z.infer<typeof SpkPartLineSchema>;

export const SpkServiceLineSchema = z.object({
  service: z.string(),
  code: z.string(),
  team: z.enum(["Internal", "External"]),
  price: z.number(),
  step: z.string(),
});
export type SpkServiceLine = z.infer<typeof SpkServiceLineSchema>;

export const SpkDetailSchema = z.object({
  id: z.number().int(),
  spkNumber: z.string(),
  vehicle: z.object({
    id: z.number().int(),
    licensePlate: z.string(),
    className: z.string(),
    currentOdometer: z.number().nullable(),
  }),
  title: z.string(),
  category: z.enum(["PM", "Corrective", "Tyre", "Document", "Other"]),
  priority: z.enum(["Low", "Normal", "High", "Urgent"]),
  requiresDowntime: z.boolean(),
  description: z.string(),
  requestSource: z.enum(["System_PM", "Tyre_Alert", "Part_Item_Alert", "Document_Alert", "Breakdown_Report", "Part_Check", "Manual_Planner", "Manual_Admin"]),
  status: z.enum(["Draft", "Pending_Approval", "Rejected", "Active", "In_Progress", "Pending_Verification", "Pending_Amendment", "Completed", "Cancelled"]),
  stepCount: z.number().int(),
  version: z.number().int(),
  findingNote: z.string().nullable(),
  approvedBy: z.object({ id: z.number().int(), name: z.string() }).nullable(),
  approvedAt: z.string().nullable(),
  activatedAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  completionRequestedAt: z.string().nullable(),
  completionApprovedBy: z.object({ id: z.number().int(), name: z.string() }).nullable(),
  completedAt: z.string().nullable(),
  cancelledBy: z.object({ id: z.number().int(), name: z.string() }).nullable(),
  cancelReason: z.string().nullable(),
  laborCost: z.number(),
  partsCost: z.number(),
  documentCost: z.number(),
  stooringCost: z.number(),
  offDays: z.number().int(),
  createdByName: z.string().nullable(),
  approvedByName: z.string().nullable(),
  plannedDay: z.string().nullable(),
  assignments: z.array(z.object({
    id: z.number().int(),
    sequenceNo: z.number().int(),
    module: z.string(),
    moduleName: z.string(),
    moduleIcon: z.string(),
    status: z.enum(["Locked", "Open", "In_Progress", "Submitted", "Verified", "Skipped"]),
    executorRoles: z.array(z.enum(["Planner", "Mechanic", "Warehouse_Manager", "Supervisor", "GM", "System_Admin", "Access_Manager", "Driver", "Field_Coordinator", "Accounting"])),
    verifierRole: z.enum(["Planner", "Mechanic", "Warehouse_Manager", "Supervisor", "GM", "System_Admin", "Access_Manager", "Driver", "Field_Coordinator", "Accounting"]),
    assignedTo: z.object({ id: z.number().int(), name: z.string() }).nullable(),
    executedBy: z.object({ id: z.number().int(), name: z.string() }).nullable(),
    verifiedBy: z.object({ id: z.number().int(), name: z.string() }).nullable(),
    openedAt: z.string().nullable(),
    startedAt: z.string().nullable(),
    submittedAt: z.string().nullable(),
    verifiedAt: z.string().nullable(),
    returnNote: z.string().nullable(),
    skipReason: z.string().nullable(),
    isOptional: z.boolean(),
    allowedActions: z.array(z.enum(["start", "verify", "return", "assign", "reassign", "correct_time", "open", "view"])),
    stooringFee: z.number().optional(),
    assignedToName: z.string().nullable(),
  })),
  approvals: z.array(z.object({
    id: z.number().int(),
    stage: z.enum(["Creation", "Completion", "Amendment"]),
    action: z.enum(["Submit", "Approve", "Reject", "Cancel", "Request_Completion"]),
    actedBy: z.object({ id: z.number().int(), name: z.string(), role: z.enum(["Planner", "Mechanic", "Warehouse_Manager", "Supervisor", "GM", "System_Admin", "Access_Manager", "Driver", "Field_Coordinator", "Accounting"]) }),
    actedAt: z.string(),
    note: z.string().nullable(),
    selfApproved: z.boolean(),
  })),
  costBreakdown: z.object({
    parts: z.number(),
    services: z.number(),
    documents: z.number(),
    stooring: z.number(),
    offUnit: z.number(),
    total: z.number(),
  }),
  history: z.array(z.object({
    when: z.string(),
    who: z.object({ id: z.number().int(), name: z.string(), role: z.enum(["Planner", "Mechanic", "Warehouse_Manager", "Supervisor", "GM", "System_Admin", "Access_Manager", "Driver", "Field_Coordinator", "Accounting"]) }),
    what: z.string(),
  })),
  changeRequests: z.array(z.object({
    id: z.number().int(),
    crNumber: z.string(),
    raisedBy: z.object({ id: z.number().int(), name: z.string() }),
    reason: z.string(),
    status: z.string(),
    raisedAt: z.string(),
  })),
  partLines: z.array(z.object({
    partName: z.string(),
    source: z.string(),
    plannedQty: z.number(),
    usedQty: z.number().nullable(),
    unitPrice: z.number(),
    total: z.number(),
    step: z.string(),
  })),
  serviceLines: z.array(z.object({
    service: z.string(),
    code: z.string(),
    team: z.enum(["Internal", "External"]),
    price: z.number(),
    step: z.string(),
  })),
  allowedActions: z.array(z.enum(["document", "change_request", "cancel", "reverse_issue", "assign", "reassign", "correct_time"])),
});
export type SpkDetail = z.infer<typeof SpkDetailSchema>;

export const SpkDetailResponseSchema = z.object({ spk: SpkDetailSchema });
export type SpkDetailResponse = z.infer<typeof SpkDetailResponseSchema>;

const fields = {
  vehicleId: z.number({ error: "Choose a vehicle." }).int({ error: "Choose a vehicle." }),
  title: z
    .string()
    .trim()
    .min(1, { error: "Enter a title." })
    .max(150, { error: "A title has at most 150 characters." }),
  category: z.enum(["PM", "Corrective", "Tyre", "Document", "Other"], { error: "Choose a category." }),
  priority: z.enum(["Low", "Normal", "High", "Urgent"], { error: "Choose an urgency." }),
  requiresDowntime: z.boolean(),
  description: z.string().trim().min(1, { error: "Enter a description." }),
};

export const SpkRequestSchema = z.object(fields);
export type SpkRequest = z.infer<typeof SpkRequestSchema>;

export const SpkUpdateRequestSchema = z.object({ ...fields, version: z.number().int() });
export type SpkUpdateRequest = z.infer<typeof SpkUpdateRequestSchema>;

export const SpkSubmitRequestSchema = z.object({ version: z.number().int() });
export type SpkSubmitRequest = z.infer<typeof SpkSubmitRequestSchema>;