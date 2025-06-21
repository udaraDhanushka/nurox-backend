const express = require('express');
const appointmentController = require('../controllers/appointmentController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { validate, validateQuery, schemas } = require('../middleware/validation');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Appointment CRUD operations
router.post('/', validate(schemas.createAppointment), appointmentController.createAppointment);
router.get('/', validateQuery(schemas.appointmentQuery), appointmentController.getAppointments);
router.get('/:id', appointmentController.getAppointment);
router.put('/:id', validate(schemas.updateAppointment), appointmentController.updateAppointment);
router.delete('/:id', appointmentController.cancelAppointment);

// Doctor-related routes
router.get('/doctors/list', appointmentController.getDoctors);
router.get('/doctors/:doctorId/availability', appointmentController.getDoctorAvailability);

module.exports = router;