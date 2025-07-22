const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const organizationController = {
  // Hospital Management
  
  // Create new hospital (Super Admin only)
  createHospital: async (req, res) => {
    try {
      const {
        name,
        registrationNumber,
        address,
        phone,
        email,
        website,
        description,
        specialties,
        bedCount,
        emergencyServices,
        licenseNumber,
        licenseExpiry,
        accreditation,
        contactPerson,
        contactPhone,
        contactEmail
      } = req.body;

      // Check if hospital already exists
      const existingHospital = await prisma.hospital.findFirst({
        where: {
          OR: [
            { registrationNumber },
            { licenseNumber }
          ]
        }
      });

      if (existingHospital) {
        return res.status(400).json({
          success: false,
          message: 'Hospital with this registration number or license already exists'
        });
      }

      const hospital = await prisma.hospital.create({
        data: {
          name,
          registrationNumber,
          address,
          phone,
          email,
          website,
          description,
          specialties: specialties || [],
          bedCount,
          emergencyServices: emergencyServices || false,
          licenseNumber,
          licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
          accreditation,
          contactPerson,
          contactPhone,
          contactEmail,
          status: 'ACTIVE' // Super admin can directly activate
        }
      });

      logger.info(`Hospital created by super admin: ${hospital.name}`);

      res.status(201).json({
        success: true,
        message: 'Hospital created successfully',
        data: hospital
      });
    } catch (error) {
      logger.error('Create hospital error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create hospital'
      });
    }
  },

  // Get all hospitals
  getAllHospitals: async (req, res) => {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      const where = {};
      if (status) where.status = status;

      const hospitals = await prisma.hospital.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        include: {
          users: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              isActive: true
            }
          },
          ownedPharmacies: {
            select: {
              id: true,
              name: true,
              status: true
            }
          },
          ownedLabs: {
            select: {
              id: true,
              name: true,
              status: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const total = await prisma.hospital.count({ where });

      res.json({
        success: true,
        data: {
          hospitals,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Get hospitals error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get hospitals'
      });
    }
  },

  // Get hospital by ID
  getHospitalById: async (req, res) => {
    try {
      const { id } = req.params;

      const hospital = await prisma.hospital.findUnique({
        where: { id },
        include: {
          users: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              isActive: true,
              doctorProfile: {
                select: {
                  specialization: true,
                  licenseNumber: true,
                  verificationStatus: true
                }
              }
            }
          },
          ownedPharmacies: true,
          ownedLabs: true
        }
      });

      if (!hospital) {
        return res.status(404).json({
          success: false,
          message: 'Hospital not found'
        });
      }

      res.json({
        success: true,
        data: hospital
      });
    } catch (error) {
      logger.error('Get hospital error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get hospital'
      });
    }
  },

  // Update hospital
  updateHospital: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Remove fields that shouldn't be updated directly
      delete updateData.id;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      if (updateData.licenseExpiry) {
        updateData.licenseExpiry = new Date(updateData.licenseExpiry);
      }

      const hospital = await prisma.hospital.update({
        where: { id },
        data: updateData,
        include: {
          users: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          }
        }
      });

      logger.info(`Hospital updated: ${hospital.name}`);

      res.json({
        success: true,
        message: 'Hospital updated successfully',
        data: hospital
      });
    } catch (error) {
      logger.error('Update hospital error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update hospital'
      });
    }
  },

  // Delete hospital
  deleteHospital: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if hospital has users
      const hospitalUsers = await prisma.user.count({
        where: { hospitalId: id }
      });

      if (hospitalUsers > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete hospital with active users. Please reassign users first.'
        });
      }

      await prisma.hospital.delete({
        where: { id }
      });

      logger.info(`Hospital deleted: ${id}`);

      res.json({
        success: true,
        message: 'Hospital deleted successfully'
      });
    } catch (error) {
      logger.error('Delete hospital error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete hospital'
      });
    }
  },

  // Doctor verification by hospital
  getDoctorVerificationRequests: async (req, res) => {
    try {
      const { hospitalId } = req.params;
      const { status = 'PENDING' } = req.query;

      // Check if user has permission to view this hospital's requests
      if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId !== hospitalId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const doctors = await prisma.user.findMany({
        where: {
          hospitalId,
          role: 'DOCTOR',
          doctorProfile: {
            verificationStatus: status
          }
        },
        include: {
          doctorProfile: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.json({
        success: true,
        data: doctors
      });
    } catch (error) {
      logger.error('Get doctor verification requests error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get doctor verification requests'
      });
    }
  },

  // Approve/Reject doctor verification
  updateDoctorVerification: async (req, res) => {
    try {
      const { hospitalId, doctorId } = req.params;
      const { status, rejectionReason } = req.body;

      // Check if user has permission
      if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId !== hospitalId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const doctor = await prisma.user.findFirst({
        where: {
          id: doctorId,
          hospitalId,
          role: 'DOCTOR'
        },
        include: {
          doctorProfile: true
        }
      });

      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }

      const updateData = {
        verificationStatus: status,
        approvedBy: req.user.id
      };

      if (status === 'APPROVED') {
        updateData.approvedAt = new Date();
        updateData.isVerified = true;
      } else if (status === 'REJECTED') {
        updateData.rejectionReason = rejectionReason;
      }

      await prisma.doctorProfile.update({
        where: { userId: doctorId },
        data: updateData
      });

      // Send notification to doctor
      await prisma.notification.create({
        data: {
          userId: doctorId,
          type: 'SYSTEM_ALERT',
          title: `Doctor Verification ${status}`,
          message: status === 'APPROVED' 
            ? 'Your doctor verification has been approved. You can now start accepting appointments.'
            : `Your doctor verification has been rejected. Reason: ${rejectionReason || 'Not specified'}`,
          data: {
            hospitalId,
            status,
            rejectionReason
          }
        }
      });

      logger.info(`Doctor verification updated: ${doctorId} - ${status}`);

      res.json({
        success: true,
        message: `Doctor verification ${status.toLowerCase()} successfully`
      });
    } catch (error) {
      logger.error('Update doctor verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update doctor verification'
      });
    }
  },

  // Pharmacy Management
  createPharmacy: async (req, res) => {
    try {
      const {
        name,
        registrationNumber,
        address,
        phone,
        email,
        website,
        description,
        operatingHours,
        licenseNumber,
        licenseExpiry,
        contactPerson,
        contactPhone,
        contactEmail,
        hospitalId
      } = req.body;

      const existingPharmacy = await prisma.pharmacy.findFirst({
        where: {
          OR: [
            { registrationNumber },
            { licenseNumber }
          ]
        }
      });

      if (existingPharmacy) {
        return res.status(400).json({
          success: false,
          message: 'Pharmacy with this registration number or license already exists'
        });
      }

      const pharmacy = await prisma.pharmacy.create({
        data: {
          name,
          registrationNumber,
          address,
          phone,
          email,
          website,
          description,
          operatingHours,
          licenseNumber,
          licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
          contactPerson,
          contactPhone,
          contactEmail,
          hospitalId,
          status: 'ACTIVE'
        }
      });

      logger.info(`Pharmacy created: ${pharmacy.name}`);

      res.status(201).json({
        success: true,
        message: 'Pharmacy created successfully',
        data: pharmacy
      });
    } catch (error) {
      logger.error('Create pharmacy error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create pharmacy'
      });
    }
  },

  // Laboratory Management
  createLaboratory: async (req, res) => {
    try {
      const {
        name,
        registrationNumber,
        address,
        phone,
        email,
        website,
        description,
        testTypes,
        operatingHours,
        licenseNumber,
        licenseExpiry,
        accreditation,
        contactPerson,
        contactPhone,
        contactEmail,
        hospitalId
      } = req.body;

      const existingLab = await prisma.laboratory.findFirst({
        where: {
          OR: [
            { registrationNumber },
            { licenseNumber }
          ]
        }
      });

      if (existingLab) {
        return res.status(400).json({
          success: false,
          message: 'Laboratory with this registration number or license already exists'
        });
      }

      const laboratory = await prisma.laboratory.create({
        data: {
          name,
          registrationNumber,
          address,
          phone,
          email,
          website,
          description,
          testTypes: testTypes || [],
          operatingHours,
          licenseNumber,
          licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
          accreditation,
          contactPerson,
          contactPhone,
          contactEmail,
          hospitalId,
          status: 'ACTIVE'
        }
      });

      logger.info(`Laboratory created: ${laboratory.name}`);

      res.status(201).json({
        success: true,
        message: 'Laboratory created successfully',
        data: laboratory
      });
    } catch (error) {
      logger.error('Create laboratory error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create laboratory'
      });
    }
  },

  // Insurance Company Management
  createInsuranceCompany: async (req, res) => {
    try {
      const {
        name,
        registrationNumber,
        address,
        phone,
        email,
        website,
        description,
        coverageTypes,
        licenseNumber,
        licenseExpiry,
        contactPerson,
        contactPhone,
        contactEmail
      } = req.body;

      const existingInsurance = await prisma.insuranceCompany.findFirst({
        where: {
          OR: [
            { registrationNumber },
            { licenseNumber }
          ]
        }
      });

      if (existingInsurance) {
        return res.status(400).json({
          success: false,
          message: 'Insurance company with this registration number or license already exists'
        });
      }

      const insuranceCompany = await prisma.insuranceCompany.create({
        data: {
          name,
          registrationNumber,
          address,
          phone,
          email,
          website,
          description,
          coverageTypes: coverageTypes || [],
          licenseNumber,
          licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
          contactPerson,
          contactPhone,
          contactEmail,
          status: 'ACTIVE'
        }
      });

      logger.info(`Insurance company created: ${insuranceCompany.name}`);

      res.status(201).json({
        success: true,
        message: 'Insurance company created successfully',
        data: insuranceCompany
      });
    } catch (error) {
      logger.error('Create insurance company error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create insurance company'
      });
    }
  },

  // Get all organizations (for super admin dashboard)
  getAllOrganizations: async (req, res) => {
    try {
      const [hospitals, pharmacies, laboratories, insuranceCompanies] = await Promise.all([
        prisma.hospital.findMany({
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            _count: {
              select: {
                users: true
              }
            }
          }
        }),
        prisma.pharmacy.findMany({
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            hospitalId: true,
            _count: {
              select: {
                users: true
              }
            }
          }
        }),
        prisma.laboratory.findMany({
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            hospitalId: true,
            _count: {
              select: {
                users: true
              }
            }
          }
        }),
        prisma.insuranceCompany.findMany({
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            _count: {
              select: {
                users: true
              }
            }
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          hospitals,
          pharmacies,
          laboratories,
          insuranceCompanies,
          summary: {
            totalHospitals: hospitals.length,
            totalPharmacies: pharmacies.length,
            totalLaboratories: laboratories.length,
            totalInsuranceCompanies: insuranceCompanies.length
          }
        }
      });
    } catch (error) {
      logger.error('Get all organizations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get organizations'
      });
    }
  }
};

module.exports = organizationController;