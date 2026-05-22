const { prisma } = require('../config/database');
const os = require('os');
const { getMailerHealth } = require('../utils/mailer');
// Using process.env to check Stripe config safely without importing the whole SDK if not needed
// But we can also check if it's initialized

const checkHealth = async (req, res) => {
  const isVerbose = req.query.verbose === 'true' && process.env.NODE_ENV !== 'production';

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'pending',
      stripe: 'pending',
      smtp: 'pending',
      background_queues: 'pending'
    },
    system: {
      memory: {
        free: os.freemem(),
        total: os.totalmem(),
        usage: process.memoryUsage(),
      },
      cpuLoad: os.loadavg(),
    }
  };

  // 1. Database Diagnostics (Lightweight query)
  try {
    // A quick lightweight query to ensure MongoDB is responsive
    await prisma.user.findFirst({ select: { id: true } });
    health.services.database = 'up';
  } catch (error) {
    health.services.database = 'down';
    health.status = 'degraded';
    if (isVerbose) health.services.database_error = error.message;
  }

  // 2. Stripe Diagnostics (Config verification)
  const hasStripeKey = !!process.env.STRIPE_SECRET_KEY;
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
  
  if (hasStripeKey && (hasWebhookSecret || process.env.NODE_ENV !== 'production')) {
    health.services.stripe = 'up';
    if (!hasWebhookSecret && isVerbose) {
      health.services.stripe_warning = 'STRIPE_WEBHOOK_SECRET is missing. Webhooks will fail, but allowed in dev.';
    }
  } else {
    health.services.stripe = 'down';
    health.status = 'degraded';
    if (isVerbose) health.services.stripe_error = 'Missing critical Stripe secret keys';
  }

  // 3. SMTP & Background Queues Diagnostics
  try {
    const mailerHealth = getMailerHealth();
    health.services.smtp = mailerHealth.configured ? 'up' : 'down';
    
    // If transporter is idle, the background mail queue is empty/healthy
    health.services.background_queues = mailerHealth.idle ? 'healthy' : 'processing';
    
    if (!mailerHealth.configured) {
      health.status = 'degraded';
    }
  } catch (error) {
    health.services.smtp = 'down';
    health.services.background_queues = 'unknown';
    health.status = 'degraded';
  }

  // In production, strip sensitive system info to avoid data exposure
  if (process.env.NODE_ENV === 'production' && req.query.secret !== process.env.HEALTH_SECRET) {
    delete health.system;
    
    // Clean up detailed queue info for public
    if (health.services.background_queues === 'processing') {
       health.services.background_queues = 'active';
    }
  }

  // Production-safe HTTP Status
  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
};

module.exports = { checkHealth };
