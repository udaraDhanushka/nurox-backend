const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const patientController = {
  // Get patient profile by ID (for doctors/pharmacists)
  getPatientProfile: async (req, res) => {
    try {
      const { patientId } = req.params;

      // Verify requester has appropriate access
      if (
        req.user.role !== 'DOCTOR' &&
        req.user.role !== 'PHARMACIST' &&
        req.user.role !== 'SUPER_ADMIN'
      ) {
        return res.status(403).json({
          success: false,
          message:
            'Access denied. Only doctors, pharmacists, and admins can access patient profiles.',
        });
      }

      const patient = await prisma.user.findUnique({
        where: {
          id: patientId,
          role: 'PATIENT',
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          dateOfBirth: true,
          profileImage: true,
          createdAt: true,
          updatedAt: true,
          patientProfile: {
            select: {
              emergencyContact: true,
              emergencyPhone: true,
              bloodType: true,
              height: true,
              weight: true,
              occupation: true,
              address: true,
              city: true,
              zipCode: true,
              country: true,
              insuranceProvider: true,
              insuranceNumber: true,
            },
          },
        },
      });

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found',
        });
      }

      // Calculate age if dateOfBirth exists
      let age = null;
      if (patient.dateOfBirth) {
        const birthDate = new Date(patient.dateOfBirth);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ) {
          age--;
        }
      }

      const responseData = {
        ...patient,
        age,
        name: `${patient.firstName} ${patient.lastName}`,
        ...patient.patientProfile,
      };

      // Remove the nested patientProfile object
      delete responseData.patientProfile;

      logger.info(
        `Patient profile accessed: ${patientId} by ${req.user.role}: ${req.user.email}`
      );

      res.json({
        success: true,
        data: responseData,
      });
    } catch (error) {
      logger.error('Get patient profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get patient profile',
      });
    }
  },

  // Get patient by ID with basic info (for appointments, prescriptions)
  getPatientById: async (req, res) => {
    try {
      const { patientId } = req.params;

      // Verify requester has appropriate access
      if (
        req.user.role !== 'DOCTOR' &&
        req.user.role !== 'PHARMACIST' &&
        req.user.role !== 'SUPER_ADMIN'
      ) {
        return res.status(403).json({
          success: false,
          message:
            'Access denied. Only doctors, pharmacists, and admins can access patient information.',
        });
      }

      const patient = await prisma.user.findUnique({
        where: {
          id: patientId,
          role: 'PATIENT',
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          dateOfBirth: true,
          profileImage: true,
          updatedAt: true,
        },
      });

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found',
        });
      }

      // Calculate age if dateOfBirth exists
      let age = null;
      if (patient.dateOfBirth) {
        const birthDate = new Date(patient.dateOfBirth);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ) {
          age--;
        }
      }

      const responseData = {
        ...patient,
        age,
        name: `${patient.firstName} ${patient.lastName}`,
      };

      res.json({
        success: true,
        data: responseData,
      });
    } catch (error) {
      logger.error('Get patient by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get patient information',
      });
    }
  },

  // Get patient last updated timestamp for cache validation
  getPatientLastUpdated: async (req, res) => {
    try {
      const { patientId } = req.params;

      // Verify requester has appropriate access
      if (
        req.user.role !== 'DOCTOR' &&
        req.user.role !== 'PHARMACIST' &&
        req.user.role !== 'SUPER_ADMIN'
      ) {
        return res.status(403).json({
          success: false,
          message: 'Access denied.',
        });
      }

      const patient = await prisma.user.findUnique({
        where: {
          id: patientId,
          role: 'PATIENT',
          isActive: true,
        },
        select: {
          updatedAt: true,
        },
      });

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found',
        });
      }

      res.json({
        success: true,
        data: {
          lastUpdated: patient.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      logger.error('Get patient last updated error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get patient update time',
      });
    }
  },
};

module.exports = patientController;
