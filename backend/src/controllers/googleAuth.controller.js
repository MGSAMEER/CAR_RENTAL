const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
const client = new OAuth2Client(clientId);

const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Generate access + refresh JWT pair — identical to auth.controller.js
 * so all existing middleware (authenticate) works without change.
 */
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

/**
 * POST /api/v1/auth/google
 *
 * Body: { idToken: string }
 *
 * Flow:
 *  1. Verify Google ID token with Google's public keys.
 *  2. Extract verified payload (sub, email, name, picture).
 *  3. Find existing user by googleId OR email (link accounts).
 *  4. If user found by email but not yet linked → link their Google account.
 *  5. If no user → create one (email auto-verified via Google).
 *  6. Generate JWT pair + create Session row (same as normal login).
 *  7. Return tokens + user object.
 */
const googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token is required',
      });
    }

    // ── 1. Verify token with Google ──────────────────────────────────
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      logger.warn(`[GOOGLE AUTH] Token verification failed: ${verifyErr.message}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid Google token. Please try signing in again.',
      });
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Google account must have an associated email.',
      });
    }

    // ── 2. Find or create user ───────────────────────────────────────
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
    });

    if (user) {
      // ── 3a. Link Google account if user logged in via email before ──
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            avatar: picture || user.avatar,
            authProvider: 'google',
            isEmailVerified: true, // Google already verified the email
          },
        });
        logger.info(`[GOOGLE AUTH] Linked Google account to existing user: ${email}`);
      } else {
        // Update avatar in case it changed
        if (picture && picture !== user.avatar) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { avatar: picture },
          });
        }
        logger.info(`[GOOGLE AUTH] Existing Google user signed in: ${email}`);
      }
    } else {
      // ── 3b. New user — create account ───────────────────────────────
      user = await prisma.user.create({
        data: {
          name: name || email.split('@')[0],
          email,
          googleId,
          avatar: picture,
          authProvider: 'google',
          isEmailVerified: true, // Google confirms the email
          // password intentionally omitted (nullable)
        },
      });
      logger.info(`[GOOGLE AUTH] New user registered via Google: ${email}`);
    }

    // ── 4. Block check ──────────────────────────────────────────────
    if (user.isBlocked) {
      logger.warn(`[GOOGLE AUTH] Blocked user attempted login: ${email}`);
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact support.',
      });
    }

    // ── 5. Generate JWT tokens ──────────────────────────────────────
    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    // ── 6. Persist session (same table as normal login) ─────────────
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: { userId: user.id, refreshToken, expiresAt },
    });

    logger.info(`[GOOGLE AUTH] Login successful: ${email} (${user.role})`);

    // ── 7. Respond ──────────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: 'Google login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          authProvider: user.authProvider,
        },
      },
    });
  } catch (error) {
    logger.error(`[GOOGLE AUTH] Unexpected error: ${error.message}`);
    next(error);
  }
};

module.exports = { googleLogin };
