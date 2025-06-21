const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const emailService = require('./emailService');

const prisma = new PrismaClient();

class NotificationService {
  constructor() {
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  async createNotification(data) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          data: data.data || {},
          scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null
        }
      });

      // Send real-time notification via Socket.IO
      if (this.io) {
        this.io.to(`user_${data.userId}`).emit('new_notification', {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          createdAt: notification.createdAt
        });
      }

      logger.info(`Notification created: ${notification.id} for user ${data.userId}`);
      return notification;
    } catch (error) {
      logger.error('Create notification error:', error);
      throw error;
    }
  }

  async sendAppointmentReminder(appointment) {
    try {
      // Create in-app notification
      await this.createNotification({
        userId: appointment.patientId,
        type: 'APPOINTMENT_REMINDER',
        title: 'Appointment Reminder',
        message: `Your appointment with Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName} is scheduled for ${new Date(appointment.appointmentDate).toLocaleDateString()}`,
        data: {
          appointmentId: appointment.id,
          doctorName: `${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
          appointmentDate: appointment.appointmentDate
        }
      });

      // Send email notification
      await emailService.sendAppointmentReminder(appointment);

      logger.info(`Appointment reminder sent for appointment: ${appointment.id}`);
    } catch (error) {
      logger.error('Send appointment reminder error:', error);
    }
  }

  async sendPrescriptionNotification(prescription, type = 'PRESCRIPTION_READY') {
    try {
      let title, message;
      
      switch (type) {
        case 'PRESCRIPTION_READY':
          title = 'Prescription Ready';
          message = `Your prescription #${prescription.prescriptionNumber} is ready for pickup`;
          break;
        case 'PRESCRIPTION_CREATED':
          title = 'New Prescription';
          message = `Dr. ${prescription.doctor.firstName} ${prescription.doctor.lastName} has issued a new prescription for you`;
          break;
        case 'PRESCRIPTION_DISPENSED':
          title = 'Prescription Dispensed';
          message = `Your prescription #${prescription.prescriptionNumber} has been dispensed`;
          break;
        default:
          title = 'Prescription Update';
          message = `Your prescription #${prescription.prescriptionNumber} has been updated`;
      }

      // Create in-app notification
      await this.createNotification({
        userId: prescription.patientId,
        type,
        title,
        message,
        data: {
          prescriptionId: prescription.id,
          prescriptionNumber: prescription.prescriptionNumber,
          doctorName: `${prescription.doctor.firstName} ${prescription.doctor.lastName}`
        }
      });

      // Send email notification for ready prescriptions
      if (type === 'PRESCRIPTION_READY') {
        await emailService.sendPrescriptionReady(prescription);
      }

      logger.info(`Prescription notification sent: ${type} for prescription ${prescription.id}`);
    } catch (error) {
      logger.error('Send prescription notification error:', error);
    }
  }

  async sendLabResultNotification(labResult) {
    try {
      // Create in-app notification
      await this.createNotification({
        userId: labResult.patientId,
        type: 'LAB_RESULT',
        title: 'Lab Results Available',
        message: `Your ${labResult.testName} results are now available`,
        data: {
          labResultId: labResult.id,
          testName: labResult.testName,
          labName: labResult.labName,
          isAbnormal: labResult.isAbnormal
        }
      });

      // Send email notification
      await emailService.sendLabResultsReady(labResult);

      logger.info(`Lab result notification sent for result: ${labResult.id}`);
    } catch (error) {
      logger.error('Send lab result notification error:', error);
    }
  }

  async sendPaymentNotification(payment, type = 'PAYMENT_DUE') {
    try {
      let title, message;
      
      switch (type) {
        case 'PAYMENT_DUE':
          title = 'Payment Due';
          message = `You have a payment of $${payment.amount} due`;
          break;
        case 'PAYMENT_COMPLETED':
          title = 'Payment Successful';
          message = `Your payment of $${payment.amount} has been processed successfully`;
          break;
        case 'PAYMENT_FAILED':
          title = 'Payment Failed';
          message = `Your payment of $${payment.amount} could not be processed`;
          break;
        default:
          title = 'Payment Update';
          message = `Payment status updated for $${payment.amount}`;
      }

      // Create in-app notification
      await this.createNotification({
        userId: payment.userId,
        type,
        title,
        message,
        data: {
          paymentId: payment.id,
          amount: payment.amount,
          status: payment.status
        }
      });

      logger.info(`Payment notification sent: ${type} for payment ${payment.id}`);
    } catch (error) {
      logger.error('Send payment notification error:', error);
    }
  }

  async sendChatNotification(chatMessage) {
    try {
      // Create in-app notification for receiver
      await this.createNotification({
        userId: chatMessage.receiverId,
        type: 'CHAT_MESSAGE',
        title: 'New Message',
        message: `New message from ${chatMessage.sender.firstName} ${chatMessage.sender.lastName}`,
        data: {
          chatMessageId: chatMessage.id,
          senderId: chatMessage.senderId,
          senderName: `${chatMessage.sender.firstName} ${chatMessage.sender.lastName}`
        }
      });

      logger.info(`Chat notification sent for message: ${chatMessage.id}`);
    } catch (error) {
      logger.error('Send chat notification error:', error);
    }
  }

  async sendBulkNotification(userIds, notificationData) {
    try {
      // Create notifications for all users
      const notifications = await prisma.notification.createMany({
        data: userIds.map(userId => ({
          userId,
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          data: notificationData.data || {}
        }))
      });

      // Send real-time notifications via Socket.IO
      if (this.io) {
        userIds.forEach(userId => {
          this.io.to(`user_${userId}`).emit('new_notification', {
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            data: notificationData.data,
            createdAt: new Date()
          });
        });
      }

      logger.info(`Bulk notification sent to ${userIds.length} users`);
      return notifications;
    } catch (error) {
      logger.error('Send bulk notification error:', error);
      throw error;
    }
  }

  async scheduleAppointmentReminders() {
    try {
      // Find appointments in next 24 hours that haven't been reminded
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      const appointments = await prisma.appointment.findMany({
        where: {
          appointmentDate: {
            gte: tomorrow,
            lt: dayAfterTomorrow
          },
          status: {
            in: ['PENDING', 'CONFIRMED']
          }
        },
        include: {
          patient: true,
          doctor: {
            include: {
              doctorProfile: true
            }
          }
        }
      });

      // Send reminders for each appointment
      for (const appointment of appointments) {
        await this.sendAppointmentReminder(appointment);
      }

      logger.info(`Scheduled ${appointments.length} appointment reminders`);
    } catch (error) {
      logger.error('Schedule appointment reminders error:', error);
    }
  }

  async cleanupOldNotifications(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          },
          isRead: true
        }
      });

      logger.info(`Cleaned up ${result.count} old notifications`);
      return result.count;
    } catch (error) {
      logger.error('Cleanup old notifications error:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();