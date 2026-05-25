const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { prisma } = require('../config/database');
const { sendWelcomeEmail, sendEmailVerification, sendPasswordReset } = require('../utils/mailer');
const logger = require('../utils/logger');

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d';

const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
  return { accessToken, refreshToken };
};

// POST /api/v1/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const user = await prisma.user.create({
      data: { 
        name, 
        email, 
        password: hashedPassword,
        emailVerificationToken: tokenHash,
        emailVerificationExpires: tokenExpires,
        isEmailVerified: false, // 🔒 Strictly require email verification
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    // Send async emails - don't block registration on email failure
    (async () => {
      try {
        await sendWelcomeEmail(user.email, user.name);
        logger.info(`[EMAIL] Welcome email sent to ${user.email}`);
      } catch (err) {
        logger.error(`[EMAIL] Welcome email failed for ${user.email}: ${err.message}`);
      }
    })();

    // Always send verification email
    (async () => {
      try {
        await sendEmailVerification(user.email, verificationToken);
        logger.info(`[EMAIL] Verification email sent to ${user.email}`);
      } catch (err) {
        logger.error(`[EMAIL] Verification email failed for ${user.email}: ${err.message}`);
      }
    })();

    logger.info(`[AUTH] User registered successfully: ${user.email}`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Please check your email to verify your account before logging in.',
      data: { userId: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      logger.warn(`[AUTH] Login failed: User not found - ${email}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isEmailVerified) {
      logger.warn(`[AUTH] Login blocked: Unverified email - ${email}`);
      return res.status(403).json({ success: false, message: 'Please verify your email before logging in.' });
    }

    // Google-only accounts have no local password
    if (!user.password) {
      logger.warn(`[AUTH] Login blocked: Google-only account attempted password login - ${email}`);
      return res.status(401).json({ success: false, message: 'This account was created with Google. Please use "Sign in with Google".' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      logger.warn(`[AUTH] Login failed: Invalid password - ${email}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    logger.info(`[AUTH] Login successful: ${email} (${user.role})`);

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    // Store refresh token in DB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: { userId: user.id, refreshToken, expiresAt },
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/refresh
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Refresh token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    const session = await prisma.session.findFirst({
      where: { userId: decoded.userId, refreshToken: token },
      include: { user: { select: { id: true, role: true } } },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(session.user.id, session.user.role);

    // Rotate refresh token
    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/logout
const logout = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (token) {
      await prisma.session.deleteMany({ where: { refreshToken: token } });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, createdAt: true, isEmailVerified: true },
    });
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/auth/verify-email/:token
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: tokenHash,
        emailVerificationExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Don't leak whether user exists
      return res.json({ success: true, message: 'If an account with that email exists, we sent a password reset link.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const tokenExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: tokenExpires,
      },
    });

    if (sendPasswordReset) {
      sendPasswordReset(user.email, resetToken).catch((err) => {
        logger.error(`[EMAIL] Password reset email failed for ${user.email}: ${err.message}`);
      });
    }

    logger.info(`[AUTH] Password reset requested for: ${email}`);

    res.json({ success: true, message: 'If an account with that email exists, we sent a password reset link.' });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/reset-password/:token
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    // Terminate all sessions for security
    await prisma.session.deleteMany({ where: { userId: user.id } });

    logger.info(`[AUTH] Password reset successful for: ${user.email}`);

    res.json({ success: true, message: 'Password reset successful. Please log in with your new password.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, refreshToken, logout, getMe, verifyEmail, forgotPassword, resetPassword };
