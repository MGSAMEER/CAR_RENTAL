const logger = require('../utils/logger');

const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.originalUrl} not found`,
  });
};

const errorHandler = (err, req, res, next) => {
  logger.error(`[API ERROR] ${req.method} ${req.originalUrl} - ${err.message}`, err);

  // Prisma unique constraint
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: 'CONFLICT',
      message: `${err.meta?.target?.join(', ')} already exists`,
    });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: 'Record not found',
    });
  }

  if (err.message === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      error: 'BAD_REQUEST',
      message: 'Invalid file type. Only JPG, PNG, and PDF are allowed.',
    });
  }

  if (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'BAD_REQUEST',
      message: 'File size too large. Maximum limit is 5MB.',
    });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : (err.message || 'Something went wrong. Please try again.'),
    error: err.error || 'INTERNAL_SERVER_ERROR',
  });
};

module.exports = { notFound, errorHandler };
