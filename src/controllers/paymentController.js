const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const prisma = new PrismaClient();

const paymentController = {
  // Create payment intent
  createPaymentIntent: async (req, res) => {
    try {
      const {
        amount,
        appointmentId,
        prescriptionId,
        claimId,
        description,
        metadata = {}
      } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid amount is required'
        });
      }

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
          metadata
        }
      });

      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          paymentId: payment.id,
          userId: req.user.id,
          appointmentId: appointmentId || '',
          prescriptionId: prescriptionId || ''
        }
      });

      // Update payment with transaction ID
      await prisma.payment.update({
        where: { id: payment.id },
        data: { transactionId: paymentIntent.id }
      });

      logger.info(`Payment intent created: ${payment.id} for user ${req.user.email}`);

      res.status(201).json({
        success: true,
        message: 'Payment intent created successfully',
        data: {
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          amount: payment.amount,
          currency: 'usd'
        }
      });
    } catch (error) {
      logger.error('Create payment intent error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment intent'
      });
    }
  },

  // Confirm payment
  confirmPayment: async (req, res) => {
    try {
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          message: 'Payment intent ID is required'
        });
      }

      // Find payment by transaction ID (Stripe payment intent ID)
      const payment = await prisma.payment.findUnique({
        where: { transactionId: paymentIntentId }
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      if (payment.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Retrieve payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        // Update payment status
        const updatedPayment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'COMPLETED',
            paidAt: new Date(),
            metadata: {
              ...payment.metadata,
              stripePaymentIntent: paymentIntent
            }
          }
        });

        // If payment is for an appointment, update appointment status to CONFIRMED
        if (payment.appointmentId) {
          await prisma.appointment.update({
            where: { id: payment.appointmentId },
            data: { status: 'CONFIRMED' }
          });

          logger.info(`Appointment ${payment.appointmentId} status updated to CONFIRMED after payment confirmation`);
        }

        // Create notification for successful payment
        await prisma.notification.create({
          data: {
            userId: req.user.id,
            type: 'PAYMENT_DUE',
            title: 'Payment Successful',
            message: `Your payment of $${payment.amount} has been processed successfully`,
            data: { paymentId: payment.id }
          }
        });

        logger.info(`Payment confirmed: ${payment.id} for user ${req.user.email}`);

        res.json({
          success: true,
          message: 'Payment confirmed successfully',
          payment: {
            id: payment.id,
            status: 'COMPLETED',
            amount: payment.amount,
            transactionId: paymentIntentId
          }
        });
      } else {
        // Update payment status as failed
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' }
        });

        res.status(400).json({
          success: false,
          message: 'Payment failed or incomplete',
          payment: {
            id: payment.id,
            status: paymentIntent.status,
            amount: payment.amount,
            transactionId: paymentIntentId
          }
        });
      }
    } catch (error) {
      logger.error('Confirm payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to confirm payment'
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
        limit = 20
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
                    lastName: true
                  }
                }
              }
            },
            prescription: {
              select: {
                id: true,
                prescriptionNumber: true,
                doctor: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            claim: {
              select: {
                id: true,
                claimNumber: true,
                insuranceProvider: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.payment.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          payments,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Get payments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payments'
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
                  doctorProfile: true
                }
              }
            }
          },
          prescription: {
            select: {
              id: true,
              prescriptionNumber: true,
              doctor: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          claim: {
            select: {
              id: true,
              claimNumber: true,
              insuranceProvider: true
            }
          }
        }
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      if (payment.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: payment
      });
    } catch (error) {
      logger.error('Get payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment'
      });
    }
  },

  // Request refund
  requestRefund: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, amount } = req.body;

      const payment = await prisma.payment.findUnique({
        where: { id }
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      if (payment.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      if (payment.status !== 'COMPLETED') {
        return res.status(400).json({
          success: false,
          message: 'Can only refund completed payments'
        });
      }

      const refundAmount = amount || payment.amount;

      if (refundAmount > payment.amount) {
        return res.status(400).json({
          success: false,
          message: 'Refund amount cannot exceed payment amount'
        });
      }

      // Process refund with Stripe
      const refund = await stripe.refunds.create({
        payment_intent: payment.transactionId,
        amount: Math.round(refundAmount * 100), // Convert to cents
        metadata: {
          reason: reason || 'Requested by customer'
        }
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
            refundReason: reason
          }
        }
      });

      logger.info(`Refund processed: ${id} for user ${req.user.email}`);

      res.json({
        success: true,
        message: 'Refund processed successfully',
        data: {
          paymentId: id,
          refundAmount,
          refundId: refund.id
        }
      });
    } catch (error) {
      logger.error('Request refund error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process refund'
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
        paymentsByMethod
      ] = await Promise.all([
        prisma.payment.count({ where }),
        prisma.payment.aggregate({
          where: { ...where, status: 'COMPLETED' },
          _sum: { amount: true }
        }),
        prisma.payment.count({ where: { ...where, status: 'COMPLETED' } }),
        prisma.payment.count({ where: { ...where, status: 'FAILED' } }),
        prisma.payment.count({ where: { ...where, status: 'REFUNDED' } }),
        prisma.payment.groupBy({
          by: ['method'],
          where,
          _count: { method: true },
          _sum: { amount: true }
        })
      ]);

      res.json({
        success: true,
        data: {
          totalPayments,
          totalAmount: totalAmount._sum.amount || 0,
          statusBreakdown: {
            completed: completedPayments,
            failed: failedPayments,
            refunded: refundedPayments
          },
          paymentsByMethod: paymentsByMethod.map(item => ({
            method: item.method,
            count: item._count.method,
            totalAmount: item._sum.amount || 0
          }))
        }
      });
    } catch (error) {
      logger.error('Get payment analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment analytics'
      });
    }
  },

  // Webhook handler for Stripe events
  handleStripeWebhook: async (req, res) => {
    try {
      const sig = req.headers['stripe-signature'];
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err) {
        logger.error(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          await handlePaymentSuccess(paymentIntent);
          break;
        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object;
          await handlePaymentFailure(failedPayment);
          break;
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      logger.error('Stripe webhook error:', error);
      res.status(500).json({
        success: false,
        message: 'Webhook processing failed'
      });
    }
  }
};

// Helper function to handle successful payments
async function handlePaymentSuccess(paymentIntent) {
  try {
    const payment = await prisma.payment.findFirst({
      where: { transactionId: paymentIntent.id }
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          paidAt: new Date()
        }
      });

      logger.info(`Payment confirmed via webhook: ${payment.id}`);
    }
  } catch (error) {
    logger.error('Handle payment success error:', error);
  }
}

// Helper function to handle failed payments
async function handlePaymentFailure(paymentIntent) {
  try {
    const payment = await prisma.payment.findFirst({
      where: { transactionId: paymentIntent.id }
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' }
      });

      logger.info(`Payment failed via webhook: ${payment.id}`);
    }
  } catch (error) {
    logger.error('Handle payment failure error:', error);
  }
}

module.exports = paymentController;