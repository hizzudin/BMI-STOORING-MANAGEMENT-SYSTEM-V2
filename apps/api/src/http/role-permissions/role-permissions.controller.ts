import {
  RolePermissionsChangeRequestSchema,
  RolePermissionsResponseSchema,
  type RolePermissionsChangeRequest,
  type RolePermissionsResponse,
} from '@bmi/shared';
import { Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import { RolePermissionService } from '../../core/iam/role-permission-service.js';
import {
  actorOf,
  CurrentSession,
  RequireCapability,
  SessionGuard,
  type SignedIn,
} from '../auth/auth-http.js';
import { ApiContract, ValidBody } from '../contract.js';

const Matrix = { name: 'RolePermissionsResponse', schema: RolePermissionsResponseSchema };

/**
 * REQ-IAM-005, DEC-117: Users and roles › Roles and permissions. accounts.manage only, which the
 * System Admin never holds (RL-4, AC-IAM-003). A change shows on the user's next request (NAV-9).
 */
@Controller('role-permissions')
@UseGuards(SessionGuard)
@RequireCapability('accounts.manage')
export class RolePermissionsController {
  constructor(@Inject(RolePermissionService) private readonly matrix: RolePermissionService) {}

  @Get()
  @ApiContract({
    operationId: 'getRolePermissions',
    summary: 'The permission matrix: every role x every code, with its locks',
    response: Matrix,
  })
  get(@CurrentSession() session: SignedIn): Promise<RolePermissionsResponse> {
    return this.matrix.matrix(actorOf(session));
  }

  @Patch()
  @ApiContract({
    operationId: 'changeRolePermissions',
    summary: 'Saves the staged cells together, with one audit record (DEC-117)',
    body: { name: 'RolePermissionsChangeRequest', schema: RolePermissionsChangeRequestSchema },
    response: Matrix,
  })
  change(
    @CurrentSession() session: SignedIn,
    @ValidBody() body: RolePermissionsChangeRequest,
  ): Promise<RolePermissionsResponse> {
    return this.matrix.change(actorOf(session), body);
  }
}
