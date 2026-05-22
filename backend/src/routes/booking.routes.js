const router = require('express').Router();
const { body } = require('express-validator');
const { createBooking, getBookings, getBookingById, cancelBooking, getBookedDates } = require('../controllers/booking.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const bookingRules = [
  body('car_id').trim().notEmpty().withMessage('Car ID is required').isUUID().withMessage('Invalid Car ID format'),
  body('start_date').isISO8601().withMessage('Valid start date is required'),
  body('end_date').isISO8601().withMessage('Valid end date is required'),
  body('payment_intent_id').trim().notEmpty().withMessage('Payment intent ID is required').escape(),
];

// ✅ PUBLIC ROUTE (no auth required) - must come BEFORE middleware
router.get('/car/:carId/dates', getBookedDates);

// ✅ PROTECTED ROUTES (auth required) - all routes below require authentication
router.use(authenticate);

router.post('/', bookingRules, validate, createBooking);
router.get('/', getBookings);
router.get('/:id', getBookingById);
router.patch('/:id/cancel', cancelBooking);

module.exports = router;
