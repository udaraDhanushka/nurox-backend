const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const userController = {
  // Get user profile
  getProfile: async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          patientProfile: true,
          doctorProfile: true,
          pharmacistProfile: true
        }
      });

      const { password: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        data: userWithoutPassword
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get profile'
      });
    }
  },

  // Update user profile
  updateProfile: async (req, res) => {
    try {
      const { firstName, lastName, phone, dateOfBirth, profileImage, language } = req.body;

      const updateData = {};
      
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (phone !== undefined) updateData.phone = phone;
      if (dateOfBirth !== undefined) updateData.dateOfBirth = new Date(dateOfBirth);
      if (profileImage !== undefined) updateData.profileImage = profileImage;
      if (language !== undefined) updateData.language = language;

      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData,
        include: {
          patientProfile: true,
          doctorProfile: true,
          pharmacistProfile: true
        }
      });

      const { password: _, ...userWithoutPassword } = updatedUser;

      logger.info(`Profile updated for user: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: userWithoutPassword
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    }
  },

  // Update patient profile
  updatePatientProfile: async (req, res) => {
    try {
      if (req.user.role !== 'PATIENT') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Patient role required.'
        });
      }

      const {
        emergencyContact,
        emergencyPhone,
        bloodType,
        height,
        weight,
        occupation,
        address,
        city,
        zipCode,
        country,
        insuranceProvider,
        insuranceNumber
      } = req.body;

      const updateData = {};
      if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact;
      if (emergencyPhone !== undefined) updateData.emergencyPhone = emergencyPhone;
      if (bloodType !== undefined) updateData.bloodType = bloodType;
      if (height !== undefined) updateData.height = height;
      if (weight !== undefined) updateData.weight = weight;
      if (occupation !== undefined) updateData.occupation = occupation;
      if (address !== undefined) updateData.address = address;
      if (city !== undefined) updateData.city = city;
      if (zipCode !== undefined) updateData.zipCode = zipCode;
      if (country !== undefined) updateData.country = country;
      if (insuranceProvider !== undefined) updateData.insuranceProvider = insuranceProvider;
      if (insuranceNumber !== undefined) updateData.insuranceNumber = insuranceNumber;

      const updatedProfile = await prisma.patientProfile.upsert({
        where: { userId: req.user.id },
        update: updateData,
        create: {
          userId: req.user.id,
          ...updateData
        }
      });

      logger.info(`Patient profile updated for user: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Patient profile updated successfully',
        data: updatedProfile
      });
    } catch (error) {
      logger.error('Update patient profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update patient profile'
      });
    }
  },

  // Update doctor profile
  updateDoctorProfile: async (req, res) => {
    try {
      if (req.user.role !== 'DOCTOR') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Doctor role required.'
        });
      }

      const {
        specialization,
        licenseNumber,
        hospitalAffiliation,
        clinicAddress,
        consultationFee,
        experience,
        qualifications,
        availableHours
      } = req.body;

      const updateData = {};
      if (specialization !== undefined) updateData.specialization = specialization;
      if (licenseNumber !== undefined) updateData.licenseNumber = licenseNumber;
      if (hospitalAffiliation !== undefined) updateData.hospitalAffiliation = hospitalAffiliation;
      if (clinicAddress !== undefined) updateData.clinicAddress = clinicAddress;
      if (consultationFee !== undefined) updateData.consultationFee = consultationFee;
      if (experience !== undefined) updateData.experience = experience;
      if (qualifications !== undefined) updateData.qualifications = qualifications;
      if (availableHours !== undefined) updateData.availableHours = availableHours;

      const updatedProfile = await prisma.doctorProfile.upsert({
        where: { userId: req.user.id },
        update: updateData,
        create: {
          userId: req.user.id,
          specialization: specialization || 'General Practice',
          licenseNumber: licenseNumber || `DOC${Date.now()}`,
          ...updateData
        }
      });

      logger.info(`Doctor profile updated for user: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Doctor profile updated successfully',
        data: updatedProfile
      });
    } catch (error) {
      logger.error('Update doctor profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update doctor profile'
      });
    }
  },

  // Update pharmacist profile
  updatePharmacistProfile: async (req, res) => {
    try {
      if (req.user.role !== 'PHARMACIST') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Pharmacist role required.'
        });
      }

      const {
        licenseNumber,
        pharmacyAffiliation,
        pharmacyAddress,
        workingHours
      } = req.body;

      const updateData = {};
      if (licenseNumber !== undefined) updateData.licenseNumber = licenseNumber;
      if (pharmacyAffiliation !== undefined) updateData.pharmacyAffiliation = pharmacyAffiliation;
      if (pharmacyAddress !== undefined) updateData.pharmacyAddress = pharmacyAddress;
      if (workingHours !== undefined) updateData.workingHours = workingHours;

      const updatedProfile = await prisma.pharmacistProfile.upsert({
        where: { userId: req.user.id },
        update: updateData,
        create: {
          userId: req.user.id,
          licenseNumber: licenseNumber || `PHARM${Date.now()}`,
          ...updateData
        }
      });

      logger.info(`Pharmacist profile updated for user: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Pharmacist profile updated successfully',
        data: updatedProfile
      });
    } catch (error) {
      logger.error('Update pharmacist profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update pharmacist profile'
      });
    }
  },

  // Get user's role-specific data
  getRoleSpecificData: async (req, res) => {
    try {
      const includeData = {
        patientProfile: req.user.role === 'PATIENT',
        doctorProfile: req.user.role === 'DOCTOR',
        pharmacistProfile: req.user.role === 'PHARMACIST'
      };

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: includeData
      });

      const roleProfile = user.patientProfile || user.doctorProfile || user.pharmacistProfile;

      res.json({
        success: true,
        data: {
          role: req.user.role,
          profile: roleProfile
        }
      });
    } catch (error) {
      logger.error('Get role-specific data error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get role-specific data'
      });
    }
  },

  // Delete user account
  deleteAccount: async (req, res) => {
    try {
      const { password } = req.body;

      // Verify password before deletion
      const user = await prisma.user.findUnique({
        where: { id: req.user.id }
      });

      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Password is incorrect'
        });
      }

      // Soft delete by setting isActive to false
      await prisma.user.update({
        where: { id: req.user.id },
        data: { isActive: false }
      });

      // Revoke all sessions
      await prisma.session.deleteMany({
        where: { userId: req.user.id }
      });

      logger.info(`Account deleted for user: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      logger.error('Delete account error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete account'
      });
    }
  },

  // Update user language preference
  updateLanguage: async (req, res) => {
    try {
      const { language } = req.body;

      await prisma.user.update({
        where: { id: req.user.id },
        data: { language }
      });

      logger.info(`Language updated for user: ${req.user.email} to ${language}`);

      res.json({
        success: true,
        message: 'Language preference updated successfully'
      });
    } catch (error) {
      logger.error('Update language error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update language preference'
      });
    }
  }
};

module.exports = userController;