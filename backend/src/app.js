const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Routes are now centralized in ./routes/index.js
const { errorHandler, notFound } = require('./middleware/error.middleware');
const path = require('path');

const app = express();

// Trust proxy for secure cookies and accurate IP rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Security middleware with HSTS enabled for HTTPS enforcement
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS Configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    
    // In development allow any origin for easy testing (mobile network IPs, ngrok)
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // In production, strictly restrict to allowedOrigins
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}));

// Handle Pre-flight requests globally
app.options('*', cors());

// Body parsing - Conditional for Stripe Webhooks
app.use((req, res, next) => {
  if (req.originalUrl === '/api/v1/payments/webhook') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

const logger = require('./utils/logger');

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
}

// Global rate limiter with logging for unusual traffic patterns
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { success: false, error: 'RATE_LIMIT', message: 'Too many requests, please try again later.' },
  handler: (req, res, next, options) => {
    logger.warn(`[UNUSUAL TRAFFIC] Rate limit exceeded by IP: ${req.ip} on ${req.originalUrl}`);
    res.status(options.statusCode).send(options.message);
  }
});
app.use('/api/', globalLimiter);

// Health check & Diagnostics
const { checkHealth } = require('./controllers/health.controller');
app.get('/health', checkHealth);

// Centralized API v1 Routes
const v1Routes = require('./routes');
app.use('/api/v1', v1Routes);

// Error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
