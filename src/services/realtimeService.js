const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class RealtimeService {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // Map of userId to socket IDs
    this.organizationRooms = new Map(); // Map of organization IDs to room names
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ["http://localhost:8081", "http://localhost:3000"],
        credentials: true
      }
    });

    this.io.use(this.authenticateSocket.bind(this));
    this.io.on('connection', this.handleConnection.bind(this));

    logger.info('Real-time service initialized');
  }

  async authenticateSocket(socket, next) {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if session exists and is valid
      const session = await prisma.session.findUnique({
        where: { token },
        include: {
          user: {
            include: {
              patientProfile: true,
              doctorProfile: true,
              pharmacistProfile: true,
              mltProfile: true,
              hospital: true,
              pharmacy: true,
              laboratory: true,
              insuranceCompany: true
            }
          }
        }
      });

      if (!session || session.expiresAt < new Date() || !session.user.isActive) {
        return next(new Error('Invalid or expired token'));
      }

      socket.user = session.user;
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  }

  handleConnection(socket) {
    const user = socket.user;
    logger.info(`User connected: ${user.email} (${user.role})`);

    // Store user socket mapping
    this.userSockets.set(user.id, socket.id);

    // Join appropriate rooms based on user role and affiliations
    this.joinUserRooms(socket, user);

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${user.email}`);
      this.userSockets.delete(user.id);
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });
  }

  joinUserRooms(socket, user) {
    // Join user-specific room
    socket.join(`user:${user.id}`);

    // Join role-specific rooms
    socket.join(`role:${user.role}`);

    // Join organization-specific rooms
    if (user.hospitalId) {
      socket.join(`hospital:${user.hospitalId}`);
      if (user.role === 'DOCTOR') {
        socket.join(`hospital:${user.hospitalId}:doctors`);
      }
    }

    if (user.pharmacyId) {
      socket.join(`pharmacy:${user.pharmacyId}`);
    }

    if (user.laboratoryId) {
      socket.join(`laboratory:${user.laboratoryId}`);
    }

    if (user.insuranceId) {
      socket.join(`insurance:${user.insuranceId}`);
    }

    // Super admin joins all organization rooms
    if (user.role === 'SUPER_ADMIN') {
      socket.join('super-admin');
    }
  }

  // Notification methods
  async sendToUser(userId, event, data) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  async sendToUsers(userIds, event, data) {
    const results = await Promise.all(
      userIds.map(userId => this.sendToUser(userId, event, data))
    );
    return results.filter(Boolean).length;
  }

  async sendToRole(role, event, data) {
    this.io.to(`role:${role}`).emit(event, data);
  }

  async sendToHospital(hospitalId, event, data) {
    this.io.to(`hospital:${hospitalId}`).emit(event, data);
  }

  async sendToHospitalDoctors(hospitalId, event, data) {
    this.io.to(`hospital:${hospitalId}:doctors`).emit(event, data);
  }

  async sendToPharmacy(pharmacyId, event, data) {
    this.io.to(`pharmacy:${pharmacyId}`).emit(event, data);
  }

  async sendToLaboratory(laboratoryId, event, data) {
    this.io.to(`laboratory:${laboratoryId}`).emit(event, data);
  }

  async sendToInsurance(insuranceId, event, data) {
    this.io.to(`insurance:${insuranceId}`).emit(event, data);
  }

  async sendToSuperAdmins(event, data) {
    this.io.to('super-admin').emit(event, data);
  }

  // Specific notification handlers
  async notifyAppointmentUpdate(appointment) {
    // Notify patient
    await this.sendToUser(appointment.patientId, 'appointment:updated', {
      appointmentId: appointment.id,
      status: appointment.status,
      appointmentDate: appointment.appointmentDate,
      message: `Your appointment has been ${appointment.status.toLowerCase()}`
    });

    // Notify doctor
    await this.sendToUser(appointment.doctorId, 'appointment:updated', {
      appointmentId: appointment.id,
      status: appointment.status,
      patientName: `${appointment.patient?.firstName} ${appointment.patient?.lastName}`,
      message: `Appointment with patient has been ${appointment.status.toLowerCase()}`
    });

    // Notify hospital if doctor is affiliated
    const doctor = await prisma.user.findUnique({
      where: { id: appointment.doctorId },
      include: { doctorProfile: true }
    });

    if (doctor?.hospitalId) {
      await this.sendToHospital(doctor.hospitalId, 'hospital:appointment:updated', {
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        status: appointment.status
      });
    }
  }

  async notifyPrescriptionUpdate(prescription) {
    // Notify patient
    await this.sendToUser(prescription.patientId, 'prescription:updated', {
      prescriptionId: prescription.id,
      status: prescription.status,
      message: `Your prescription is ${prescription.status.toLowerCase()}`
    });

    // Notify doctor
    await this.sendToUser(prescription.doctorId, 'prescription:updated', {
      prescriptionId: prescription.id,
      status: prescription.status,
      message: `Prescription status updated to ${prescription.status.toLowerCase()}`
    });

    // Notify pharmacist if assigned
    if (prescription.pharmacistId) {
      await this.sendToUser(prescription.pharmacistId, 'prescription:updated', {
        prescriptionId: prescription.id,
        status: prescription.status,
        patientName: `${prescription.patient?.firstName} ${prescription.patient?.lastName}`
      });
    }
  }

  async notifyDoctorVerificationUpdate(doctorId, hospitalId, status, rejectionReason = null) {
    // Notify doctor
    await this.sendToUser(doctorId, 'verification:updated', {
      status,
      hospitalId,
      rejectionReason,
      message: status === 'APPROVED' 
        ? 'Your doctor verification has been approved!'
        : status === 'REJECTED'
        ? `Your doctor verification was rejected: ${rejectionReason || 'No reason provided'}`
        : 'Your doctor verification needs review'
    });

    // Notify hospital admins
    await this.sendToHospital(hospitalId, 'hospital:doctor:verification', {
      doctorId,
      status,
      message: `Doctor verification ${status.toLowerCase()}`
    });

    // Notify super admins
    await this.sendToSuperAdmins('admin:doctor:verification', {
      doctorId,
      hospitalId,
      status
    });
  }

  async notifyLabResultUpdate(labResult) {
    // Notify patient
    await this.sendToUser(labResult.patientId, 'lab-result:updated', {
      labResultId: labResult.id,
      testName: labResult.testName,
      status: labResult.status,
      isAbnormal: labResult.isAbnormal,
      message: `Your ${labResult.testName} test results are ${labResult.status.toLowerCase()}`
    });

    // Notify reviewing doctor if any
    if (labResult.reviewedById) {
      await this.sendToUser(labResult.reviewedById, 'lab-result:updated', {
        labResultId: labResult.id,
        patientId: labResult.patientId,
        testName: labResult.testName,
        status: labResult.status,
        isAbnormal: labResult.isAbnormal
      });
    }

    // Notify laboratory
    if (labResult.laboratoryId) {
      await this.sendToLaboratory(labResult.laboratoryId, 'lab:result:updated', {
        labResultId: labResult.id,
        status: labResult.status
      });
    }
  }

  async notifyNewOrganization(organization, type) {
    // Notify super admins about new organization registrations
    await this.sendToSuperAdmins('admin:organization:new', {
      organizationId: organization.id,
      name: organization.name,
      type,
      status: organization.status,
      message: `New ${type} registration: ${organization.name}`
    });
  }

  async notifySystemAlert(message, targetRole = null, organizationId = null) {
    const alertData = {
      message,
      timestamp: new Date().toISOString(),
      type: 'SYSTEM_ALERT'
    };

    if (targetRole) {
      await this.sendToRole(targetRole, 'system:alert', alertData);
    } else if (organizationId) {
      // Send to all users in the organization
      this.io.to(`hospital:${organizationId}`).emit('system:alert', alertData);
      this.io.to(`pharmacy:${organizationId}`).emit('system:alert', alertData);
      this.io.to(`laboratory:${organizationId}`).emit('system:alert', alertData);
      this.io.to(`insurance:${organizationId}`).emit('system:alert', alertData);
    } else {
      // Broadcast to all connected users
      this.io.emit('system:alert', alertData);
    }
  }

  getConnectedUsers() {
    return Array.from(this.userSockets.keys());
  }

  getStats() {
    return {
      connectedUsers: this.userSockets.size,
      totalRooms: this.io.sockets.adapter.rooms.size
    };
  }
}

module.exports = new RealtimeService();