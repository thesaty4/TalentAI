import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: number) {
    const [notifications, unseenCount] = await Promise.all([
      this.prisma.notification.findMany({
        where:   { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where: { userId, seen: false } }),
    ]);

    return {
      data: notifications,
      meta: { total: notifications.length, unseenCount },
    };
  }

  async markAllSeen(userId: number) {
    await this.prisma.notification.updateMany({
      where: { userId, seen: false },
      data:  { seen: true },
    });
    return { message: 'All notifications marked as seen' };
  }

  async markOneSeen(id: number, userId: number) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    // Scoped to the owner — never expose another user's notifications
    if (notification.userId !== userId) throw new ForbiddenException('Access denied');

    return this.prisma.notification.update({
      where: { id },
      data:  { seen: true },
    });
  }
}
