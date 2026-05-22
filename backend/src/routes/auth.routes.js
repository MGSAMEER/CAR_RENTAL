const router = require('express').Router();
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { register, login, refreshToken, logout, getMe, verifyEmail, forgotPassword, resetPassword } = require('../controllers/auth.controller');
const { googleLogin } = require('../controllers/googleAuth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const logger = require('../utils/logger');

// Stricter rate limit for auth routes with logging
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, error: 'RATE_LIMIT', message: 'Too many attempts, please wait a minute.' },
  handler: (req, res, next, options) => {
    logger.warn(`[AUTH BRUTEFORCE] Rate limit exceeded by IP: ${req.ip} on ${req.originalUrl}`);
    res.status(options.statusCode).send(options.message);
  }
});

const authRules = {
  register: [
    body('name').trim().notEmpty().withMessage('Name is required').escape(),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  login: [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  forgotPassword: [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  ],
  resetPassword: [
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
};

router.post('/register', authLimiter, authRules.register, validate, register);
router.post('/login', authLimiter, authRules.login, validate, login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);

// Additional security routes
router.get('/verify-email/:token', verifyEmail);
router.post('/forgot-password', authLimiter, authRules.forgotPassword, validate, forgotPassword);
router.post('/reset-password/:token', authLimiter, authRules.resetPassword, validate, resetPassword);

// ── Google OAuth ─────────────────────────────────────────────────────────
// Separate, slightly relaxed limiter: OAuth round-trips can be slower
const googleLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'RATE_LIMIT', message: 'Too many Google login attempts, please wait a minute.' },
  handler: (req, res, next, options) => {
    logger.warn(`[GOOGLE AUTH BRUTEFORCE] Rate limit exceeded by IP: ${req.ip}`);
    res.status(options.statusCode).send(options.message);
  },
});

router.post(
  '/google',
  googleLimiter,
  [
    body('idToken').notEmpty().withMessage('Google ID token is required'),
  ],
  validate,
  googleLogin
);

module.exports = router;
