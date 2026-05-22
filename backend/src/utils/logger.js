const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'car-rental-api' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new transports.File({ filename: path.join(logDir, 'combined.log') }),
    // Special log for auth events
    new transports.File({ filename: path.join(logDir, 'auth.log'), level: 'info' }),
  ],
});

// If we're not in production then log to the `console`
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      format.printf(({ timestamp, level, message, stack }) =>
        stack
          ? `[${timestamp}] ${level}: ${message}\n${stack}`
          : `[${timestamp}] ${level}: ${message}`
      )
    ),
  }));
}

module.exports = logger;
