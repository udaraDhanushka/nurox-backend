const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const pharmacyController = {
  // Get nearby pharmacies
  getNearbyPharmacies: async (req, res) => {
    try {
      const {
        latitude,
        longitude,
        radius = 10,
        medicineId,
        page = 1,
        limit = 20,
      } = req.query;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required',
        });
      }

      // For demo purposes, return mock pharmacy data
      // In a real application, you would use PostGIS or similar for location queries
      const mockPharmacies = [
        {
          id: 'ph1',
          name: 'City Pharmacy',
          address: '123 Main Street, Downtown',
          phone: '+1 (555) 123-4567',
          email: 'info@citypharmacy.com',
          coordinates: {
            latitude: parseFloat(latitude) + 0.01,
            longitude: parseFloat(longitude) + 0.01,
          },
          distance: 1.2,
          rating: 4.5,
          reviews: 120,
          isOpen: true,
          workingHours: {
            open: '08:00',
            close: '22:00',
          },
          services: [
            'Prescription Filling',
            'Health Consultation',
            'Home Delivery',
          ],
          acceptsInsurance: true,
        },
        {
          id: 'ph2',
          name: 'HealthMart Pharmacy',
          address: '456 Oak Avenue, Midtown',
          phone: '+1 (555) 234-5678',
          email: 'contact@healthmart.com',
          coordinates: {
            latitude: parseFloat(latitude) + 0.02,
            longitude: parseFloat(longitude) - 0.01,
          },
          distance: 2.5,
          rating: 4.3,
          reviews: 85,
          isOpen: true,
          workingHours: {
            open: '09:00',
            close: '21:00',
          },
          services: ['Prescription Filling', 'Vaccination', 'Health Screening'],
          acceptsInsurance: true,
        },
        {
          id: 'ph3',
          name: 'MedPlus Pharmacy',
          address: '789 Pine Street, Uptown',
          phone: '+1 (555) 345-6789',
          email: 'info@medplus.com',
          coordinates: {
            latitude: parseFloat(latitude) - 0.01,
            longitude: parseFloat(longitude) + 0.02,
          },
          distance: 3.1,
          rating: 4.7,
          reviews: 200,
          isOpen: false,
          workingHours: {
            open: '08:30',
            close: '20:00',
          },
          services: [
            'Prescription Filling',
            'Health Consultation',
            'Medical Equipment',
          ],
          acceptsInsurance: true,
        },
      ];

      // Filter by radius
      const filteredPharmacies = mockPharmacies.filter(
        (pharmacy) => pharmacy.distance <= parseFloat(radius)
      );

      // If medicineId is provided, check availability
      if (medicineId) {
        // In a real app, you would query actual inventory
        const inventoryData = await prisma.inventoryItem.findMany({
          where: {
            medicineId,
            isActive: true,
            quantity: { gt: 0 },
          },
          include: {
            managedBy: {
              select: {
                id: true,
                pharmacistProfile: true,
              },
            },
          },
        });

        // Add inventory info to pharmacies
        filteredPharmacies.forEach((pharmacy) => {
          const inventory = inventoryData.find(
            (item) =>
              item.managedBy.pharmacistProfile?.pharmacyAffiliation ===
              pharmacy.name
          );
          pharmacy.hasRequestedMedicine = !!inventory;
          pharmacy.quantity = inventory?.quantity || 0;
          pharmacy.price = inventory?.unitPrice || null;
        });
      }

      res.json({
        success: true,
        data: {
          pharmacies: filteredPharmacies,
          searchCenter: {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
          },
          radius: parseFloat(radius),
        },
      });
    } catch (error) {
      logger.error('Get nearby pharmacies error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get nearby pharmacies',
      });
    }
  },

  // Get pharmacy inventory
  getPharmacyInventory: async (req, res) => {
    try {
      const { pharmacyId } = req.params;
      const {
        search,
        medicineType,
        inStockOnly,
        page = 1,
        limit = 50,
      } = req.query;

      // Only pharmacists can view their inventory
      if (req.user.role !== 'PHARMACIST') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Pharmacist role required.',
        });
      }

      const skip = (page - 1) * limit;
      const where = {
        managedById: req.user.id,
        isActive: true,
      };

      if (inStockOnly === 'true') {
        where.quantity = { gt: 0 };
      }

      // Add search and filter conditions
      if (search || medicineType) {
        where.medicine = {};

        if (search) {
          where.medicine.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { genericName: { contains: search, mode: 'insensitive' } },
            { brand: { contains: search, mode: 'insensitive' } },
          ];
        }

        if (medicineType) {
          where.medicine.type = medicineType;
        }
      }

      const [inventory, total] = await Promise.all([
        prisma.inventoryItem.findMany({
          where,
          include: {
            medicine: true,
          },
          orderBy: { medicine: { name: 'asc' } },
          skip: parseInt(skip),
          take: parseInt(limit),
        }),
        prisma.inventoryItem.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          inventory,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Get pharmacy inventory error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pharmacy inventory',
      });
    }
  },

  // Add medicine to inventory
  addToInventory: async (req, res) => {
    try {
      const {
        medicineId,
        batchNumber,
        quantity,
        unitPrice,
        expiryDate,
        supplierName,
        lowStockAlert = 10,
      } = req.body;

      // Only pharmacists can manage inventory
      if (req.user.role !== 'PHARMACIST') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Pharmacist role required.',
        });
      }

      const inventoryItem = await prisma.inventoryItem.create({
        data: {
          medicineId,
          pharmacistId: req.user.id,
          batchNumber,
          quantity,
          unitPrice,
          expiryDate: new Date(expiryDate),
          supplierName,
          lowStockAlert,
        },
        include: {
          medicine: true,
        },
      });

      logger.info(
        `Inventory item added: ${inventoryItem.id} by ${req.user.email}`
      );

      res.status(201).json({
        success: true,
        message: 'Medicine added to inventory successfully',
        data: inventoryItem,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          message: 'This batch number already exists for this medicine',
        });
      }

      logger.error('Add to inventory error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add medicine to inventory',
      });
    }
  },

  // Update inventory item
  updateInventoryItem: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Only pharmacists can manage inventory
      if (req.user.role !== 'PHARMACIST') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Pharmacist role required.',
        });
      }

      const inventoryItem = await prisma.inventoryItem.findUnique({
        where: { id },
      });

      if (!inventoryItem) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found',
        });
      }

      // Check ownership
      if (inventoryItem.pharmacistId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      const updatedItem = await prisma.inventoryItem.update({
        where: { id },
        data: updateData,
        include: {
          medicine: true,
        },
      });

      logger.info(`Inventory item updated: ${id} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Inventory item updated successfully',
        data: updatedItem,
      });
    } catch (error) {
      logger.error('Update inventory item error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update inventory item',
      });
    }
  },

  // Get low stock alerts
  getLowStockAlerts: async (req, res) => {
    try {
      // Only pharmacists can view their alerts
      if (req.user.role !== 'PHARMACIST') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Pharmacist role required.',
        });
      }

      const lowStockItems = await prisma.inventoryItem.findMany({
        where: {
          managedById: req.user.id,
          isActive: true,
          OR: [
            {
              quantity: {
                lte: prisma.inventoryItem.fields.lowStockAlert,
              },
            },
          ],
        },
        include: {
          medicine: true,
        },
        orderBy: { quantity: 'asc' },
      });

      res.json({
        success: true,
        data: {
          lowStockItems,
          count: lowStockItems.length,
        },
      });
    } catch (error) {
      logger.error('Get low stock alerts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get low stock alerts',
      });
    }
  },

  // Get expiring medicines
  getExpiringMedicines: async (req, res) => {
    try {
      const { days = 30 } = req.query;

      // Only pharmacists can view their expiring medicines
      if (req.user.role !== 'PHARMACIST') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Pharmacist role required.',
        });
      }

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + parseInt(days));

      const expiringItems = await prisma.inventoryItem.findMany({
        where: {
          managedById: req.user.id,
          isActive: true,
          expiryDate: {
            lte: expiryDate,
          },
        },
        include: {
          medicine: true,
        },
        orderBy: { expiryDate: 'asc' },
      });

      res.json({
        success: true,
        data: {
          expiringItems,
          count: expiringItems.length,
          daysAhead: parseInt(days),
        },
      });
    } catch (error) {
      logger.error('Get expiring medicines error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get expiring medicines',
      });
    }
  },

  // Get pharmacy analytics
  getPharmacyAnalytics: async (req, res) => {
    try {
      // Only pharmacists can view their analytics
      if (req.user.role !== 'PHARMACIST') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Pharmacist role required.',
        });
      }

      const [
        totalInventoryItems,
        lowStockCount,
        expiringCount,
        totalValue,
        dispensedCount,
      ] = await Promise.all([
        prisma.inventoryItem.count({
          where: {
            managedById: req.user.id,
            isActive: true,
          },
        }),
        prisma.inventoryItem.count({
          where: {
            managedById: req.user.id,
            isActive: true,
            quantity: { lte: 10 }, // Assuming 10 as low stock threshold
          },
        }),
        prisma.inventoryItem.count({
          where: {
            managedById: req.user.id,
            isActive: true,
            expiryDate: {
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
          },
        }),
        prisma.inventoryItem.aggregate({
          where: {
            managedById: req.user.id,
            isActive: true,
          },
          _sum: {
            quantity: true,
          },
        }),
        prisma.prescriptionItem.count({
          where: {
            prescription: {
              pharmacistId: req.user.id,
            },
            isDispensed: true,
          },
        }),
      ]);

      res.json({
        success: true,
        data: {
          inventory: {
            totalItems: totalInventoryItems,
            lowStockItems: lowStockCount,
            expiringItems: expiringCount,
            totalQuantity: totalValue._sum.quantity || 0,
          },
          prescriptions: {
            totalDispensed: dispensedCount,
          },
        },
      });
    } catch (error) {
      logger.error('Get pharmacy analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pharmacy analytics',
      });
    }
  },
};

module.exports = pharmacyController;
