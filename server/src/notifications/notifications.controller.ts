import { Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Notifications for the logged-in user, newest first' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.findAll(user.sub);
  }

  @Patch('mark-seen')
  @ApiOperation({ summary: 'Mark all unseen notifications as seen' })
  markAllSeen(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllSeen(user.sub);
  }

  @Patch(':id/seen')
  @ApiOperation({ summary: 'Mark a single notification as seen' })
  @ApiParam({ name: 'id', type: Number })
  markOneSeen(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.markOneSeen(id, user.sub);
  }
}
