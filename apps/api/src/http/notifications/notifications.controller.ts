import {
  NotificationListResponseSchema,
  OkResponseSchema,
  UnreadCountResponseSchema,
  type NotificationListResponse,
  type UnreadCountResponse,
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
  Post,
  UseGuards,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';
import {
  NotificationNotFoundError,
  NotificationService,
} from '../../core/notifications/notification-service.js';
import { actorOf, CurrentSession, SessionGuard, type SignedIn } from '../auth/auth-http.js';
import { ApiContract } from '../contract.js';

const Ok = { name: 'OkResponse', schema: OkResponseSchema };

/** REQ-NTF-001, C-03, DEC-125: every signed-in user reads only their own notices. */
@Controller('notifications')
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(@Inject(NotificationService) private readonly notices: NotificationService) {}

  @Get()
  @ApiContract({
    operationId: 'listNotifications',
    summary: 'The newest notices of the signed-in user with unread counts per tab',
    response: { name: 'NotificationListResponse', schema: NotificationListResponseSchema },
  })
  list(@CurrentSession() session: SignedIn): Promise<NotificationListResponse> {
    return this.notices.list(actorOf(session));
  }

  @Get('unread-count')
  @ApiContract({
    operationId: 'countUnreadNotifications',
    summary: 'The bell badge',
    response: { name: 'UnreadCountResponse', schema: UnreadCountResponseSchema },
  })
  unreadCount(@CurrentSession() session: SignedIn): Promise<UnreadCountResponse> {
    return this.notices.unreadCount(actorOf(session));
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiContract({ operationId: 'readAllNotifications', summary: 'Mark all read', response: Ok })
  async readAll(@CurrentSession() session: SignedIn): Promise<z.infer<typeof OkResponseSchema>> {
    await this.notices.markAllRead(actorOf(session));
    return { ok: true };
  }

  @Post(':id/read')
  @HttpCode(200)
  @ApiContract({ operationId: 'readNotification', summary: 'Mark one notice read', response: Ok })
  async read(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<z.infer<typeof OkResponseSchema>> {
    await this.notices.markRead(actorOf(session), id);
    return { ok: true };
  }
}

/** 404 of the notification routes, with one sentence. */
@Catch(NotificationNotFoundError)
export class NotificationErrorFilter implements ExceptionFilter<Error> {
  catch(error: Error, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.NOT_FOUND)
      .json({ statusCode: HttpStatus.NOT_FOUND, message: error.message });
  }
}
