const Joi = require('joi');

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const message = error.details[0].message;
      return res.status(400).json({
        success: false,
        message,
        details: error.details
      });
    }
    
    next();
  };
};

// Query validation middleware factory
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.query);
    
    if (error) {
      const message = error.details[0].message;
      return res.status(400).json({
        success: false,
        message,
        details: error.details
      });
    }
    
    next();
  };
};

// Common validation schemas
const schemas = {
  // Auth schemas
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    role: Joi.string().valid('PATIENT', 'DOCTOR', 'PHARMACIST').required(),
    phone: Joi.string().optional(),
    dateOfBirth: Joi.date().optional()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required()
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    password: Joi.string().min(8).required()
  }),

  // User profile schemas
  updateProfile: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    phone: Joi.string().optional(),
    dateOfBirth: Joi.date().optional(),
    profileImage: Joi.string().optional(),
    language: Joi.string().optional()
  }),

  // Appointment schemas
  createAppointment: Joi.object({
    doctorId: Joi.string().required(),
    type: Joi.string().valid(
      'CONSULTATION', 'FOLLOW_UP', 'EMERGENCY', 
      'ROUTINE_CHECKUP', 'SPECIALIST_VISIT'
    ).required(),
    title: Joi.string().required(),
    description: Joi.string().optional(),
    appointmentDate: Joi.date().required(),
    duration: Joi.number().min(15).max(240).optional(),
    isVirtual: Joi.boolean().optional(),
    notes: Joi.string().optional(),
    tokenNumber: Joi.number().integer().min(1).max(100).optional(),
    isReschedule: Joi.boolean().optional()
  }),

  updateAppointment: Joi.object({
    status: Joi.string().valid(
      'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELED'
    ).optional(),
    notes: Joi.string().optional(),
    meetingLink: Joi.string().optional(),
    tokenNumber: Joi.number().integer().min(1).max(100).optional(),
    isReschedule: Joi.boolean().optional()
  }),

  rescheduleAppointment: Joi.object({
    newAppointmentDate: Joi.date().required(),
    tokenNumber: Joi.number().integer().min(1).max(100).optional(),
    notes: Joi.string().optional()
  }),

  // Prescription schemas
  createPrescription: Joi.object({
    patientId: Joi.string().required(),
    appointmentId: Joi.string().optional(),
    diagnosis: Joi.string().optional(),
    notes: Joi.string().optional(),
    expiryDate: Joi.date().optional(),
    items: Joi.array().items(
      Joi.object({
        medicineId: Joi.string().required(),
        dosage: Joi.string().required(),
        frequency: Joi.string().valid(
          'ONCE_DAILY', 'TWICE_DAILY', 'THREE_TIMES_DAILY',
          'FOUR_TIMES_DAILY', 'EVERY_4_HOURS', 'EVERY_6_HOURS',
          'EVERY_8_HOURS', 'EVERY_12_HOURS', 'AS_NEEDED',
          'BEFORE_MEALS', 'AFTER_MEALS', 'AT_BEDTIME',
          'WEEKLY', 'MONTHLY'
        ).required(),
        duration: Joi.string().required(),
        quantity: Joi.number().min(1).required(),
        instructions: Joi.string().optional()
      })
    ).required()
  }),

  // Medicine schemas
  createMedicine: Joi.object({
    name: Joi.string().required(),
    genericName: Joi.string().optional(),
    brand: Joi.string().optional(),
    type: Joi.string().valid(
      'TABLET', 'CAPSULE', 'SYRUP', 'INJECTION',
      'CREAM', 'DROPS', 'INHALER', 'POWDER', 'OTHER'
    ).required(),
    strength: Joi.string().required(),
    unit: Joi.string().valid(
      'MG', 'G', 'ML', 'MCG', 'IU', 'UNITS',
      'DROPS', 'TABLETS', 'CAPSULES'
    ).required(),
    description: Joi.string().optional(),
    sideEffects: Joi.array().items(Joi.string()).optional(),
    contraindications: Joi.array().items(Joi.string()).optional(),
    manufacturer: Joi.string().optional(),
    isControlled: Joi.boolean().optional(),
    requiresPrescription: Joi.boolean().optional()
  }),

  // Lab result schemas
  createLabResult: Joi.object({
    patientId: Joi.string().required(),
    appointmentId: Joi.string().optional(),
    testName: Joi.string().required(),
    testType: Joi.string().required(),
    orderedDate: Joi.date().optional(),
    labName: Joi.string().optional(),
    technicianName: Joi.string().optional(),
    notes: Joi.string().optional()
  }),

  updateLabResult: Joi.object({
    status: Joi.string().valid(
      'PENDING', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED', 'ABNORMAL'
    ).optional(),
    results: Joi.object().optional(),
    normalRanges: Joi.object().optional(),
    isAbnormal: Joi.boolean().optional(),
    notes: Joi.string().optional(),
    completedDate: Joi.date().optional()
  }),

  // Notification schemas
  createNotification: Joi.object({
    userId: Joi.string().required(),
    type: Joi.string().valid(
      'APPOINTMENT_REMINDER', 'PRESCRIPTION_READY', 'LAB_RESULT',
      'PAYMENT_DUE', 'INSURANCE_UPDATE', 'SYSTEM_ALERT', 'CHAT_MESSAGE'
    ).required(),
    title: Joi.string().required(),
    message: Joi.string().required(),
    data: Joi.object().optional(),
    scheduledFor: Joi.date().optional()
  }),

  // Chat schemas
  sendMessage: Joi.object({
    receiverId: Joi.string().required(),
    message: Joi.string().required(),
    attachments: Joi.array().items(Joi.string()).optional(),
    metadata: Joi.object().optional()
  }),

  // Query validation schemas
  pagination: Joi.object({
    page: Joi.number().min(1).optional(),
    limit: Joi.number().min(1).max(100).optional(),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional()
  }),

  appointmentQuery: Joi.object({
    status: Joi.string().optional(),
    type: Joi.string().optional(),
    doctorId: Joi.string().optional(),
    patientId: Joi.string().optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional()
  }).concat(Joi.object({
    page: Joi.number().min(1).optional(),
    limit: Joi.number().min(1).max(100).optional()
  })),

  prescriptionQuery: Joi.object({
    status: Joi.string().optional(),
    patientId: Joi.string().optional(),
    doctorId: Joi.string().optional(),
    pharmacistId: Joi.string().optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional()
  }).concat(Joi.object({
    page: Joi.number().min(1).optional(),
    limit: Joi.number().min(1).max(100).optional()
  }))
};

module.exports = {
  validate,
  validateQuery,
  schemas
};