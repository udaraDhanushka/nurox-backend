const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const notificationController = {
  // Get notifications for current user
  getNotifications: async (req, res) => {
    try {
      const { type, isRead, page = 1, limit = 20 } = req.query;

      const skip = (page - 1) * limit;
      const where = { userId: req.user.id };

      // Apply filters
      if (type) where.type = type;
      if (isRead !== undefined) where.isRead = isRead === 'true';

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: parseInt(skip),
          take: parseInt(limit),
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({
          where: {
            userId: req.user.id,
            isRead: false,
          },
        }),
      ]);

      res.json({
        success: true,
        data: {
          notifications,
          unreadCount,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications',
      });
    }
  },

  // Create notification
  createNotification: async (req, res) => {
    try {
      const { userId, type, title, message, data, scheduledFor } = req.body;

      // Only allow creating notifications for specific roles or system
      if (!['DOCTOR', 'PHARMACIST', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
        });
      }

      const notification = await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          data,
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        },
      });

      // Send real-time notification via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${userId}`).emit('new_notification', {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          createdAt: notification.createdAt,
        });
      }

      logger.info(
        `Notification created for user ${userId} by ${req.user.email}`
      );

      res.status(201).json({
        success: true,
        message: 'Notification created successfully',
        data: notification,
      });
    } catch (error) {
      logger.error('Create notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create notification',
      });
    }
  },

  // Mark notification as read
  markAsRead: async (req, res) => {
    try {
      const { id } = req.params;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
        });
      }

      // Check ownership
      if (notification.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      const updatedNotification = await prisma.notification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      logger.info(`Notification marked as read: ${id} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Notification marked as read',
        data: updatedNotification,
      });
    } catch (error) {
      logger.error('Mark notification as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
      });
    }
  },

  // Mark all notifications as read
  markAllAsRead: async (req, res) => {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          userId: req.user.id,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      logger.info(
        `${result.count} notifications marked as read by ${req.user.email}`
      );

      res.json({
        success: true,
        message: `${result.count} notifications marked as read`,
      });
    } catch (error) {
      logger.error('Mark all notifications as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read',
      });
    }
  },

  // Delete notification
  deleteNotification: async (req, res) => {
    try {
      const { id } = req.params;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
        });
      }

      // Check ownership
      if (notification.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      await prisma.notification.delete({
        where: { id },
      });

      logger.info(`Notification deleted: ${id} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      logger.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification',
      });
    }
  },

  // Delete all read notifications
  deleteAllRead: async (req, res) => {
    try {
      const result = await prisma.notification.deleteMany({
        where: {
          userId: req.user.id,
          isRead: true,
        },
      });

      logger.info(
        `${result.count} read notifications deleted by ${req.user.email}`
      );

      res.json({
        success: true,
        message: `${result.count} read notifications deleted`,
      });
    } catch (error) {
      logger.error('Delete all read notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete read notifications',
      });
    }
  },

  // Get notification preferences (placeholder for future implementation)
  getPreferences: async (req, res) => {
    try {
      // This would typically be stored in a user preferences table
      const defaultPreferences = {
        appointmentReminders: true,
        prescriptionReady: true,
        labResults: true,
        paymentDue: true,
        insuranceUpdates: true,
        systemAlerts: true,
        chatMessages: true,
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
      };

      res.json({
        success: true,
        data: defaultPreferences,
      });
    } catch (error) {
      logger.error('Get notification preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification preferences',
      });
    }
  },

  // Update notification preferences (placeholder for future implementation)
  updatePreferences: async (req, res) => {
    try {
      const preferences = req.body;

      // In a real implementation, you would save these to a user preferences table
      logger.info(`Notification preferences updated by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Notification preferences updated successfully',
        data: preferences,
      });
    } catch (error) {
      logger.error('Update notification preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification preferences',
      });
    }
  },

  // Send bulk notifications (admin only)
  sendBulkNotification: async (req, res) => {
    try {
      const { userIds, type, title, message, data } = req.body;

      // Only admins can send bulk notifications
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin role required.',
        });
      }

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array is required',
        });
      }

      // Create notifications for all users
      const notifications = await prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          type,
          title,
          message,
          data,
        })),
      });

      // Send real-time notifications via Socket.IO
      const io = req.app.get('io');
      if (io) {
        userIds.forEach((userId) => {
          io.to(`user_${userId}`).emit('new_notification', {
            type,
            title,
            message,
            data,
            createdAt: new Date(),
          });
        });
      }

      logger.info(
        `Bulk notification sent to ${userIds.length} users by ${req.user.email}`
      );

      res.json({
        success: true,
        message: `Notification sent to ${userIds.length} users`,
        data: { count: notifications.count },
      });
    } catch (error) {
      logger.error('Send bulk notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send bulk notification',
      });
    }
  },
};

module.exports = notificationController;
