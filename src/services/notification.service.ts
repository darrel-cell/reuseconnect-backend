// Notification Service
import prisma from '../config/database';
import { NotificationType } from '@prisma/client';

export interface CreateNotificationData {
  userId: string;
  tenantId: string;
  type: NotificationType;
  title: string;
  message: string;
  url?: string;
  relatedId?: string;
  relatedType?: string;
}

export class NotificationService {
  /**
   * Create a new notification
   */
  async createNotification(data: CreateNotificationData) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        tenantId: data.tenantId,
        type: data.type,
        title: data.title,
        message: data.message,
        url: data.url,
        relatedId: data.relatedId,
        relatedType: data.relatedType,
      },
    });
  }

  /**
   * Create notifications for multiple users
   */
  async createNotificationsForUsers(
    userIds: string[],
    tenantId: string,
    type: NotificationType,
    title: string,
    message: string,
    url?: string,
    relatedId?: string,
    relatedType?: string
  ) {
    if (userIds.length === 0) return [];

    const notifications = userIds.map(userId => ({
      userId,
      tenantId,
      type,
      title,
      message,
      url,
      relatedId,
      relatedType,
    }));

    return prisma.notification.createMany({
      data: notifications,
    });
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    tenantId?: string,
    options?: {
      read?: boolean;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { userId };
    if (tenantId) {
      where.tenantId = tenantId;
    }
    if (options?.read !== undefined) {
      where.read = options.read;
    }

    // Log notification fetch (debug level)
    const { logger } = await import('../utils/logger');
    logger.debug('Fetching notifications', {
      userId,
      tenantId,
      read: options?.read,
    });

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit,
        skip: options?.offset,
      }),
      prisma.notification.count({ where }),
    ]);


    return {
      notifications,
      total,
    };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string, tenantId?: string): Promise<number> {
    const where: any = {
      userId,
      read: false,
    };
    if (tenantId) {
      where.tenantId = tenantId;
    }
    return prisma.notification.count({ where });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    // Verify the notification belongs to the user
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new Error('Notification not found or access denied');
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string, tenantId?: string) {
    const where: any = {
      userId,
      read: false,
    };
    
    // For non-admin/non-driver roles, filter by tenantId
    // (admins and drivers can see notifications across all tenants)
    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }
    
    return prisma.notification.updateMany({
      where,
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string) {
    // Verify the notification belongs to the user
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new Error('Notification not found or access denied');
    }

    return prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  /**
   * Delete all read notifications for a user
   */
  async deleteAllRead(userId: string) {
    return prisma.notification.deleteMany({
      where: {
        userId,
        read: true,
      },
    });
  }

  /**
   * Format time ago string
   */
  formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks} week${diffInWeeks !== 1 ? 's' : ''} ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
  }
}

