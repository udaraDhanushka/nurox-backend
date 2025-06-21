const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const medicineController = {
  // Create new medicine
  createMedicine: async (req, res) => {
    try {
      const {
        name,
        genericName,
        brand,
        type,
        strength,
        unit,
        description,
        sideEffects = [],
        contraindications = [],
        manufacturer,
        isControlled = false,
        requiresPrescription = true
      } = req.body;

      // Only doctors and pharmacists can add medicines
      if (!['DOCTOR', 'PHARMACIST', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.'
        });
      }

      const medicine = await prisma.medicine.create({
        data: {
          name,
          genericName,
          brand,
          type,
          strength,
          unit,
          description,
          sideEffects,
          contraindications,
          manufacturer,
          isControlled,
          requiresPrescription
        }
      });

      logger.info(`Medicine created: ${medicine.name} by ${req.user.email}`);

      res.status(201).json({
        success: true,
        message: 'Medicine created successfully',
        data: medicine
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          message: 'Medicine with this name already exists'
        });
      }
      
      logger.error('Create medicine error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create medicine'
      });
    }
  },

  // Get medicines with search and filtering
  getMedicines: async (req, res) => {
    try {
      const {
        search,
        type,
        isControlled,
        requiresPrescription,
        page = 1,
        limit = 20
      } = req.query;

      const skip = (page - 1) * limit;
      const where = { isActive: true };

      // Search functionality
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { genericName: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Filters
      if (type) where.type = type;
      if (isControlled !== undefined) where.isControlled = isControlled === 'true';
      if (requiresPrescription !== undefined) where.requiresPrescription = requiresPrescription === 'true';

      const [medicines, total] = await Promise.all([
        prisma.medicine.findMany({
          where,
          include: {
            _count: {
              select: {
                prescriptionItems: true
              }
            }
          },
          orderBy: { name: 'asc' },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.medicine.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          medicines,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Get medicines error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get medicines'
      });
    }
  },

  // Get single medicine
  getMedicine: async (req, res) => {
    try {
      const { id } = req.params;

      const medicine = await prisma.medicine.findUnique({
        where: { id },
        include: {
          interactions: {
            include: {
              medicineB: {
                select: {
                  id: true,
                  name: true,
                  genericName: true
                }
              }
            }
          },
          interactedWith: {
            include: {
              medicineA: {
                select: {
                  id: true,
                  name: true,
                  genericName: true
                }
              }
            }
          },
          inventoryItems: {
            where: {
              isActive: true,
              quantity: { gt: 0 }
            },
            include: {
              managedBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  pharmacistProfile: {
                    select: {
                      pharmacyAffiliation: true,
                      pharmacyAddress: true
                    }
                  }
                }
              }
            }
          },
          _count: {
            select: {
              prescriptionItems: true
            }
          }
        }
      });

      if (!medicine) {
        return res.status(404).json({
          success: false,
          message: 'Medicine not found'
        });
      }

      res.json({
        success: true,
        data: medicine
      });
    } catch (error) {
      logger.error('Get medicine error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get medicine'
      });
    }
  },

  // Update medicine
  updateMedicine: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Only doctors and pharmacists can update medicines
      if (!['DOCTOR', 'PHARMACIST', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.'
        });
      }

      const medicine = await prisma.medicine.findUnique({
        where: { id }
      });

      if (!medicine) {
        return res.status(404).json({
          success: false,
          message: 'Medicine not found'
        });
      }

      const updatedMedicine = await prisma.medicine.update({
        where: { id },
        data: updateData
      });

      logger.info(`Medicine updated: ${id} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Medicine updated successfully',
        data: updatedMedicine
      });
    } catch (error) {
      logger.error('Update medicine error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update medicine'
      });
    }
  },

  // Delete medicine (soft delete)
  deleteMedicine: async (req, res) => {
    try {
      const { id } = req.params;

      // Only admins can delete medicines
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin role required.'
        });
      }

      const medicine = await prisma.medicine.findUnique({
        where: { id }
      });

      if (!medicine) {
        return res.status(404).json({
          success: false,
          message: 'Medicine not found'
        });
      }

      await prisma.medicine.update({
        where: { id },
        data: { isActive: false }
      });

      logger.info(`Medicine deleted: ${id} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Medicine deleted successfully'
      });
    } catch (error) {
      logger.error('Delete medicine error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete medicine'
      });
    }
  },

  // Check drug interactions
  checkInteractions: async (req, res) => {
    try {
      const { medicineIds } = req.body;

      if (!Array.isArray(medicineIds) || medicineIds.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'At least 2 medicine IDs are required'
        });
      }

      const interactions = await prisma.medicineInteraction.findMany({
        where: {
          OR: [
            {
              medicineAId: { in: medicineIds },
              medicineBId: { in: medicineIds }
            },
            {
              medicineAId: { in: medicineIds },
              medicineBId: { in: medicineIds }
            }
          ]
        },
        include: {
          medicineA: {
            select: {
              id: true,
              name: true,
              genericName: true
            }
          },
          medicineB: {
            select: {
              id: true,
              name: true,
              genericName: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: {
          interactions,
          hasInteractions: interactions.length > 0,
          severityLevels: interactions.map(i => i.severity)
        }
      });
    } catch (error) {
      logger.error('Check interactions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check drug interactions'
      });
    }
  },

  // Add drug interaction
  addInteraction: async (req, res) => {
    try {
      const { medicineAId, medicineBId, severity, description } = req.body;

      // Only doctors and pharmacists can add interactions
      if (!['DOCTOR', 'PHARMACIST', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.'
        });
      }

      const interaction = await prisma.medicineInteraction.create({
        data: {
          medicineAId,
          medicineBId,
          severity,
          description
        },
        include: {
          medicineA: {
            select: {
              id: true,
              name: true,
              genericName: true
            }
          },
          medicineB: {
            select: {
              id: true,
              name: true,
              genericName: true
            }
          }
        }
      });

      logger.info(`Drug interaction added by ${req.user.email}`);

      res.status(201).json({
        success: true,
        message: 'Drug interaction added successfully',
        data: interaction
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          message: 'Interaction between these medicines already exists'
        });
      }

      logger.error('Add interaction error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add drug interaction'
      });
    }
  },

  // Get medicine suggestions for autocomplete
  getMedicineSuggestions: async (req, res) => {
    try {
      const { query, limit = 10 } = req.query;

      if (!query || query.length < 2) {
        return res.json({
          success: true,
          data: []
        });
      }

      const medicines = await prisma.medicine.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { genericName: { contains: query, mode: 'insensitive' } },
            { brand: { contains: query, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          name: true,
          genericName: true,
          brand: true,
          type: true,
          strength: true,
          unit: true
        },
        take: parseInt(limit),
        orderBy: { name: 'asc' }
      });

      res.json({
        success: true,
        data: medicines
      });
    } catch (error) {
      logger.error('Get medicine suggestions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get medicine suggestions'
      });
    }
  },

  // Get medicine analytics
  getMedicineAnalytics: async (req, res) => {
    try {
      const [
        totalMedicines,
        controlledMedicines,
        prescriptionMedicines,
        otcMedicines,
        mostPrescribed
      ] = await Promise.all([
        prisma.medicine.count({ where: { isActive: true } }),
        prisma.medicine.count({ where: { isActive: true, isControlled: true } }),
        prisma.medicine.count({ where: { isActive: true, requiresPrescription: true } }),
        prisma.medicine.count({ where: { isActive: true, requiresPrescription: false } }),
        prisma.medicine.findMany({
          where: { isActive: true },
          include: {
            _count: {
              select: {
                prescriptionItems: true
              }
            }
          },
          orderBy: {
            prescriptionItems: {
              _count: 'desc'
            }
          },
          take: 10
        })
      ]);

      res.json({
        success: true,
        data: {
          totalMedicines,
          controlledMedicines,
          prescriptionMedicines,
          otcMedicines,
          mostPrescribed: mostPrescribed.map(med => ({
            id: med.id,
            name: med.name,
            genericName: med.genericName,
            prescriptionCount: med._count.prescriptionItems
          }))
        }
      });
    } catch (error) {
      logger.error('Get medicine analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get medicine analytics'
      });
    }
  }
};

module.exports = medicineController;