const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if session exists and is valid
      const session = await prisma.session.findUnique({
        where: { token },
        include: {
          user: {
            include: {
              patientProfile: true,
              doctorProfile: true,
              pharmacistProfile: true
            }
          }
        }
      });

      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token'
        });
      }

      if (!session.user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is disabled'
        });
      }

      req.user = session.user;
      req.sessionId = session.id;
      next();
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Role-based access control middleware
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// Optional auth middleware (for public endpoints that can benefit from user context)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const session = await prisma.session.findUnique({
        where: { token },
        include: {
          user: {
            include: {
              patientProfile: true,
              doctorProfile: true,
              pharmacistProfile: true
            }
          }
        }
      });

      if (session && session.expiresAt >= new Date() && session.user.isActive) {
        req.user = session.user;
        req.sessionId = session.id;
      }
    } catch (jwtError) {
      // Ignore JWT errors for optional auth
    }
  } catch (error) {
    // Ignore errors for optional auth
  }
  
  next();
};

module.exports = {
  authMiddleware,
  requireRole,
  optionalAuth
};