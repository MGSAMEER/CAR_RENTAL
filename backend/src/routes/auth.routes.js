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

// Brevo Email Test Route
router.get('/test-email', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Recipient email query parameter is required (?email=...)' });
    }
    
    logger.info(`[EMAIL TEST] Triggering Brevo API test email to: ${email}`);
    const { getMailerHealth, sendMailAsync } = require('../utils/mailer');
    const health = getMailerHealth();
    
    if (!health.configured) {
      return res.status(500).json({ 
        success: false, 
        message: 'Brevo API key is not configured. Set BREVO_API_KEY in your environment variables.',
        health 
      });
    }
    
    await sendMailAsync({
      to: email,
      subject: 'DriveEasy Email Test 🚗',
      html: '<h1>Email works!</h1><p>This is a test from the DriveEasy backend via Brevo HTTP API. If you see this, your email configuration is 100% functional!</p>'
    });
    
    res.json({ 
      success: true, 
      message: `Test email sent to ${email} via Brevo HTTP API.`,
      health 
    });
  } catch (err) {
    logger.error(`[EMAIL TEST] Brevo API test failed: ${err.message}`);
    res.status(500).json({ success: false, message: `Email test failed: ${err.message}` });
  }
});

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
