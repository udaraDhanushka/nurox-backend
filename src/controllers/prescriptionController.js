const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const prescriptionController = {
  // Create new prescription
  createPrescription: async (req, res) => {
    try {
      const {
        patientId,
        appointmentId,
        diagnosis,
        notes,
        expiryDate,
        items,
        ocrProcessed = false,
        ocrConfidence,
        originalImage
      } = req.body;

      // Verify doctor role
      if (req.user.role !== 'DOCTOR') {
        return res.status(403).json({
          success: false,
          message: 'Only doctors can create prescriptions'
        });
      }

      const prescription = await prisma.prescription.create({
        data: {
          patientId,
          doctorId: req.user.id,
          appointmentId,
          diagnosis,
          notes,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          ocrProcessed,
          ocrConfidence,
          originalImage,
          items: {
            create: items.map(item => ({
              medicineId: item.medicineId,
              dosage: item.dosage,
              frequency: item.frequency,
              duration: item.duration,
              quantity: item.quantity,
              instructions: item.instructions
            }))
          }
        },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              doctorProfile: true
            }
          },
          items: {
            include: {
              medicine: true
            }
          }
        }
      });

      // Create notification for patient
      await prisma.notification.create({
        data: {
          userId: patientId,
          type: 'PRESCRIPTION_READY',
          title: 'New Prescription',
          message: `Dr. ${req.user.firstName} ${req.user.lastName} has issued a new prescription for you`,
          data: { prescriptionId: prescription.id }
        }
      });

      logger.info(`Prescription created: ${prescription.id} by Dr. ${req.user.email}`);

      res.status(201).json({
        success: true,
        message: 'Prescription created successfully',
        data: prescription
      });
    } catch (error) {
      logger.error('Create prescription error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create prescription'
      });
    }
  },

  // Get prescriptions
  getPrescriptions: async (req, res) => {
    try {
      const {
        status,
        patientId,
        doctorId,
        startDate,
        endDate,
        page = 1,
        limit = 20
      } = req.query;

      const skip = (page - 1) * limit;
      const where = {};

      // Filter by user role
      if (req.user.role === 'PATIENT') {
        where.patientId = req.user.id;
      } else if (req.user.role === 'DOCTOR') {
        where.doctorId = req.user.id;
      } else if (req.user.role === 'PHARMACIST') {
        // Pharmacists can see prescriptions assigned to them
        where.pharmacistId = req.user.id;
      }

      // Apply additional filters
      if (status) where.status = status;
      if (patientId && req.user.role === 'DOCTOR') where.patientId = patientId;
      if (doctorId && req.user.role === 'PATIENT') where.doctorId = doctorId;
      if (startDate || endDate) {
        where.issuedDate = {};
        if (startDate) where.issuedDate.gte = new Date(startDate);
        if (endDate) where.issuedDate.lte = new Date(endDate);
      }

      const [prescriptions, total] = await Promise.all([
        prisma.prescription.findMany({
          where,
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                profileImage: true
              }
            },
            doctor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                doctorProfile: true
              }
            },
            pharmacist: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                pharmacistProfile: true
              }
            },
            items: {
              include: {
                medicine: true
              }
            }
          },
          orderBy: { issuedDate: 'desc' },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.prescription.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          prescriptions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Get prescriptions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get prescriptions'
      });
    }
  },

  // Get single prescription
  getPrescription: async (req, res) => {
    try {
      const { id } = req.params;

      const prescription = await prisma.prescription.findUnique({
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
              patientProfile: true
            }
          },
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              doctorProfile: true
            }
          },
          pharmacist: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              pharmacistProfile: true
            }
          },
          items: {
            include: {
              medicine: true
            }
          },
          appointment: {
            select: {
              id: true,
              appointmentDate: true,
              type: true
            }
          }
        }
      });

      if (!prescription) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
      }

      // Check authorization
      const hasAccess = 
        prescription.patientId === req.user.id ||
        prescription.doctorId === req.user.id ||
        prescription.pharmacistId === req.user.id;

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: prescription
      });
    } catch (error) {
      logger.error('Get prescription error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get prescription'
      });
    }
  },

  // Update prescription status
  updatePrescriptionStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, pharmacistId, notes } = req.body;

      const prescription = await prisma.prescription.findUnique({
        where: { id }
      });

      if (!prescription) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
      }

      // Check authorization
      const canUpdate = 
        (req.user.role === 'DOCTOR' && prescription.doctorId === req.user.id) ||
        (req.user.role === 'PHARMACIST');

      if (!canUpdate) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const updateData = { status };
      if (pharmacistId) updateData.pharmacistId = pharmacistId;
      if (notes) updateData.notes = notes;

      const updatedPrescription = await prisma.prescription.update({
        where: { id },
        data: updateData,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      // Create notification for status updates
      if (status) {
        await prisma.notification.create({
          data: {
            userId: prescription.patientId,
            type: 'PRESCRIPTION_READY',
            title: 'Prescription Updated',
            message: `Your prescription status has been updated to ${status}`,
            data: { prescriptionId: id }
          }
        });
      }

      logger.info(`Prescription updated: ${id} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Prescription updated successfully',
        data: updatedPrescription
      });
    } catch (error) {
      logger.error('Update prescription error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update prescription'
      });
    }
  },

  // Dispense prescription item
  dispensePrescriptionItem: async (req, res) => {
    try {
      const { itemId } = req.params;
      const { dispensedQuantity } = req.body;

      if (req.user.role !== 'PHARMACIST') {
        return res.status(403).json({
          success: false,
          message: 'Only pharmacists can dispense medications'
        });
      }

      const item = await prisma.prescriptionItem.findUnique({
        where: { id: itemId },
        include: {
          prescription: true,
          medicine: true
        }
      });

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Prescription item not found'
        });
      }

      await prisma.prescriptionItem.update({
        where: { id: itemId },
        data: {
          isDispensed: true,
          dispensedAt: new Date(),
          dispensedQuantity: dispensedQuantity || item.quantity
        }
      });

      // Update prescription pharmacist if not already set
      await prisma.prescription.update({
        where: { id: item.prescriptionId },
        data: {
          pharmacistId: req.user.id,
          status: 'DISPENSED'
        }
      });

      logger.info(`Prescription item dispensed: ${itemId} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Prescription item dispensed successfully'
      });
    } catch (error) {
      logger.error('Dispense prescription item error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to dispense prescription item'
      });
    }
  },

  // OCR Prescription Processing
  processOCRPrescription: async (req, res) => {
    try {
      const {
        patientId,
        imageUrl,
        ocrText,
        detectedMedicines,
        confidence
      } = req.body;

      const prescription = await prisma.prescription.create({
        data: {
          patientId,
          doctorId: req.user.id,
          diagnosis: 'OCR Processed Prescription',
          notes: ocrText,
          ocrProcessed: true,
          ocrConfidence: confidence,
          originalImage: imageUrl,
          status: 'PENDING',
          items: {
            create: detectedMedicines.map(med => ({
              medicine: {
                connectOrCreate: {
                  where: { name: med.name },
                  create: {
                    name: med.name,
                    type: 'OTHER',
                    strength: med.dosage || 'Unknown',
                    unit: 'MG'
                  }
                }
              },
              dosage: med.dosage || 'As directed',
              frequency: med.frequency || 'AS_NEEDED',
              duration: med.duration || '30 days',
              quantity: 30,
              instructions: med.instructions
            }))
          }
        },
        include: {
          items: {
            include: {
              medicine: true
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        message: 'OCR prescription processed successfully',
        data: prescription
      });
    } catch (error) {
      logger.error('OCR prescription processing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process OCR prescription'
      });
    }
  },

  // Get prescription analytics
  getPrescriptionAnalytics: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const where = {};
      if (req.user.role === 'DOCTOR') {
        where.doctorId = req.user.id;
      } else if (req.user.role === 'PHARMACIST') {
        where.pharmacistId = req.user.id;
      }

      if (startDate || endDate) {
        where.issuedDate = {};
        if (startDate) where.issuedDate.gte = new Date(startDate);
        if (endDate) where.issuedDate.lte = new Date(endDate);
      }

      const [
        total,
        pending,
        processing,
        ready,
        dispensed,
        cancelled
      ] = await Promise.all([
        prisma.prescription.count({ where }),
        prisma.prescription.count({ where: { ...where, status: 'PENDING' } }),
        prisma.prescription.count({ where: { ...where, status: 'PROCESSING' } }),
        prisma.prescription.count({ where: { ...where, status: 'READY' } }),
        prisma.prescription.count({ where: { ...where, status: 'DISPENSED' } }),
        prisma.prescription.count({ where: { ...where, status: 'CANCELLED' } })
      ]);

      res.json({
        success: true,
        data: {
          total,
          statusBreakdown: {
            pending,
            processing,
            ready,
            dispensed,
            cancelled
          }
        }
      });
    } catch (error) {
      logger.error('Get prescription analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get prescription analytics'
      });
    }
  }
};

module.exports = prescriptionController;