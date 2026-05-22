require('dotenv').config();
const app = require('./app');
const { prisma } = require('./config/database');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

// Global Error Handlers to prevent server crashes
process.on('uncaughtException', (err) => {
  logger.error(`UNCAUGHT EXCEPTION: ${err.message}`, err);
  // Do not exit the process, allow it to continue running
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`UNHANDLED REJECTION: at ${promise}, reason: ${reason}`);
  // Do not exit the process, allow it to continue running
});

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚗 Car Rental API running on http://0.0.0.0:${PORT}`);
      logger.info(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('\n🛑 Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
