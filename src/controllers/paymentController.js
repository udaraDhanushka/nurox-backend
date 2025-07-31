const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const payHereService = require('../utils/payhere');

const prisma = new PrismaClient();

const paymentController = {
  // Create PayHere payment
  createPayHerePayment: async (req, res) => {
    try {
      const {
        amount,
        appointmentId,
        prescriptionId,
        claimId,
        description,
        customerInfo,
        metadata = {},
      } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid amount is required',
        });
      }

      // Validate customer info
      if (
        !customerInfo ||
        !customerInfo.firstName ||
        !customerInfo.lastName ||
        !customerInfo.email
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Customer information is required (firstName, lastName, email)',
        });
      }

      // Generate unique order ID
      const orderId = `NUROX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          userId: req.user.id,
          appointmentId,
          prescriptionId,
          claimId,
          amount: parseFloat(amount),
          method: 'CARD',
          status: 'PENDING',
          description,
          transactionId: orderId,
          metadata: {
            ...metadata,
            orderId,
            customerInfo,
          },
        },
      });

      // Generate PayHere payment form data
      const payHereData = payHereService.generatePaymentFormData({
        orderId,
        amount: parseFloat(amount),
        items: description,
        firstName: customerInfo.firstName,
        lastName: customerInfo.lastName,
        email: customerInfo.email,
        phone: customerInfo.phone || '0771234567',
        address: customerInfo.address || 'Colombo',
        city: customerInfo.city || 'Colombo',
        country: customerInfo.country || 'Sri Lanka',
      });

      logger.info(
        `PayHere payment created: ${payment.id} for user ${req.user.email}`
      );

      res.status(201).json({
        success: true,
        message: 'PayHere payment created successfully',
        data: payHereData,
      });
    } catch (error) {
      logger.error('Create PayHere payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create PayHere payment',
      });
    }
  },

  // Confirm payment
  confirmPayment: async (req, res) => {
    try {
      const { orderId, paymentId, payhereData } = req.body;

      if (!orderId || !paymentId) {
        return res.status(400).json({
          success: false,
          message: 'Order ID and Payment ID are required',
        });
      }

      // Find payment by order ID (transaction ID)
      const payment = await prisma.payment.findUnique({
        where: { transactionId: orderId },
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found',
        });
      }

      if (payment.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      // Update payment status
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          paidAt: new Date(),
          metadata: {
            ...payment.metadata,
            payHerePaymentId: paymentId,
            payhereData: payhereData || {},
          },
        },
      });

      // If payment is for an appointment, update appointment status to CONFIRMED
      if (payment.appointmentId) {
        await prisma.appointment.update({
          where: { id: payment.appointmentId },
          data: { status: 'CONFIRMED' },
        });

        logger.info(
          `Appointment ${payment.appointmentId} status updated to CONFIRMED after PayHere payment confirmation`
        );
      }

      // Create notification for successful payment
      await prisma.notification.create({
        data: {
          userId: req.user.id,
          type: 'PAYMENT_DUE',
          title: 'Payment Successful',
          message: `Your payment of Rs. ${payment.amount} has been processed successfully via PayHere`,
          data: { paymentId: payment.id, payHerePaymentId: paymentId },
        },
      });

      logger.info(
        `PayHere payment confirmed: ${payment.id} for user ${req.user.email}`
      );

      res.json({
        success: true,
        message: 'Payment confirmed successfully',
        payment: {
          id: payment.id,
          status: 'COMPLETED',
          amount: payment.amount,
          transactionId: paymentId,
        },
      });
    } catch (error) {
      logger.error('Confirm PayHere payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to confirm payment',
      });
    }
  },

  // Get user payments
  getPayments: async (req, res) => {
    try {
      const {
        status,
        method,
        startDate,
        endDate,
        page = 1,
        limit = 20,
      } = req.query;

      const skip = (page - 1) * limit;
      const where = { userId: req.user.id };

      if (status) where.status = status;
      if (method) where.method = method;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          include: {
            appointment: {
              select: {
                id: true,
                appointmentDate: true,
                type: true,
                doctor: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            prescription: {
              select: {
                id: true,
                prescriptionNumber: true,
                doctor: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            claim: {
              select: {
                id: true,
                claimNumber: true,
                insuranceProvider: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: parseInt(skip),
          take: parseInt(limit),
        }),
        prisma.payment.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          payments,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Get payments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payments',
      });
    }
  },

  // Get single payment
  getPayment: async (req, res) => {
    try {
      const { id } = req.params;

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
          appointment: {
            select: {
              id: true,
              appointmentDate: true,
              type: true,
              doctor: {
                select: {
                  firstName: true,
                  lastName: true,
                  doctorProfile: true,
                },
              },
            },
          },
          prescription: {
            select: {
              id: true,
              prescriptionNumber: true,
              doctor: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          claim: {
            select: {
              id: true,
              claimNumber: true,
              insuranceProvider: true,
            },
          },
        },
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found',
        });
      }

      if (payment.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      logger.error('Get payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment',
      });
    }
  },

  // Request refund
  requestRefund: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, amount } = req.body;

      const payment = await prisma.payment.findUnique({
        where: { id },
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found',
        });
      }

      if (payment.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      if (payment.status !== 'COMPLETED') {
        return res.status(400).json({
          success: false,
          message: 'Can only refund completed payments',
        });
      }

      const refundAmount = amount || payment.amount;

      if (refundAmount > payment.amount) {
        return res.status(400).json({
          success: false,
          message: 'Refund amount cannot exceed payment amount',
        });
      }

      // Process refund with Stripe
      const refund = await stripe.refunds.create({
        payment_intent: payment.transactionId,
        amount: Math.round(refundAmount * 100), // Convert to cents
        metadata: {
          reason: reason || 'Requested by customer',
        },
      });

      // Update payment record
      await prisma.payment.update({
        where: { id },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
          refundAmount,
          metadata: {
            ...payment.metadata,
            refund: refund,
            refundReason: reason,
          },
        },
      });

      logger.info(`Refund processed: ${id} for user ${req.user.email}`);

      res.json({
        success: true,
        message: 'Refund processed successfully',
        data: {
          paymentId: id,
          refundAmount,
          refundId: refund.id,
        },
      });
    } catch (error) {
      logger.error('Request refund error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process refund',
      });
    }
  },

  // Get payment analytics
  getPaymentAnalytics: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const where = { userId: req.user.id };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [
        totalPayments,
        totalAmount,
        completedPayments,
        failedPayments,
        refundedPayments,
        paymentsByMethod,
      ] = await Promise.all([
        prisma.payment.count({ where }),
        prisma.payment.aggregate({
          where: { ...where, status: 'COMPLETED' },
          _sum: { amount: true },
        }),
        prisma.payment.count({ where: { ...where, status: 'COMPLETED' } }),
        prisma.payment.count({ where: { ...where, status: 'FAILED' } }),
        prisma.payment.count({ where: { ...where, status: 'REFUNDED' } }),
        prisma.payment.groupBy({
          by: ['method'],
          where,
          _count: { method: true },
          _sum: { amount: true },
        }),
      ]);

      res.json({
        success: true,
        data: {
          totalPayments,
          totalAmount: totalAmount._sum.amount || 0,
          statusBreakdown: {
            completed: completedPayments,
            failed: failedPayments,
            refunded: refundedPayments,
          },
          paymentsByMethod: paymentsByMethod.map((item) => ({
            method: item.method,
            count: item._count.method,
            totalAmount: item._sum.amount || 0,
          })),
        },
      });
    } catch (error) {
      logger.error('Get payment analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment analytics',
      });
    }
  },

  // Webhook handler for PayHere notifications
  handlePayHereWebhook: async (req, res) => {
    try {
      const notificationData = req.body;

      // Validate required fields
      const requiredFields = [
        'merchant_id',
        'order_id',
        'payment_id',
        'payhere_amount',
        'payhere_currency',
        'status_code',
        'md5sig',
      ];
      const missingFields = requiredFields.filter(
        (field) => !notificationData[field]
      );

      if (missingFields.length > 0) {
        logger.warn(
          `PayHere webhook missing fields: ${missingFields.join(', ')}`
        );
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`,
        });
      }

      // Verify hash signature
      const isValidHash =
        payHereService.verifyNotificationHash(notificationData);
      if (!isValidHash) {
        logger.warn('PayHere webhook hash verification failed');
        return res.status(400).json({
          success: false,
          message: 'Invalid hash signature',
        });
      }

      // Get payment status
      const paymentStatus = payHereService.getPaymentStatus(
        notificationData.status_code
      );

      // Handle payment notification
      await handlePayHereNotification(notificationData, paymentStatus);

      res.json({
        success: true,
        message: 'Notification processed successfully',
      });
    } catch (error) {
      logger.error('PayHere webhook error:', error);
      res.status(500).json({
        success: false,
        message: 'Webhook processing failed',
      });
    }
  },
};

// Helper function to handle PayHere notifications
async function handlePayHereNotification(notificationData, paymentStatus) {
  try {
    const {
      order_id,
      payment_id,
      payhere_amount,
      payhere_currency,
      status_code,
    } = notificationData;

    // Find payment by order ID
    const payment = await prisma.payment.findFirst({
      where: { transactionId: order_id },
    });

    if (!payment) {
      logger.warn(
        `PayHere notification: Payment not found for order ${order_id}`
      );
      return;
    }

    // Update payment status
    const updateData = {
      status: paymentStatus.status,
      metadata: {
        ...payment.metadata,
        payHerePaymentId: payment_id,
        payHereNotification: notificationData,
        statusCode: status_code,
      },
    };

    // Set paid date for successful payments
    if (paymentStatus.status === 'COMPLETED') {
      updateData.paidAt = new Date();
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: updateData,
    });

    // Handle successful payment
    if (paymentStatus.status === 'COMPLETED') {
      // Update appointment status if applicable
      if (payment.appointmentId) {
        await prisma.appointment.update({
          where: { id: payment.appointmentId },
          data: { status: 'CONFIRMED' },
        });

        logger.info(
          `Appointment ${payment.appointmentId} confirmed via PayHere webhook`
        );
      }

      // Create success notification
      await prisma.notification.create({
        data: {
          userId: payment.userId,
          type: 'PAYMENT_DUE',
          title: 'Payment Successful',
          message: `Your payment of Rs. ${payhere_amount} has been processed successfully via PayHere`,
          data: {
            paymentId: payment.id,
            payHerePaymentId: payment_id,
            orderId: order_id,
          },
        },
      });

      logger.info(
        `PayHere payment confirmed via webhook: ${payment.id}, PayHere ID: ${payment_id}`
      );
    } else {
      // Create failure notification for failed payments
      await prisma.notification.create({
        data: {
          userId: payment.userId,
          type: 'PAYMENT_DUE',
          title: 'Payment Failed',
          message: `Your payment of Rs. ${payhere_amount} could not be processed: ${paymentStatus.message}`,
          data: {
            paymentId: payment.id,
            payHerePaymentId: payment_id,
            orderId: order_id,
            failureReason: paymentStatus.message,
          },
        },
      });

      logger.info(
        `PayHere payment failed via webhook: ${payment.id}, Status: ${paymentStatus.message}`
      );
    }
  } catch (error) {
    logger.error('Handle PayHere notification error:', error);
  }
}

module.exports = paymentController;
