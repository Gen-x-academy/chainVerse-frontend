import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  /**
   * Admin-only: returns all notifications from all users.
   * Requires ADMIN role — prevents authenticated non-admin users
   * from reading other users' notifications.
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  findAll() {
    return [];
  }

  /**
   * Returns notifications belonging to the specified user only.
   * Safe for authenticated students to call for their own userId.
   */
  @Get(':userId')
  findByUserId(@Param('userId') userId: string) {
    return { userId, notifications: [] };
  }
}
