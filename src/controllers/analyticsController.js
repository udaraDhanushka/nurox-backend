const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const analyticsController = {
  // Get dashboard analytics
  getDashboardAnalytics: async (req, res) => {
    try {
      const { period = '30', startDate, endDate } = req.query;
      
      let dateFilter = {};
      if (startDate && endDate) {
        dateFilter = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      } else {
        const daysAgo = parseInt(period);
        dateFilter = {
          gte: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
        };
      }

      const analytics = await getDashboardDataByRole(req.user, dateFilter);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Get dashboard analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get dashboard analytics'
      });
    }
  },

  // Get user activity analytics
  getUserActivity: async (req, res) => {
    try {
      const { period = '7' } = req.query;
      const daysAgo = parseInt(period);
      
      const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      
      // Generate daily activity for the period
      const dailyActivity = [];
      for (let i = daysAgo; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(date.setHours(0, 0, 0, 0));
        const dayEnd = new Date(date.setHours(23, 59, 59, 999));

        const activity = await getUserDailyActivity(req.user.id, dayStart, dayEnd);
        
        dailyActivity.push({
          date: dayStart.toISOString().split('T')[0],
          ...activity
        });
      }

      res.json({
        success: true,
        data: {
          period: `${period} days`,
          dailyActivity
        }
      });
    } catch (error) {
      logger.error('Get user activity error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user activity'
      });
    }
  },

  // Get health metrics for patients
  getHealthMetrics: async (req, res) => {
    try {
      if (req.user.role !== 'PATIENT') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Patient role required.'
        });
      }

      const { period = '90' } = req.query;
      const daysAgo = parseInt(period);
      const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      const [vitals, labResults, prescriptions, appointments] = await Promise.all([
        // Recent vitals
        prisma.vital.findMany({
          where: {
            patientId: req.user.id,
            recordedAt: { gte: startDate }
          },
          orderBy: { recordedAt: 'desc' },
          take: 10
        }),
        // Recent lab results
        prisma.labResult.findMany({
          where: {
            patientId: req.user.id,
            orderedDate: { gte: startDate },
            status: 'COMPLETED'
          },
          include: {
            appointment: {
              select: {
                doctor: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          },
          orderBy: { orderedDate: 'desc' },
          take: 5
        }),
        // Active prescriptions
        prisma.prescription.count({
          where: {
            patientId: req.user.id,
            status: { in: ['PENDING', 'PROCESSING', 'READY'] }
          }
        }),
        // Upcoming appointments
        prisma.appointment.count({
          where: {
            patientId: req.user.id,
            appointmentDate: { gte: new Date() },
            status: { in: ['PENDING', 'CONFIRMED'] }
          }
        })
      ]);

      // Calculate health trends
      const healthTrends = calculateHealthTrends(vitals);

      res.json({
        success: true,
        data: {
          summary: {
            activePrescriptions,
            upcomingAppointments: appointments,
            recentVitals: vitals.length,
            recentLabResults: labResults.length
          },
          vitals: vitals.slice(0, 5), // Last 5 vital records
          labResults,
          healthTrends
        }
      });
    } catch (error) {
      logger.error('Get health metrics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get health metrics'
      });
    }
  },

  // Get doctor performance analytics
  getDoctorPerformance: async (req, res) => {
    try {
      if (req.user.role !== 'DOCTOR') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Doctor role required.'
        });
      }

      const { period = '30' } = req.query;
      const daysAgo = parseInt(period);
      const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      const [
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        totalPatients,
        prescriptionsIssued,
        averageRating
      ] = await Promise.all([
        prisma.appointment.count({
          where: {
            doctorId: req.user.id,
            appointmentDate: { gte: startDate }
          }
        }),
        prisma.appointment.count({
          where: {
            doctorId: req.user.id,
            appointmentDate: { gte: startDate },
            status: 'COMPLETED'
          }
        }),
        prisma.appointment.count({
          where: {
            doctorId: req.user.id,
            appointmentDate: { gte: startDate },
            status: 'CANCELLED'
          }
        }),
        prisma.appointment.count({
          where: {
            doctorId: req.user.id,
            appointmentDate: { gte: startDate }
          },
          distinct: ['patientId']
        }),
        prisma.prescription.count({
          where: {
            doctorId: req.user.id,
            issuedDate: { gte: startDate }
          }
        }),
        prisma.doctorProfile.findUnique({
          where: { userId: req.user.id },
          select: { rating: true, reviewCount: true }
        })
      ]);

      const completionRate = totalAppointments > 0 ? 
        (completedAppointments / totalAppointments * 100).toFixed(1) : 0;

      res.json({
        success: true,
        data: {
          period: `${period} days`,
          appointments: {
            total: totalAppointments,
            completed: completedAppointments,
            cancelled: cancelledAppointments,
            completionRate: parseFloat(completionRate)
          },
          patients: {
            total: totalPatients
          },
          prescriptions: {
            issued: prescriptionsIssued
          },
          rating: {
            average: averageRating?.rating || 0,
            reviewCount: averageRating?.reviewCount || 0
          }
        }
      });
    } catch (error) {
      logger.error('Get doctor performance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get doctor performance analytics'
      });
    }
  },

  // Get pharmacy analytics
  getPharmacyAnalytics: async (req, res) => {
    try {
      if (req.user.role !== 'PHARMACIST') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Pharmacist role required.'
        });
      }

      const { period = '30' } = req.query;
      const daysAgo = parseInt(period);
      const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      const [
        prescriptionsDispensed,
        totalRevenue,
        inventoryItems,
        lowStockItems,
        expiringItems
      ] = await Promise.all([
        prisma.prescriptionItem.count({
          where: {
            prescription: {
              pharmacistId: req.user.id
            },
            dispensedAt: { gte: startDate },
            isDispensed: true
          }
        }),
        prisma.payment.aggregate({
          where: {
            prescription: {
              pharmacistId: req.user.id
            },
            status: 'COMPLETED',
            paidAt: { gte: startDate }
          },
          _sum: { amount: true }
        }),
        prisma.inventoryItem.count({
          where: {
            pharmacistId: req.user.id,
            isActive: true
          }
        }),
        prisma.inventoryItem.count({
          where: {
            pharmacistId: req.user.id,
            isActive: true,
            quantity: { lte: 10 }
          }
        }),
        prisma.inventoryItem.count({
          where: {
            pharmacistId: req.user.id,
            isActive: true,
            expiryDate: {
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
            }
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          period: `${period} days`,
          prescriptions: {
            dispensed: prescriptionsDispensed
          },
          revenue: {
            total: totalRevenue._sum.amount || 0
          },
          inventory: {
            totalItems: inventoryItems,
            lowStockItems,
            expiringItems
          }
        }
      });
    } catch (error) {
      logger.error('Get pharmacy analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pharmacy analytics'
      });
    }
  },

  // Get system-wide analytics (admin only)
  getSystemAnalytics: async (req, res) => {
    try {
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin role required.'
        });
      }

      const { period = '30' } = req.query;
      const daysAgo = parseInt(period);
      const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        newUsers,
        totalAppointments,
        totalPrescriptions,
        totalPayments,
        usersByRole
      ] = await Promise.all([
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({
          where: {
            isActive: true,
            createdAt: { gte: startDate }
          }
        }),
        prisma.appointment.count({
          where: { appointmentDate: { gte: startDate } }
        }),
        prisma.prescription.count({
          where: { issuedDate: { gte: startDate } }
        }),
        prisma.payment.aggregate({
          where: {
            status: 'COMPLETED',
            paidAt: { gte: startDate }
          },
          _sum: { amount: true },
          _count: { id: true }
        }),
        prisma.user.groupBy({
          by: ['role'],
          where: { isActive: true },
          _count: { role: true }
        })
      ]);

      res.json({
        success: true,
        data: {
          period: `${period} days`,
          users: {
            total: totalUsers,
            new: newUsers,
            byRole: usersByRole.map(item => ({
              role: item.role,
              count: item._count.role
            }))
          },
          appointments: {
            total: totalAppointments
          },
          prescriptions: {
            total: totalPrescriptions
          },
          payments: {
            total: totalPayments._count.id || 0,
            revenue: totalPayments._sum.amount || 0
          }
        }
      });
    } catch (error) {
      logger.error('Get system analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get system analytics'
      });
    }
  }
};

// Helper function to get dashboard data based on user role
async function getDashboardDataByRole(user, dateFilter) {
  const baseWhere = { createdAt: dateFilter };
  
  switch (user.role) {
    case 'PATIENT':
      return await getPatientDashboard(user.id, dateFilter);
    case 'DOCTOR':
      return await getDoctorDashboard(user.id, dateFilter);
    case 'PHARMACIST':
      return await getPharmacistDashboard(user.id, dateFilter);
    case 'ADMIN':
      return await getAdminDashboard(dateFilter);
    default:
      return {};
  }
}

// Patient dashboard data
async function getPatientDashboard(userId, dateFilter) {
  const [appointments, prescriptions, labResults, notifications] = await Promise.all([
    prisma.appointment.count({
      where: {
        patientId: userId,
        appointmentDate: dateFilter
      }
    }),
    prisma.prescription.count({
      where: {
        patientId: userId,
        issuedDate: dateFilter
      }
    }),
    prisma.labResult.count({
      where: {
        patientId: userId,
        orderedDate: dateFilter
      }
    }),
    prisma.notification.count({
      where: {
        userId,
        createdAt: dateFilter,
        isRead: false
      }
    })
  ]);

  return {
    appointments,
    prescriptions,
    labResults,
    unreadNotifications: notifications
  };
}

// Doctor dashboard data
async function getDoctorDashboard(userId, dateFilter) {
  const [appointments, prescriptions, patients, labResults] = await Promise.all([
    prisma.appointment.count({
      where: {
        doctorId: userId,
        appointmentDate: dateFilter
      }
    }),
    prisma.prescription.count({
      where: {
        doctorId: userId,
        issuedDate: dateFilter
      }
    }),
    prisma.appointment.count({
      where: {
        doctorId: userId,
        appointmentDate: dateFilter
      },
      distinct: ['patientId']
    }),
    prisma.labResult.count({
      where: {
        reviewedById: userId,
        orderedDate: dateFilter
      }
    })
  ]);

  return {
    appointments,
    prescriptions,
    patients,
    labResults
  };
}

// Pharmacist dashboard data
async function getPharmacistDashboard(userId, dateFilter) {
  const [prescriptions, inventory, dispensed] = await Promise.all([
    prisma.prescription.count({
      where: {
        pharmacistId: userId,
        issuedDate: dateFilter
      }
    }),
    prisma.inventoryItem.count({
      where: {
        pharmacistId: userId,
        isActive: true
      }
    }),
    prisma.prescriptionItem.count({
      where: {
        prescription: {
          pharmacistId: userId
        },
        dispensedAt: dateFilter,
        isDispensed: true
      }
    })
  ]);

  return {
    prescriptions,
    inventoryItems: inventory,
    dispensedItems: dispensed
  };
}

// Admin dashboard data
async function getAdminDashboard(dateFilter) {
  const [users, appointments, prescriptions, payments] = await Promise.all([
    prisma.user.count({
      where: {
        createdAt: dateFilter,
        isActive: true
      }
    }),
    prisma.appointment.count({
      where: { appointmentDate: dateFilter }
    }),
    prisma.prescription.count({
      where: { issuedDate: dateFilter }
    }),
    prisma.payment.aggregate({
      where: {
        createdAt: dateFilter,
        status: 'COMPLETED'
      },
      _sum: { amount: true },
      _count: { id: true }
    })
  ]);

  return {
    newUsers: users,
    appointments,
    prescriptions,
    payments: payments._count.id,
    revenue: payments._sum.amount || 0
  };
}

// Helper function to get user daily activity
async function getUserDailyActivity(userId, dayStart, dayEnd) {
  const [appointments, prescriptions, messages, logins] = await Promise.all([
    prisma.appointment.count({
      where: {
        OR: [
          { patientId: userId },
          { doctorId: userId }
        ],
        appointmentDate: {
          gte: dayStart,
          lte: dayEnd
        }
      }
    }),
    prisma.prescription.count({
      where: {
        OR: [
          { patientId: userId },
          { doctorId: userId }
        ],
        issuedDate: {
          gte: dayStart,
          lte: dayEnd
        }
      }
    }),
    prisma.chatMessage.count({
      where: {
        senderId: userId,
        createdAt: {
          gte: dayStart,
          lte: dayEnd
        }
      }
    }),
    // Note: You would need to implement login tracking for this
    0 // Placeholder for login count
  ]);

  return {
    appointments,
    prescriptions,
    messages,
    logins
  };
}

// Helper function to calculate health trends from vitals
function calculateHealthTrends(vitals) {
  if (vitals.length < 2) return {};

  const latest = vitals[0];
  const previous = vitals[1];

  const trends = {};

  if (latest.bloodPressureSystolic && previous.bloodPressureSystolic) {
    trends.bloodPressure = {
      current: `${latest.bloodPressureSystolic}/${latest.bloodPressureDiastolic}`,
      trend: latest.bloodPressureSystolic > previous.bloodPressureSystolic ? 'up' : 
             latest.bloodPressureSystolic < previous.bloodPressureSystolic ? 'down' : 'stable'
    };
  }

  if (latest.weight && previous.weight) {
    trends.weight = {
      current: latest.weight,
      change: (latest.weight - previous.weight).toFixed(1),
      trend: latest.weight > previous.weight ? 'up' : 
             latest.weight < previous.weight ? 'down' : 'stable'
    };
  }

  return trends;
}

module.exports = analyticsController;