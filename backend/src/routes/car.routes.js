const router = require('express').Router();
const { body, query, param } = require('express-validator');
const { getCars, getCarById, createCar, updateCar, deleteCar } = require('../controllers/car.controller');
const { authenticate, authorizeAdmin } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const reviewRoutes = require('./review.routes');

// Anti-scraping limiter for car listings
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // 20 requests per minute
  message: { success: false, error: 'RATE_LIMIT', message: 'Too many search requests, please slow down.' },
  handler: (req, res, next, options) => {
    logger.warn(`[SCRAPE ATTEMPT] Rate limit exceeded by IP: ${req.ip} on ${req.originalUrl}`);
    res.status(options.statusCode).send(options.message);
  }
});

const carRules = {
  list: [
    query('type').optional().trim().escape(),
    query('minPrice').optional().isFloat({ min: 0 }).toFloat(),
    query('maxPrice').optional().isFloat({ min: 0 }).toFloat(),
    query('available').optional().isBoolean().toBoolean(),
    query('search').optional().trim().escape(),
  ],
  mutation: [
    body('name').trim().notEmpty().withMessage('Car name is required').escape(),
    body('brand').trim().notEmpty().withMessage('Brand is required').escape(),
    body('model').trim().notEmpty().withMessage('Model is required').escape(),
    body('type').trim().notEmpty().withMessage('Car type is required').escape(),
    body('pricePerDay').isFloat({ min: 0 }).withMessage('Price per day must be a positive number').toFloat(),
    body('seats').optional().isInt({ min: 1 }).toInt(),
    body('transmission').optional().trim().escape(),
    body('fuelType').optional().trim().escape(),
    body('description').optional().trim().escape(),
    body('imageUrl').optional().trim().isURL().withMessage('Valid image URL is required'),
  ],
};

const { upload } = require('../utils/cloudinary');

router.get('/', searchLimiter, carRules.list, validate, getCars);
router.get('/:id', searchLimiter, getCarById);

// We add upload.single('image') before validation so req.body is parsed for the express-validator
router.post('/', authenticate, authorizeAdmin, upload.single('image'), carRules.mutation, validate, createCar);
router.put('/:id', authenticate, authorizeAdmin, upload.single('image'), carRules.mutation, validate, updateCar);
router.delete('/:id', authenticate, authorizeAdmin, deleteCar);

// Mount reviews router
router.use('/:id/reviews', reviewRoutes);

module.exports = router;
