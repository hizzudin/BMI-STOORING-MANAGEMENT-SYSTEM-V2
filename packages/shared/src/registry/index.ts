import { z } from 'zod';
import { ROLES } from '../enums/index.js';

/**
 * TASK-203 (specs/design.md 5.26, DEC-148, DEC-149): the shapes of an `assignment_modules` row
 * (§9.6), so the designer, the SPK document and the scope lock read data, never a module name.
 */

/** A free field of the step options or of a creation section. */
export const FieldSchema = z
  .object({
    key: z.string().min(1).max(40),
    label: z.string().min(1).max(100),
    type: z.enum(['text', 'number', 'boolean', 'select']),
    required: z.boolean(),
    options: z.array(z.string().min(1)).optional(),
  })
  .strict();

/** `config_schema`: the settings the designer may give each step. */
export const ConfigSchemaSchema = z.object({ fields: z.array(FieldSchema) }).strict();

/** The lists a creation section may hold, from the 4.3 module contract table. */
export const CREATION_LISTS = [
  'parts_with_quantity',
  'parts',
  'tyre_sizes_with_quantity',
  'parts_to_check',
  'vehicle_document',
] as const;

/** `creation_schema`: what the SPK creator fills for a step; null shows only the step name. */
export const CreationSchemaSchema = z
  .object({
    required: z.boolean(),
    lists: z.array(z.enum(CREATION_LISTS)),
    fields: z.array(FieldSchema),
  })
  .strict();

/** `scope_rules` (BR-02): empty until TASK-306 decides its shape and enforcement (DEC-149). */
export const ScopeRulesSchema = z.object({}).strict();

/** `completion_section`: empty until TASK-212 decides what the SPK document prints (DEC-149). */
export const CompletionSectionSchema = z.object({}).strict();

export const COST_KINDS = ['Parts', 'Labor', 'Document', 'None'] as const;

/** One row of the registry, as a module's migration writes it. */
export const ModuleRowSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Za-z_]{1,39}$/),
  name: z.string().min(1).max(100),
  uiComponent: z.string().min(1).max(80),
  configSchema: ConfigSchemaSchema.nullable(),
  creationSchema: CreationSchemaSchema.nullable(),
  executorRoles: z.array(z.enum(ROLES)).min(1),
  scopeRules: ScopeRulesSchema,
  completionSection: CompletionSectionSchema,
  costKind: z.enum(COST_KINDS),
  tracksWorkTime: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});
export type ModuleRow = z.infer<typeof ModuleRowSchema>;

/** GET /assignment-modules: a row with whether its code exists and whether it is offered. */
export const AssignmentModuleSchema = ModuleRowSchema.omit({
  scopeRules: true,
  completionSection: true,
}).extend({
  /** DEC-148: a module in code exists for this row. */
  implemented: z.boolean(),
  /** REQ-REG-002: active and implemented, so Create SPK may offer it. */
  offered: z.boolean(),
});
export type AssignmentModule = z.infer<typeof AssignmentModuleSchema>;

export const AssignmentModuleListResponseSchema = z.object({
  items: z.array(AssignmentModuleSchema),
});
export type AssignmentModuleListResponse = z.infer<typeof AssignmentModuleListResponseSchema>;

/** REQ-REG-005, DEC-148: deactivate or activate with a reason. */
export const ModuleStatusChangeRequestSchema = z.object({
  reason: z.string().trim().min(1, 'Give a reason.').max(500),
});
export type ModuleStatusChangeRequest = z.infer<typeof ModuleStatusChangeRequestSchema>;
