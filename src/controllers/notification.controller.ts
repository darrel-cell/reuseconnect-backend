// Notification Controller
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { NotificationService } from '../services/notification.service';

const notificationService = new NotificationService();

export class NotificationController {
  /**
   * Get notifications for the authenticated user
   * GET /api/notifications
   */
  async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { read, limit, offset } = req.query;
      const readFilter = read === 'true' ? true : read === 'false' ? false : undefined;

      // Admins and drivers can see notifications across all tenants
      // (drivers may be assigned jobs from clients in different tenants)
      // So don't filter by tenantId for admin or driver roles
      const tenantFilter =
        req.user.role === 'admin' || req.user.role === 'driver' ? undefined : req.user.tenantId;

      const result = await notificationService.getNotifications(
        req.user.userId,
        tenantFilter,
        {
          read: readFilter,
          limit: limit ? parseInt(limit as string) : undefined,
          offset: offset ? parseInt(offset as string) : undefined,
        }
      );

      // Log notification fetch (debug level)
      const { logger } = await import('../utils/logger');
      logger.debug('Fetching notifications', {
        requestId: req.id,
        userId: req.user.userId,
        userRole: req.user.role,
        tenantId: req.user.tenantId,
        readFilter,
        notificationsFound: result.notifications.length,
        total: result.total,
      });

      // Format notifications with time ago
      const formattedNotifications = result.notifications.map(notification => ({
        id: notification.id,
        type: notification.type as 'success' | 'warning' | 'info' | 'error',
        title: notification.title,
        message: notification.message,
        time: notificationService.formatTimeAgo(notification.createdAt),
        read: notification.read,
        url: notification.url,
        createdAt: notification.createdAt.toISOString(),
      }));

      return res.json({
        success: true,
        data: {
          notifications: formattedNotifications,
          total: result.total,
        },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get unread count for the authenticated user
   * GET /api/notifications/unread-count
   */
  async getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      // Admins and drivers can see notifications across all tenants
      // (drivers may be assigned jobs from clients in different tenants)
      // So don't filter by tenantId for admin or driver roles
      const tenantFilter =
        req.user.role === 'admin' || req.user.role === 'driver' ? undefined : req.user.tenantId;

      const count = await notificationService.getUnreadCount(
        req.user.userId,
        tenantFilter
      );

      return res.json({
        success: true,
        data: { count },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Mark notification as read
   * PATCH /api/notifications/:id/read
   */
  async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Notification ID is required',
        } as ApiResponse);
      }

      await notificationService.markAsRead(id, req.user.userId);

      return res.json({
        success: true,
        message: 'Notification marked as read',
      } as ApiResponse);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        } as ApiResponse);
      }
      return next(error);
    }
  }

  /**
   * Mark all notifications as read
   * PATCH /api/notifications/read-all
   */
  async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      // For non-admin/non-driver roles, filter by tenantId
      // (admins and drivers can see notifications across all tenants)
      const tenantFilter = 
        req.user.role === 'admin' || req.user.role === 'driver' 
          ? undefined 
          : req.user.tenantId;

      const result = await notificationService.markAllAsRead(req.user.userId, tenantFilter);

      return res.json({
        success: true,
        message: `Marked ${result.count} notifications as read`,
        data: { count: result.count },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete a notification
   * DELETE /api/notifications/:id
   */
  async deleteNotification(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Notification ID is required',
        } as ApiResponse);
      }

      await notificationService.deleteNotification(id, req.user.userId);

      return res.json({
        success: true,
        message: 'Notification deleted',
      } as ApiResponse);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        } as ApiResponse);
      }
      return next(error);
    }
  }

  /**
   * Delete all read notifications
   * DELETE /api/notifications/read
   */
  async deleteAllRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const result = await notificationService.deleteAllRead(req.user.userId);

      return res.json({
        success: true,
        message: `Deleted ${result.count} read notifications`,
        data: { count: result.count },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
}

