const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const organizationController = require('../controllers/organizationController');
const { validateRequest } = require('../middleware/validation');
const { body, param, query } = require('express-validator');

const router = express.Router();

// Hospital Management Routes
router.post(
  '/hospitals',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  [
    body('name').notEmpty().withMessage('Hospital name is required'),
    body('registrationNumber')
      .notEmpty()
      .withMessage('Registration number is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('licenseNumber').notEmpty().withMessage('License number is required'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('phone').optional().isMobilePhone(),
    body('bedCount').optional().isInt({ min: 0 }),
    body('emergencyServices').optional().isBoolean(),
    body('specialties').optional().isArray(),
  ],
  validateRequest,
  organizationController.createHospital
);

router.get(
  '/hospitals',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'HOSPITAL_ADMIN'),
  [
    query('status')
      .optional()
      .isIn(['ACTIVE', 'INACTIVE', 'PENDING_APPROVAL', 'SUSPENDED']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validateRequest,
  organizationController.getAllHospitals
);

router.get(
  '/hospitals/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'HOSPITAL_ADMIN'),
  [param('id').isLength({ min: 1 }).withMessage('Hospital ID is required')],
  validateRequest,
  organizationController.getHospitalById
);

router.put(
  '/hospitals/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'HOSPITAL_ADMIN'),
  [
    param('id').isLength({ min: 1 }).withMessage('Hospital ID is required'),
    body('name').optional().notEmpty(),
    body('email').optional().isEmail(),
    body('phone').optional().isMobilePhone(),
    body('bedCount').optional().isInt({ min: 0 }),
    body('emergencyServices').optional().isBoolean(),
    body('specialties').optional().isArray(),
  ],
  validateRequest,
  organizationController.updateHospital
);

router.delete(
  '/hospitals/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  [param('id').isLength({ min: 1 }).withMessage('Hospital ID is required')],
  validateRequest,
  organizationController.deleteHospital
);

// Doctor Verification Routes
router.get(
  '/hospitals/:hospitalId/doctor-verification-requests',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'HOSPITAL_ADMIN'),
  [
    param('hospitalId')
      .isLength({ min: 1 })
      .withMessage('Hospital ID is required'),
    query('status')
      .optional()
      .isIn(['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW']),
  ],
  validateRequest,
  organizationController.getDoctorVerificationRequests
);

router.put(
  '/hospitals/:hospitalId/doctors/:doctorId/verification',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'HOSPITAL_ADMIN'),
  [
    param('hospitalId')
      .isLength({ min: 1 })
      .withMessage('Hospital ID is required'),
    param('doctorId').isLength({ min: 1 }).withMessage('Doctor ID is required'),
    body('status')
      .isIn(['APPROVED', 'REJECTED', 'NEEDS_REVIEW'])
      .withMessage('Valid status is required'),
    body('rejectionReason').optional().isLength({ min: 1 }),
  ],
  validateRequest,
  organizationController.updateDoctorVerification
);

// Pharmacy Management Routes
router.post(
  '/pharmacies',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'HOSPITAL_ADMIN'),
  [
    body('name').notEmpty().withMessage('Pharmacy name is required'),
    body('registrationNumber')
      .notEmpty()
      .withMessage('Registration number is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('licenseNumber').notEmpty().withMessage('License number is required'),
    body('email').optional().isEmail(),
    body('phone').optional().isMobilePhone(),
    body('hospitalId').optional().isLength({ min: 1 }),
  ],
  validateRequest,
  organizationController.createPharmacy
);

// Laboratory Management Routes
router.post(
  '/laboratories',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'HOSPITAL_ADMIN'),
  [
    body('name').notEmpty().withMessage('Laboratory name is required'),
    body('registrationNumber')
      .notEmpty()
      .withMessage('Registration number is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('licenseNumber').notEmpty().withMessage('License number is required'),
    body('email').optional().isEmail(),
    body('phone').optional().isMobilePhone(),
    body('testTypes').optional().isArray(),
    body('hospitalId').optional().isLength({ min: 1 }),
  ],
  validateRequest,
  organizationController.createLaboratory
);

// Insurance Company Management Routes
router.post(
  '/insurance-companies',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  [
    body('name').notEmpty().withMessage('Insurance company name is required'),
    body('registrationNumber')
      .notEmpty()
      .withMessage('Registration number is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('licenseNumber').notEmpty().withMessage('License number is required'),
    body('email').optional().isEmail(),
    body('phone').optional().isMobilePhone(),
    body('coverageTypes').optional().isArray(),
  ],
  validateRequest,
  organizationController.createInsuranceCompany
);

// Super Admin Dashboard - All Organizations
router.get(
  '/all',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  organizationController.getAllOrganizations
);

module.exports = router;
