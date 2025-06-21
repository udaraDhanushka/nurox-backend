const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const appointmentController = {
  // Create new appointment
  createAppointment: async (req, res) => {
    try {
      const {
        doctorId,
        type,
        title,
        description,
        appointmentDate,
        duration = 30,
        location,
        isVirtual = false,
        fee,
        notes
      } = req.body;

      const appointment = await prisma.appointment.create({
        data: {
          patientId: req.user.id,
          doctorId,
          type,
          title,
          description,
          appointmentDate: new Date(appointmentDate),
          duration,
          location,
          isVirtual,
          fee,
          notes
        },
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
              email: true,
              phone: true,
              profileImage: true,
              doctorProfile: true
            }
          }
        }
      });

      // Create notification for doctor
      await prisma.notification.create({
        data: {
          userId: doctorId,
          type: 'APPOINTMENT_REMINDER',
          title: 'New Appointment Request',
          message: `New appointment request from ${req.user.firstName} ${req.user.lastName}`,
          data: { appointmentId: appointment.id }
        }
      });

      logger.info(`Appointment created: ${appointment.id} by ${req.user.email}`);

      res.status(201).json({
        success: true,
        message: 'Appointment created successfully',
        data: appointment
      });
    } catch (error) {
      logger.error('Create appointment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create appointment'
      });
    }
  },

  // Get appointments for current user
  getAppointments: async (req, res) => {
    try {
      const {
        status,
        type,
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
      }

      // Apply filters
      if (status) where.status = status;
      if (type) where.type = type;
      if (startDate || endDate) {
        where.appointmentDate = {};
        if (startDate) where.appointmentDate.gte = new Date(startDate);
        if (endDate) where.appointmentDate.lte = new Date(endDate);
      }

      const [appointments, total] = await Promise.all([
        prisma.appointment.findMany({
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
                patientProfile: true
              }
            },
            doctor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                profileImage: true,
                doctorProfile: true
              }
            }
          },
          orderBy: { appointmentDate: 'desc' },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.appointment.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          appointments,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Get appointments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get appointments'
      });
    }
  },

  // Get single appointment
  getAppointment: async (req, res) => {
    try {
      const { id } = req.params;

      const appointment = await prisma.appointment.findUnique({
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
              email: true,
              phone: true,
              profileImage: true,
              doctorProfile: true
            }
          },
          prescriptions: {
            include: {
              items: {
                include: {
                  medicine: true
                }
              }
            }
          }
        }
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      // Check authorization
      if (appointment.patientId !== req.user.id && appointment.doctorId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: appointment
      });
    } catch (error) {
      logger.error('Get appointment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get appointment'
      });
    }
  },

  // Update appointment
  updateAppointment: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, notes, meetingLink } = req.body;

      const appointment = await prisma.appointment.findUnique({
        where: { id }
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      // Check authorization
      if (appointment.patientId !== req.user.id && appointment.doctorId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const updateData = {};
      if (status !== undefined) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;
      if (meetingLink !== undefined) updateData.meetingLink = meetingLink;

      const updatedAppointment = await prisma.appointment.update({
        where: { id },
        data: updateData,
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
              email: true,
              phone: true,
              profileImage: true,
              doctorProfile: true
            }
          }
        }
      });

      // Create notification for status changes
      if (status) {
        const notificationUserId = req.user.id === appointment.patientId ? 
          appointment.doctorId : appointment.patientId;
        
        await prisma.notification.create({
          data: {
            userId: notificationUserId,
            type: 'APPOINTMENT_REMINDER',
            title: 'Appointment Updated',
            message: `Appointment status changed to ${status}`,
            data: { appointmentId: id }
          }
        });
      }

      logger.info(`Appointment updated: ${id} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Appointment updated successfully',
        data: updatedAppointment
      });
    } catch (error) {
      logger.error('Update appointment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update appointment'
      });
    }
  },

  // Cancel appointment
  cancelAppointment: async (req, res) => {
    try {
      const { id } = req.params;

      const appointment = await prisma.appointment.findUnique({
        where: { id }
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      // Check authorization
      if (appointment.patientId !== req.user.id && appointment.doctorId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      await prisma.appointment.update({
        where: { id },
        data: { status: 'CANCELLED' }
      });

      // Create notification for other party
      const notificationUserId = req.user.id === appointment.patientId ? 
        appointment.doctorId : appointment.patientId;
      
      await prisma.notification.create({
        data: {
          userId: notificationUserId,
          type: 'APPOINTMENT_REMINDER',
          title: 'Appointment Cancelled',
          message: 'An appointment has been cancelled',
          data: { appointmentId: id }
        }
      });

      logger.info(`Appointment cancelled: ${id} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Appointment cancelled successfully'
      });
    } catch (error) {
      logger.error('Cancel appointment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel appointment'
      });
    }
  },

  // Get available doctors
  getDoctors: async (req, res) => {
    try {
      const { specialization, page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const where = { role: 'DOCTOR', isActive: true };
      if (specialization) {
        where.doctorProfile = {
          specialization: {
            contains: specialization,
            mode: 'insensitive'
          }
        };
      }

      const [doctors, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            profileImage: true,
            doctorProfile: true
          },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.user.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          doctors,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Get doctors error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get doctors'
      });
    }
  },

  // Get doctor availability
  getDoctorAvailability: async (req, res) => {
    try {
      const { doctorId } = req.params;
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'Date parameter is required'
        });
      }

      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      const appointments = await prisma.appointment.findMany({
        where: {
          doctorId,
          appointmentDate: {
            gte: startDate,
            lte: endDate
          },
          status: {
            in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS']
          }
        },
        select: {
          appointmentDate: true,
          duration: true
        }
      });

      res.json({
        success: true,
        data: {
          date,
          appointments: appointments.length,
          bookedSlots: appointments
        }
      });
    } catch (error) {
      logger.error('Get doctor availability error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get doctor availability'
      });
    }
  }
};

module.exports = appointmentController;