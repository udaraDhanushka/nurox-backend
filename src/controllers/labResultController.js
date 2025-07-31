const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const labResultController = {
  // Create new lab result
  createLabResult: async (req, res) => {
    try {
      const {
        patientId,
        appointmentId,
        testName,
        testType,
        orderedDate,
        labName,
        technicianName,
        notes,
      } = req.body;

      // Only doctors can order lab tests
      if (req.user.role !== 'DOCTOR') {
        return res.status(403).json({
          success: false,
          message: 'Only doctors can order lab tests',
        });
      }

      const labResult = await prisma.labResult.create({
        data: {
          patientId,
          appointmentId,
          testName,
          testType,
          orderedDate: orderedDate ? new Date(orderedDate) : new Date(),
          labName,
          technicianName,
          notes,
        },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          appointment: {
            select: {
              id: true,
              appointmentDate: true,
              type: true,
            },
          },
        },
      });

      // Create notification for patient
      await prisma.notification.create({
        data: {
          userId: patientId,
          type: 'LAB_RESULT',
          title: 'Lab Test Ordered',
          message: `A ${testName} test has been ordered for you`,
          data: { labResultId: labResult.id },
        },
      });

      logger.info(
        `Lab result created: ${labResult.id} by Dr. ${req.user.email}`
      );

      res.status(201).json({
        success: true,
        message: 'Lab test ordered successfully',
        data: labResult,
      });
    } catch (error) {
      logger.error('Create lab result error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create lab result',
      });
    }
  },

  // Get lab results
  getLabResults: async (req, res) => {
    try {
      const {
        status,
        testType,
        patientId,
        startDate,
        endDate,
        page = 1,
        limit = 20,
      } = req.query;

      const skip = (page - 1) * limit;
      const where = {};

      // Filter by user role
      if (req.user.role === 'PATIENT') {
        where.patientId = req.user.id;
      } else if (req.user.role === 'DOCTOR') {
        // Doctors can see results they reviewed or for their patients
        where.OR = [
          { reviewedById: req.user.id },
          {
            appointment: {
              doctorId: req.user.id,
            },
          },
        ];
      }

      // Apply filters
      if (status) where.status = status;
      if (testType) where.testType = testType;
      if (patientId && req.user.role === 'DOCTOR') where.patientId = patientId;
      if (startDate || endDate) {
        where.orderedDate = {};
        if (startDate) where.orderedDate.gte = new Date(startDate);
        if (endDate) where.orderedDate.lte = new Date(endDate);
      }

      const [labResults, total] = await Promise.all([
        prisma.labResult.findMany({
          where,
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                profileImage: true,
              },
            },
            appointment: {
              select: {
                id: true,
                appointmentDate: true,
                type: true,
                doctor: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    doctorProfile: true,
                  },
                },
              },
            },
            reviewedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                doctorProfile: true,
              },
            },
          },
          orderBy: { orderedDate: 'desc' },
          skip: parseInt(skip),
          take: parseInt(limit),
        }),
        prisma.labResult.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          labResults,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Get lab results error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get lab results',
      });
    }
  },

  // Get single lab result
  getLabResult: async (req, res) => {
    try {
      const { id } = req.params;

      const labResult = await prisma.labResult.findUnique({
        where: { id },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              profileImage: true,
              patientProfile: true,
            },
          },
          appointment: {
            select: {
              id: true,
              appointmentDate: true,
              type: true,
              doctor: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  doctorProfile: true,
                },
              },
            },
          },
          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              doctorProfile: true,
            },
          },
        },
      });

      if (!labResult) {
        return res.status(404).json({
          success: false,
          message: 'Lab result not found',
        });
      }

      // Check authorization
      const hasAccess =
        labResult.patientId === req.user.id ||
        labResult.reviewedById === req.user.id ||
        (labResult.appointment &&
          labResult.appointment.doctor.id === req.user.id);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      res.json({
        success: true,
        data: labResult,
      });
    } catch (error) {
      logger.error('Get lab result error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get lab result',
      });
    }
  },

  // Update lab result
  updateLabResult: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        status,
        results,
        normalRanges,
        isAbnormal,
        notes,
        completedDate,
      } = req.body;

      const labResult = await prisma.labResult.findUnique({
        where: { id },
        include: {
          patient: true,
        },
      });

      if (!labResult) {
        return res.status(404).json({
          success: false,
          message: 'Lab result not found',
        });
      }

      // Only doctors or lab technicians can update results
      if (req.user.role !== 'DOCTOR') {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      const updateData = {};
      if (status !== undefined) updateData.status = status;
      if (results !== undefined) updateData.results = results;
      if (normalRanges !== undefined) updateData.normalRanges = normalRanges;
      if (isAbnormal !== undefined) updateData.isAbnormal = isAbnormal;
      if (notes !== undefined) updateData.notes = notes;
      if (completedDate !== undefined)
        updateData.completedDate = new Date(completedDate);

      // Set reviewed fields if marking as completed
      if (status === 'COMPLETED' || status === 'REVIEWED') {
        updateData.reviewedById = req.user.id;
        updateData.reviewedDate = new Date();
      }

      const updatedLabResult = await prisma.labResult.update({
        where: { id },
        data: updateData,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Create notification for patient when results are ready
      if (status === 'COMPLETED') {
        await prisma.notification.create({
          data: {
            userId: labResult.patientId,
            type: 'LAB_RESULT',
            title: 'Lab Results Ready',
            message: `Your ${labResult.testName} results are now available`,
            data: { labResultId: id },
          },
        });
      }

      logger.info(`Lab result updated: ${id} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Lab result updated successfully',
        data: updatedLabResult,
      });
    } catch (error) {
      logger.error('Update lab result error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update lab result',
      });
    }
  },

  // Delete lab result
  deleteLabResult: async (req, res) => {
    try {
      const { id } = req.params;

      const labResult = await prisma.labResult.findUnique({
        where: { id },
      });

      if (!labResult) {
        return res.status(404).json({
          success: false,
          message: 'Lab result not found',
        });
      }

      // Only the ordering doctor or admin can delete
      if (req.user.role !== 'DOCTOR' && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      await prisma.labResult.delete({
        where: { id },
      });

      logger.info(`Lab result deleted: ${id} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Lab result deleted successfully',
      });
    } catch (error) {
      logger.error('Delete lab result error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete lab result',
      });
    }
  },

  // Get available lab tests
  getAvailableTests: async (req, res) => {
    try {
      // This would typically come from a lab tests configuration
      const availableTests = [
        {
          id: 'cbc',
          name: 'Complete Blood Count (CBC)',
          category: 'Hematology',
          description: 'Measures different components of blood',
          normalFasting: false,
          estimatedTime: '24 hours',
          price: 25.0,
        },
        {
          id: 'lipid_panel',
          name: 'Lipid Panel',
          category: 'Chemistry',
          description: 'Cholesterol and triglyceride levels',
          normalFasting: true,
          estimatedTime: '24 hours',
          price: 35.0,
        },
        {
          id: 'thyroid_function',
          name: 'Thyroid Function Test',
          category: 'Endocrinology',
          description: 'TSH, T3, T4 levels',
          normalFasting: false,
          estimatedTime: '48 hours',
          price: 45.0,
        },
        {
          id: 'glucose_fasting',
          name: 'Fasting Glucose',
          category: 'Chemistry',
          description: 'Blood sugar level after fasting',
          normalFasting: true,
          estimatedTime: '12 hours',
          price: 15.0,
        },
        {
          id: 'hba1c',
          name: 'Hemoglobin A1C',
          category: 'Chemistry',
          description: 'Average blood sugar over 3 months',
          normalFasting: false,
          estimatedTime: '24 hours',
          price: 30.0,
        },
        {
          id: 'vitamin_d',
          name: 'Vitamin D',
          category: 'Chemistry',
          description: '25-Hydroxy Vitamin D level',
          normalFasting: false,
          estimatedTime: '48 hours',
          price: 40.0,
        },
      ];

      res.json({
        success: true,
        data: availableTests,
      });
    } catch (error) {
      logger.error('Get available tests error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get available tests',
      });
    }
  },

  // Get lab result analytics
  getLabResultAnalytics: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const where = {};
      if (req.user.role === 'PATIENT') {
        where.patientId = req.user.id;
      } else if (req.user.role === 'DOCTOR') {
        where.OR = [
          { reviewedById: req.user.id },
          {
            appointment: {
              doctorId: req.user.id,
            },
          },
        ];
      }

      if (startDate || endDate) {
        where.orderedDate = {};
        if (startDate) where.orderedDate.gte = new Date(startDate);
        if (endDate) where.orderedDate.lte = new Date(endDate);
      }

      const [total, pending, inProgress, completed, abnormal, testsByType] =
        await Promise.all([
          prisma.labResult.count({ where }),
          prisma.labResult.count({ where: { ...where, status: 'PENDING' } }),
          prisma.labResult.count({
            where: { ...where, status: 'IN_PROGRESS' },
          }),
          prisma.labResult.count({ where: { ...where, status: 'COMPLETED' } }),
          prisma.labResult.count({ where: { ...where, isAbnormal: true } }),
          prisma.labResult.groupBy({
            by: ['testType'],
            where,
            _count: {
              testType: true,
            },
          }),
        ]);

      res.json({
        success: true,
        data: {
          total,
          statusBreakdown: {
            pending,
            inProgress,
            completed,
          },
          abnormalResults: abnormal,
          testsByType: testsByType.map((item) => ({
            testType: item.testType,
            count: item._count.testType,
          })),
        },
      });
    } catch (error) {
      logger.error('Get lab result analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get lab result analytics',
      });
    }
  },
};

module.exports = labResultController;
