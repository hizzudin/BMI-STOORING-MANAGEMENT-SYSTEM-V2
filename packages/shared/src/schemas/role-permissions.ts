import { z } from 'zod';
import { ROLES } from '../enums/index.js';
import { MATRIX_ROLES, PERMISSION_CODES } from '../permissions/index.js';

/** REQ-IAM-005: what the Access Manager may do on the matrix (its `allowedActions`). */
export const ROLE_PERMISSIONS_PAGE_ACTIONS = ['edit'] as const;
export type RolePermissionsPageAction = (typeof ROLE_PERMISSIONS_PAGE_ACTIONS)[number];

/** One cell of the matrix (§9.2 role_permissions); `switchable` marks the S cells of 2.2. */
export const RolePermissionCellSchema = z.object({
  role: z.enum(ROLES),
  permissionCode: z.enum(PERMISSION_CODES),
  allowed: z.boolean(),
  isLocked: z.boolean(),
  switchable: z.boolean(),
});
export type RolePermissionCell = z.infer<typeof RolePermissionCellSchema>;

export const RolePermissionsResponseSchema = z.object({
  cells: z.array(RolePermissionCellSchema),
  allowedActions: z.array(z.enum(ROLE_PERMISSIONS_PAGE_ACTIONS)),
});
export type RolePermissionsResponse = z.infer<typeof RolePermissionsResponseSchema>;

const MAX_CHANGES = MATRIX_ROLES.length * PERMISSION_CODES.length;

/** DEC-117: the staged cells, saved together; one change per cell. */
export const RolePermissionsChangeRequestSchema = z.object({
  changes: z
    .array(
      z.object({
        role: z.enum(ROLES),
        permissionCode: z.enum(PERMISSION_CODES),
        allowed: z.boolean(),
      }),
    )
    .min(1, { error: 'Change at least one cell.' })
    .max(MAX_CHANGES)
    .refine(
      (changes) =>
        new Set(changes.map((c) => `${c.role}|${c.permissionCode}`)).size === changes.length,
      { error: 'Each cell may change once.' },
    ),
});
export type RolePermissionsChangeRequest = z.infer<typeof RolePermissionsChangeRequestSchema>;
