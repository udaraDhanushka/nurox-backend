const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (
      !process.env.SMTP_HOST ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASS
    ) {
      logger.warn(
        'Email service not configured. Skipping email transporter initialization.'
      );
      return;
    }

    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        logger.error('Email service configuration error:', error);
      } else {
        logger.info('Email service is ready to send messages');
      }
    });
  }

  async sendEmail(to, subject, html, text = null) {
    if (!this.transporter) {
      logger.warn('Email service not configured. Email not sent.');
      return false;
    }

    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to,
        subject,
        html,
        text: text || this.stripHtml(html),
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${to}: ${result.messageId}`);
      return true;
    } catch (error) {
      logger.error('Email sending error:', error);
      return false;
    }
  }

  async sendWelcomeEmail(user) {
    const subject = 'Welcome to Nurox Healthcare Platform';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to Nurox Healthcare!</h2>
        <p>Dear ${user.firstName} ${user.lastName},</p>
        <p>Welcome to the Nurox Healthcare Platform. Your account has been successfully created.</p>
        <p><strong>Account Details:</strong></p>
        <ul>
          <li>Email: ${user.email}</li>
          <li>Role: ${user.role}</li>
        </ul>
        <p>You can now access all the features available for your role:</p>
        ${this.getRoleFeatures(user.role)}
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        <p>Best regards,<br>The Nurox Healthcare Team</p>
      </div>
    `;

    return await this.sendEmail(user.email, subject, html);
  }

  async sendAppointmentReminder(appointment) {
    const subject = 'Appointment Reminder - Nurox Healthcare';
    const appointmentDate = new Date(appointment.appointmentDate);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Appointment Reminder</h2>
        <p>Dear ${appointment.patient.firstName} ${appointment.patient.lastName},</p>
        <p>This is a reminder for your upcoming appointment:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Doctor:</strong> Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}</p>
          <p><strong>Date:</strong> ${appointmentDate.toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${appointmentDate.toLocaleTimeString()}</p>
          <p><strong>Type:</strong> ${appointment.type}</p>
          ${appointment.location ? `<p><strong>Location:</strong> ${appointment.location}</p>` : ''}
          ${appointment.isVirtual ? '<p><strong>Note:</strong> This is a virtual appointment</p>' : ''}
        </div>
        <p>Please arrive 15 minutes early for your appointment.</p>
        <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
        <p>Best regards,<br>The Nurox Healthcare Team</p>
      </div>
    `;

    return await this.sendEmail(appointment.patient.email, subject, html);
  }

  async sendPrescriptionReady(prescription) {
    const subject = 'Prescription Ready - Nurox Healthcare';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Your Prescription is Ready</h2>
        <p>Dear ${prescription.patient.firstName} ${prescription.patient.lastName},</p>
        <p>Your prescription is now ready for pickup:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Prescription Number:</strong> ${prescription.prescriptionNumber}</p>
          <p><strong>Prescribed by:</strong> Dr. ${prescription.doctor.firstName} ${prescription.doctor.lastName}</p>
          <p><strong>Pharmacy:</strong> ${prescription.pharmacist?.pharmacistProfile?.pharmacyAffiliation || 'Nurox Pharmacy'}</p>
          <p><strong>Status:</strong> ${prescription.status}</p>
        </div>
        <p>Please bring a valid ID when picking up your prescription.</p>
        <p>If you have any questions, please contact the pharmacy directly.</p>
        <p>Best regards,<br>The Nurox Healthcare Team</p>
      </div>
    `;

    return await this.sendEmail(prescription.patient.email, subject, html);
  }

  async sendLabResultsReady(labResult) {
    const subject = 'Lab Results Available - Nurox Healthcare';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Your Lab Results are Ready</h2>
        <p>Dear ${labResult.patient.firstName} ${labResult.patient.lastName},</p>
        <p>Your lab test results are now available:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Test:</strong> ${labResult.testName}</p>
          <p><strong>Lab:</strong> ${labResult.labName}</p>
          <p><strong>Completed:</strong> ${new Date(labResult.completedDate).toLocaleDateString()}</p>
          <p><strong>Status:</strong> ${labResult.status}</p>
        </div>
        <p>Please log in to your account to view the detailed results.</p>
        <p>If you have any concerns about your results, please contact your healthcare provider.</p>
        <p>Best regards,<br>The Nurox Healthcare Team</p>
      </div>
    `;

    return await this.sendEmail(labResult.patient.email, subject, html);
  }

  async sendPasswordResetEmail(email, resetToken) {
    const subject = 'Password Reset - Nurox Healthcare';
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>You have requested to reset your password for your Nurox Healthcare account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
        </div>
        <p>This link will expire in 1 hour for security reasons.</p>
        <p>If you did not request this password reset, please ignore this email.</p>
        <p>Best regards,<br>The Nurox Healthcare Team</p>
      </div>
    `;

    return await this.sendEmail(email, subject, html);
  }

  getRoleFeatures(role) {
    const features = {
      PATIENT: `
        <ul>
          <li>Book and manage appointments</li>
          <li>View prescriptions and medical records</li>
          <li>Upload prescription images with OCR processing</li>
          <li>Chat with healthcare providers</li>
          <li>Track lab results and health metrics</li>
        </ul>
      `,
      DOCTOR: `
        <ul>
          <li>Manage patient appointments</li>
          <li>Create and manage prescriptions</li>
          <li>Review lab results</li>
          <li>Chat with patients and colleagues</li>
          <li>Access patient medical records</li>
        </ul>
      `,
      PHARMACIST: `
        <ul>
          <li>Manage prescription dispensing</li>
          <li>Inventory management</li>
          <li>Chat with patients and doctors</li>
          <li>Track pharmacy analytics</li>
        </ul>
      `,
    };

    return features[role] || '<p>Access to healthcare platform features.</p>';
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '');
  }
}

module.exports = new EmailService();
