const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const generateTokens = async (userId) => {
  try {
    // Generate access token
    const accessToken = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    // Calculate expiration dates
    const accessTokenExpiry = new Date();
    accessTokenExpiry.setHours(accessTokenExpiry.getHours() + 24);

    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

    // Store access token session in database
    await prisma.session.create({
      data: {
        userId,
        token: accessToken,
        expiresAt: accessTokenExpiry
      }
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiry,
      refreshTokenExpiry
    };
  } catch (error) {
    console.error('Error generating tokens:', error);
    throw new Error('Failed to generate tokens');
  }
};

const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const refreshAccessToken = async (refreshToken) => {
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !user.isActive) {
      throw new Error('Invalid user');
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const accessTokenExpiry = new Date();
    accessTokenExpiry.setHours(accessTokenExpiry.getHours() + 24);

    // Store new session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        expiresAt: accessTokenExpiry
      }
    });

    return {
      accessToken,
      accessTokenExpiry
    };
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

const revokeToken = async (token) => {
  try {
    await prisma.session.delete({
      where: { token }
    });
  } catch (error) {
    // Token might not exist, which is fine
  }
};

const revokeAllUserTokens = async (userId) => {
  try {
    await prisma.session.deleteMany({
      where: { userId }
    });
  } catch (error) {
    console.error('Error revoking user tokens:', error);
  }
};

const cleanupExpiredTokens = async () => {
  try {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    
    console.log(`Cleaned up ${result.count} expired sessions`);
    return result.count;
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    return 0;
  }
};

module.exports = {
  generateTokens,
  generateResetToken,
  generateVerificationToken,
  refreshAccessToken,
  revokeToken,
  revokeAllUserTokens,
  cleanupExpiredTokens
};