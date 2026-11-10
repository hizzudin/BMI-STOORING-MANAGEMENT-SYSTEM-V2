import {
  AccountListResponseSchema,
  AccountRequestSchema,
  AccountResponseSchema,
  AccountUpdateRequestSchema,
  AccountWithPasswordSchema,
  MoveSystemAdminRequestSchema,
  type AccountListResponse,
  type AccountRequest,
  type AccountResponse,
  type AccountUpdateRequest,
  type AccountWithPassword,
  type MoveSystemAdminRequest,
} from '@bmi/shared';
import {
  Catch,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  AccountConflictError,
  AccountNotFoundError,
  AccountService,
} from '../../core/iam/account-service.js';
import {
  actorOf,
  CurrentSession,
  RequireCapability,
  SessionGuard,
  type SignedIn,
} from '../auth/auth-http.js';
import { ApiContract, ValidBody } from '../contract.js';

const List = { name: 'AccountListResponse', schema: AccountListResponseSchema };
const One = { name: 'AccountResponse', schema: AccountResponseSchema };
const WithPassword = { name: 'AccountWithPassword', schema: AccountWithPasswordSchema };
const Request = { name: 'AccountRequest', schema: AccountRequestSchema };

/**
 * REQ-IAM-002 to REQ-IAM-004, REQ-IAM-009, DEC-28: Users and roles, the Access Manager's own area.
 * Every route needs accounts.manage, which the System Admin never holds (RL-4, AC-IAM-003).
 */
@Controller('accounts')
@UseGuards(SessionGuard)
@RequireCapability('accounts.manage')
export class AccountsController {
  constructor(@Inject(AccountService) private readonly accounts: AccountService) {}

  @Get()
  @ApiContract({
    operationId: 'listAccounts',
    summary: 'Users and roles: Accounts',
    response: List,
  })
  list(@CurrentSession() session: SignedIn): Promise<AccountListResponse> {
    return this.accounts.list(actorOf(session));
  }

  @Post()
  @ApiContract({
    operationId: 'createAccount',
    summary: 'New account with one role and a one-time temporary password (FLW-AM-01)',
    body: Request,
    response: WithPassword,
  })
  create(
    @CurrentSession() session: SignedIn,
    @ValidBody() body: AccountRequest,
  ): Promise<AccountWithPassword> {
    return this.accounts.create(actorOf(session), body);
  }

  @Patch(':id')
  @ApiContract({
    operationId: 'updateAccount',
    summary: 'Edit the name, email and the one role of an account',
    body: { name: 'AccountUpdateRequest', schema: AccountUpdateRequestSchema },
    response: One,
  })
  async update(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
    @ValidBody() body: AccountUpdateRequest,
  ): Promise<AccountResponse> {
    return { account: await this.accounts.update(actorOf(session), id, body) };
  }

  @Post(':id/unlock')
  @HttpCode(200)
  @ApiContract({
    operationId: 'unlockAccount',
    summary: 'Unlock after 5 failed sign-ins',
    response: One,
  })
  async unlock(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AccountResponse> {
    return { account: await this.accounts.unlock(actorOf(session), id) };
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @ApiContract({
    operationId: 'deactivateAccount',
    summary: 'Deactivate an account and end its sessions (FLW-AM-04)',
    response: One,
  })
  async deactivate(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AccountResponse> {
    return { account: await this.accounts.deactivate(actorOf(session), id) };
  }

  @Post(':id/activate')
  @HttpCode(200)
  @ApiContract({
    operationId: 'activateAccount',
    summary: 'Activate a deactivated account',
    response: One,
  })
  async activate(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AccountResponse> {
    return { account: await this.accounts.activate(actorOf(session), id) };
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @ApiContract({
    operationId: 'resetAccountPassword',
    summary: 'A new one-time temporary password, changed at the next sign-in (REQ-IAM-009)',
    response: WithPassword,
  })
  resetPassword(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AccountWithPassword> {
    return this.accounts.resetPassword(actorOf(session), id);
  }

  @Post('move-system-admin')
  @HttpCode(200)
  @ApiContract({
    operationId: 'moveSystemAdmin',
    summary: 'Move the System Admin role to another active account, with a reason (FLW-AM-03)',
    body: { name: 'MoveSystemAdminRequest', schema: MoveSystemAdminRequestSchema },
    response: List,
  })
  async moveSystemAdmin(
    @CurrentSession() session: SignedIn,
    @ValidBody() body: MoveSystemAdminRequest,
  ): Promise<AccountListResponse> {
    const actor = actorOf(session);
    await this.accounts.moveSystemAdmin(actor, body.toUserId, body.reason);
    return this.accounts.list(actor);
  }
}

/** 404 and 409 of the account routes, each with one sentence. */
@Catch(AccountNotFoundError, AccountConflictError)
export class AccountErrorFilter implements ExceptionFilter<Error> {
  catch(error: Error, host: ArgumentsHost): void {
    const status =
      error instanceof AccountNotFoundError ? HttpStatus.NOT_FOUND : HttpStatus.CONFLICT;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
