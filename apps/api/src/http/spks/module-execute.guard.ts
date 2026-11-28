import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { MODULE_CATALOG } from '../../app.tokens.js';
import { NOT_ALLOWED } from '../../core/iam/actions.js';
import type { ModuleCatalog } from '../../ports/registry.js';
import type { AuthenticatedRequest } from '../auth/auth-http.js';

/**
 * L1 of the step routes (DEC-149): the actor holds at least one execute capability that a
 * registered module declares, so a new module changes no route. Runs after SessionGuard.
 */
@Injectable()
export class ModuleExecuteGuard implements CanActivate {
  constructor(@Inject(MODULE_CATALOG) private readonly catalog: ModuleCatalog) {}

  canActivate(context: ExecutionContext): boolean {
    const auth = context.switchToHttp().getRequest<AuthenticatedRequest>().auth;
    if (!auth) throw new Error('ModuleExecuteGuard needs SessionGuard before it');
    if (!this.catalog.executeCapabilities().some((code) => auth.capabilities.has(code))) {
      throw new ForbiddenException(NOT_ALLOWED);
    }
    return true;
  }
}
