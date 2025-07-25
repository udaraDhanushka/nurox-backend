const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { 
  generateTokens, 
  generateResetToken, 
  refreshAccessToken,
  revokeToken,
  revokeAllUserTokens 
} = require('../utils/generateToken');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const authController = {
  // Register new user
  register: async (req, res) => {
    try {
      const { email, password, firstName, lastName, role, phone, dateOfBirth } = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

      // Create user with role-specific profile
      const userData = {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        phone,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null
      };

      // Add role-specific profile data
      if (role === 'PATIENT') {
        userData.patientProfile = {
          create: {}
        };
      } else if (role === 'DOCTOR') {
        const { hospitalId, specialization } = req.body;
        userData.doctorProfile = {
          create: {
            specialization: specialization || 'General Practice',
            licenseNumber: `DOC${Date.now()}`,
            verificationStatus: 'PENDING'
          }
        };
        if (hospitalId) {
          userData.hospitalId = hospitalId;
        }
      } else if (role === 'PHARMACIST') {
        const { pharmacyId } = req.body;
        userData.pharmacistProfile = {
          create: {
            licenseNumber: `PHARM${Date.now()}`
          }
        };
        if (pharmacyId) {
          userData.pharmacyId = pharmacyId;
        }
      } else if (role === 'MLT') {
        const { laboratoryId, certifications, specializations } = req.body;
        userData.mltProfile = {
          create: {
            licenseNumber: `MLT${Date.now()}`,
            certifications: certifications || [],
            specializations: specializations || []
          }
        };
        if (laboratoryId) {
          userData.laboratoryId = laboratoryId;
        }
      }

      const user = await prisma.user.create({
        data: userData,
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
      });

      // Generate tokens
      const tokens = await generateTokens(user.id);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      logger.info(`New user registered: ${email}`);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: userWithoutPassword,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.accessTokenExpiry
        }
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed'
      });
    }
  },

  // Login user
  login: async (req, res) => {
    try {
      console.log('Login request received:', { email: req.body.email, hasPassword: !!req.body.password });
      const { email, password } = req.body;

      // Find user with role-specific profiles
      const user = await prisma.user.findUnique({
        where: { email },
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
      });

      if (!user) {
        console.log('User not found:', email);
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      if (!user.isActive) {
        console.log('User account is disabled:', email);
        return res.status(401).json({
          success: false,
          message: 'Account is disabled'
        });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        console.log('Invalid password for user:', email);
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate tokens
      const tokens = await generateTokens(user.id);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      logger.info(`User logged in: ${email}`);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: userWithoutPassword,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.accessTokenExpiry
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      console.error('Login error details:', error.message, error.stack);
      
      // Provide specific error messages based on the error type
      let errorMessage = 'Login failed';
      let statusCode = 500;
      
      if (error.code === 'P1001') {
        // Database connection error
        errorMessage = 'Database connection unavailable. Please try again later.';
        statusCode = 503;
      } else if (error.code === 'P2002') {
        // Unique constraint violation
        errorMessage = 'Database constraint error';
        statusCode = 400;
      } else if (error.message && error.message.includes('database')) {
        errorMessage = 'Database service unavailable. Please try again later.';
        statusCode = 503;
      } else if (error.message && error.message.includes('timeout')) {
        errorMessage = 'Request timeout. Please try again.';
        statusCode = 408;
      }
      
      res.status(statusCode).json({
        success: false,
        message: errorMessage
      });
    }
  },

  // Logout user
  logout: async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        await revokeToken(token);
      }

      logger.info(`User logged out: ${req.user?.email}`);

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  },

  // Logout from all devices
  logoutAll: async (req, res) => {
    try {
      await revokeAllUserTokens(req.user.id);

      logger.info(`User logged out from all devices: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Logged out from all devices successfully'
      });
    } catch (error) {
      logger.error('Logout all error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  },

  // Refresh access token
  refreshToken: async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token required'
        });
      }

      try {
        const tokens = await refreshAccessToken(refreshToken);

        res.json({
          success: true,
          message: 'Token refreshed successfully',
          data: {
            accessToken: tokens.accessToken,
            expiresAt: tokens.accessTokenExpiry
          }
        });
      } catch (refreshError) {
        logger.error('Token refresh failed:', refreshError);
        res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token'
        });
      }
    } catch (error) {
      logger.error('Token refresh error:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
  },

  // Get current user profile
  me: async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
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

  // Forgot password
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;

      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        // Don't reveal if email exists or not
        return res.json({
          success: true,
          message: 'If the email exists, a reset link has been sent'
        });
      }

      const resetToken = generateResetToken();
      const resetTokenExpiry = new Date();
      resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // 1 hour expiry

      // Store reset token (you might want to create a separate table for this)
      // For now, we'll use a simple in-memory storage or database field
      // This is a simplified implementation

      logger.info(`Password reset requested for: ${email}`);

      // Here you would send an email with the reset token
      // For now, we'll just return success

      res.json({
        success: true,
        message: 'If the email exists, a reset link has been sent'
      });
    } catch (error) {
      logger.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process password reset request'
      });
    }
  },

  // Reset password
  resetPassword: async (req, res) => {
    try {
      const { token, password } = req.body;

      // In a real implementation, you would verify the reset token
      // For now, this is a simplified version

      const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

      // Update password and invalidate all sessions
      // This is simplified - in reality, you'd find the user by reset token
      
      logger.info('Password reset completed');

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      logger.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset password'
      });
    }
  },

  // Change password (for authenticated users)
  changePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await prisma.user.findUnique({
        where: { id: req.user.id }
      });

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

      // Update password
      await prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedNewPassword }
      });

      // Revoke all sessions except current one
      await prisma.session.deleteMany({
        where: {
          userId: req.user.id,
          id: { not: req.sessionId }
        }
      });

      logger.info(`Password changed for user: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to change password'
      });
    }
  }
};

module.exports = authController;